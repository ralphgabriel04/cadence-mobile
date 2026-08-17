#!/usr/bin/env node
// ============================================================================
// Generates src/types/database.ts from a live PostgreSQL schema.
//
//   node scripts/gen-db-types.mjs < introspection.tsv > src/types/database.ts
//
// Normally driven by scripts/gen-db-types.sh, which spins up a disposable
// container, applies supabase/migrations/*.sql, and pipes the introspection in.
//
// WHY THIS EXISTS
// `supabase gen types typescript` is the normal tool. It needs either the
// Supabase CLI plus Docker, or a linked remote project. Generating from the
// migrations in a throwaway container instead means the types are derived from
// what the migrations actually produce -- not from what a remote project happens
// to contain, which is precisely the drift ADR-004 documents. It also works with
// no project credentials at all.
//
// The output follows the shape `supabase gen types typescript` emits, so it can
// be replaced by the real CLI later without touching consuming code.
// ============================================================================

// A Map rather than an object literal, because the keys come from the database.
// Indexing a plain object with an arbitrary string reaches the prototype chain:
// a PostgreSQL type named `constructor` or `toString` would resolve to an
// inherited property instead of falling through to "unknown".
const SQL_TO_TS = new Map(
  Object.entries({
    uuid: "string",
    text: "string",
    varchar: "string",
    bpchar: "string",
    date: "string",
    timestamptz: "string",
    timestamp: "string",
    time: "string",
    timetz: "string",
    int2: "number",
    int4: "number",
    int8: "number",
    float4: "number",
    float8: "number",
    numeric: "number",
    bool: "boolean",
    json: "Json",
    jsonb: "Json",
  }),
);

/** `_text` is PostgreSQL's internal name for `text[]`. */
function tsTypeFor(udt, enums) {
  if (udt.startsWith("_")) {
    const inner = tsTypeFor(udt.slice(1), enums);
    return `${inner}[]`;
  }
  if (enums.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
  return SQL_TO_TS.get(udt) ?? "unknown";
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
  });
}

function quoteKey(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

const raw = await readStdin();
const lines = raw.split("\n").map((l) => l.trimEnd()).filter(Boolean);

/** Section markers emitted by gen-db-types.sh. Map, for the reason above. */
const sections = new Map([
  ["ENUM", []],
  ["COLUMN", []],
  ["FUNCTION", []],
  ["FK", []],
]);
for (const line of lines) {
  const [kind, ...rest] = line.split("|");
  sections.get(kind)?.push(rest);
}
const enumRows = sections.get("ENUM") ?? [];
const columnRows = sections.get("COLUMN") ?? [];
const functionRows = sections.get("FUNCTION") ?? [];
const fkRows = sections.get("FK") ?? [];

// ── relationships ───────────────────────────────────────────────────────────
// postgrest-js requires GenericTable.Relationships. Omitting it makes the whole
// schema fail the GenericSchema constraint, which silently degrades the client's
// Schema type and breaks every typed rpc() call -- not just embedded selects.
const relationships = new Map();
for (const [name, table, cols, refTable, refCols, isOneToOne] of fkRows) {
  if (!relationships.has(table)) relationships.set(table, []);
  relationships.get(table).push({
    name,
    columns: cols.split(","),
    referencedRelation: refTable,
    referencedColumns: refCols.split(","),
    isOneToOne: isOneToOne === "t",
  });
}

// ── enums ───────────────────────────────────────────────────────────────────
const enumValues = new Map();
for (const [name, value] of enumRows) {
  if (!enumValues.has(name)) enumValues.set(name, []);
  enumValues.get(name).push(value);
}
const enums = new Set(enumValues.keys());

// ── columns ─────────────────────────────────────────────────────────────────
const tables = new Map();
for (const [table, column, udt, isNullable, hasDefault, isGenerated] of columnRows) {
  if (!tables.has(table)) tables.set(table, []);
  tables.get(table).push({
    column,
    udt,
    nullable: isNullable === "YES",
    hasDefault: hasDefault === "t",
    generated: isGenerated === "ALWAYS",
  });
}

// ── functions ───────────────────────────────────────────────────────────────
//
// RPC signatures are declared here rather than derived from pg_proc. Turning a
// PostgreSQL signature into a useful TypeScript type needs judgement a mechanical
// mapping cannot supply -- SETOF RECORD return columns, DEFAULT arguments, which
// arguments a caller should actually pass. There are five functions; a table is
// clearer than the introspection code would be.
//
// The shell wrapper still introspects pg_proc, so a function present in the
// database but missing here is reported as drift instead of silently untyped.
// Add an entry whenever you add an RPC.
const FUNCTION_SIGNATURES = new Map(Object.entries({
  get_last_exercise_performance: {
    args: "{ p_exercise_id: string }",
    returns: `{
          log_id: string;
          session_log_id: string;
          performed_at: string;
          set_number: number;
          reps_completed: number | null;
          weight_kg: number | null;
          rpe: number | null;
          duration_seconds: number | null;
          distance_meters: number | null;
          is_pr: boolean | null;
        }[]`,
  },
  get_exercise_history: {
    args: "{ p_exercise_id: string; p_limit?: number }",
    returns: `{
          session_log_id: string;
          performed_at: string;
          session_name: string;
          set_count: number;
          total_reps: number;
          max_weight_kg: number | null;
          total_volume_kg: number;
          avg_rpe: number | null;
          had_pr: boolean | null;
        }[]`,
  },
  get_personal_records: {
    args: "Record<string, never>",
    returns: `{
          exercise_id: string;
          exercise_name: string;
          weight_kg: number | null;
          reps_completed: number | null;
          achieved_at: string | null;
        }[]`,
  },
  get_waitlist_count: {
    args: "Record<string, never>",
    returns: "number",
  },
  program_week_number: {
    args: "{ p_start_date: string; p_on_date: string }",
    returns: "number | null",
  },
  // Returns Json on purpose. The payload is a nested discriminated union, which
  // no mechanical mapping from a SQL signature can express, so the service layer
  // validates it at the boundary (src/services/today-session.ts) and hands the
  // rest of the app a fully typed object. Typing it as anything narrower here
  // would be a claim the database does not actually guarantee.
  get_today_screen: {
    // p_on_date is REQUIRED here even though SQL gives it a DEFAULT. The default
    // is CURRENT_DATE, i.e. the server's timezone, which is wrong for every
    // athlete not sitting in it -- see the header of migration 007. Typing it as
    // required makes "forgot to pass the local date" a compile error.
    args: "{ p_on_date: string }",
    returns: "Json",
  },
}));

// Functions that exist for the database's own use and are not callable as RPCs.
const NON_RPC_FUNCTIONS = new Set([
  "update_updated_at",
  "handle_new_user",
  "prevent_profile_identity_change",
  "recompute_exercise_pr",
  "exercise_logs_pr_trigger",
  "empty_week_days",
]);

const discovered = new Set(functionRows.map(([name]) => name));
for (const name of discovered) {
  if (!FUNCTION_SIGNATURES.has(name) && !NON_RPC_FUNCTIONS.has(name)) {
    process.stderr.write(
      `gen-db-types: WARNING function "${name}" exists in the database but has no ` +
        `entry in FUNCTION_SIGNATURES and is not listed as non-RPC. It will be ` +
        `missing from Database["public"]["Functions"], so supabase.rpc("${name}") ` +
        `will not type-check.\n`,
    );
  }
}
for (const name of FUNCTION_SIGNATURES.keys()) {
  if (discovered.size > 0 && !discovered.has(name)) {
    process.stderr.write(
      `gen-db-types: WARNING "${name}" is declared here but no longer exists in ` +
        `the database. Remove it or fix the migration.\n`,
    );
  }
}

const functions = FUNCTION_SIGNATURES;

const out = [];
out.push("// ============================================================================");
out.push("// GENERATED FILE -- do not edit by hand.");
out.push("//");
out.push("// Regenerate with:  pnpm gen:types    (needs Docker)");
out.push("//");
out.push("// Derived from supabase/migrations/*.sql applied to a disposable PostgreSQL");
out.push("// container, so these types describe what the migrations produce rather than");
out.push("// what any particular Supabase project currently holds. See ADR-004.");
out.push("// ============================================================================");
out.push("");
out.push("export type Json =");
out.push("  | string");
out.push("  | number");
out.push("  | boolean");
out.push("  | null");
out.push("  | { [key: string]: Json | undefined }");
out.push("  | Json[];");
out.push("");
out.push("export type Database = {");
// postgrest-js infers its client options from this key:
//   ClientOptions = Database extends { __InternalSupabase: infer I } ? I : {}
// Omitting it leaves ClientOptions as {}, which degrades RPC argument typing --
// `client.rpc("fn", args)` then reports the args parameter as `undefined` and
// every typed RPC call fails to compile. `supabase gen types` emits this block;
// this generator has to as well.
out.push("  __InternalSupabase: {");
out.push('    PostgrestVersion: "13.0.5";');
out.push("  };");
out.push("  public: {");
out.push("    Tables: {");

for (const table of [...tables.keys()].sort()) {
  const cols = tables.get(table);
  out.push(`      ${quoteKey(table)}: {`);

  out.push("        Row: {");
  for (const c of cols) {
    const t = tsTypeFor(c.udt, enums);
    out.push(`          ${quoteKey(c.column)}: ${t}${c.nullable ? " | null" : ""};`);
  }
  out.push("        };");

  out.push("        Insert: {");
  for (const c of cols) {
    if (c.generated) continue; // GENERATED ALWAYS columns reject writes
    const t = tsTypeFor(c.udt, enums);
    // Required only when the database can supply nothing for it.
    const optional = c.nullable || c.hasDefault;
    out.push(`          ${quoteKey(c.column)}${optional ? "?" : ""}: ${t}${c.nullable ? " | null" : ""};`);
  }
  out.push("        };");

  out.push("        Update: {");
  for (const c of cols) {
    if (c.generated) continue;
    const t = tsTypeFor(c.udt, enums);
    out.push(`          ${quoteKey(c.column)}?: ${t}${c.nullable ? " | null" : ""};`);
  }
  out.push("        };");

  const rels = relationships.get(table) ?? [];
  if (rels.length === 0) {
    out.push("        Relationships: [];");
  } else {
    out.push("        Relationships: [");
    for (const r of rels) {
      out.push("          {");
      out.push(`            foreignKeyName: ${JSON.stringify(r.name)};`);
      out.push(`            columns: [${r.columns.map((c) => JSON.stringify(c)).join(", ")}];`);
      out.push(`            isOneToOne: ${r.isOneToOne};`);
      out.push(`            referencedRelation: ${JSON.stringify(r.referencedRelation)};`);
      out.push(
        `            referencedColumns: [${r.referencedColumns.map((c) => JSON.stringify(c)).join(", ")}];`,
      );
      out.push("          },");
    }
    out.push("        ];");
  }

  out.push("      };");
}

out.push("    };");
out.push("    Views: Record<string, never>;");

out.push("    Functions: {");
for (const name of [...functions.keys()].sort()) {
  const f = functions.get(name);
  out.push(`      ${quoteKey(name)}: {`);
  out.push(`        Args: ${f.args || "Record<string, never>"};`);
  out.push(`        Returns: ${f.returns};`);
  out.push("      };");
}
out.push("    };");

out.push("    Enums: {");
for (const name of [...enumValues.keys()].sort()) {
  const values = enumValues.get(name).map((v) => JSON.stringify(v)).join(" | ");
  out.push(`      ${quoteKey(name)}: ${values};`);
}
out.push("    };");
out.push("    CompositeTypes: Record<string, never>;");
out.push("  };");
out.push("};");
out.push("");
out.push("// ── Convenience aliases ─────────────────────────────────────────────────────");
out.push("");
out.push('export type Tables<T extends keyof Database["public"]["Tables"]> =');
out.push('  Database["public"]["Tables"][T]["Row"];');
out.push('export type TablesInsert<T extends keyof Database["public"]["Tables"]> =');
out.push('  Database["public"]["Tables"][T]["Insert"];');
out.push('export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =');
out.push('  Database["public"]["Tables"][T]["Update"];');
out.push('export type Enums<T extends keyof Database["public"]["Enums"]> =');
out.push('  Database["public"]["Enums"][T];');
out.push('export type FunctionReturns<T extends keyof Database["public"]["Functions"]> =');
out.push('  Database["public"]["Functions"][T]["Returns"];');
out.push("");

process.stdout.write(out.join("\n"));
