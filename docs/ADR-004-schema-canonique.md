# ADR-004: Canonical Database Schema

## Status

Proposed — decision 1 settled, decisions 2 through 8 awaiting arbitration.

This ADR cannot move to Accepted until the open product decisions below are
resolved. Migration `003_athlete_solo_programs.sql` depends only on decision 1
and may proceed; migrations 004 to 006 depend on the rest.

## Date

2026-08-17

## Numbering note

Two independent ADR numbering series exist in this repository and they have
collided. This document belongs to the file series.

| Series | Location | ADR-004 is |
|---|---|---|
| Files (authoritative) | `docs/ADR-00N-*.md` | this document |
| Wiki summary | `docs/wiki/Stack-technique.md` | "Monorepo séparé (pas de monorepo unifié)" |

A third reference exists: internal planning documents cite an "ADR-003" in the
`the-project` repository for the athlete-only product decision. No such file
exists there. That decision is real and is treated as an input to this ADR, but
it is currently undocumented and should be written up separately.

Consolidating the two series is out of scope here and is tracked as follow-up.

## Context

Cadence has two database schemas, and neither is authoritative.

**The frozen web schema** lives in `the-project/supabase/migrations/`. It is the
older of the two, grew across 13 incremental migrations, and backs the Next.js
web app that ADR-003-project-structure's successor froze. It is the more
feature-complete of the two: it carries session pause, cardio prescription,
motivational quotes, coach messaging, and a set of reporting functions that the
mobile schema has never had.

**The mobile schema** lives in `cadence-mobile/supabase/migrations/001_initial_schema.sql`.
It defines 14 tables in a single file, is documented in ADR-002-db-schema, and is
the schema the mobile app actually queries today.

Keeping both is not viable. They share one Supabase instance
(`docs/wiki/Stack-technique.md`, ADR-003 of the wiki series), so divergent
migrations applied to the same database produce a schema that matches neither
file — which is already happening, see Known drift below.

The product context that forces the choice: the 2026 release is an
**autonomous athlete app with no coach**. The athlete signs up alone, picks a
program template, logs sessions, and tracks records and readiness. Everything
coach-facing is deferred to 2027.

### Known drift, measured 2026-08-17

Three facts established by inspecting the live files rather than the planning
documents. They are recorded here because each one invalidates an assumption
that circulating briefs still carry.

1. **`waitlist_subscribers` exists in production but in no migration.** The
   canonical schema's `001_initial_schema.sql` on `develop` defines 14 tables;
   `waitlist_subscribers` is not among them. The table is nonetheless live and
   feeds the landing page counter. Any environment rebuilt from migrations will
   lack a table that production has.

2. **`001_initial_schema.sql` was being edited in place.** Local work carried a
   43-line addition to an already-applied migration (hardening `handle_new_user`,
   adding `waitlist_subscribers`). Editing an applied migration makes a rebuilt
   database diverge silently from production. Corrections belong in a new
   numbered migration.

3. **The RLS porting cost is roughly 50% higher than estimated.** Planning
   documents cite "~45 policies to port". The actual count in
   `the-project/supabase/migrations/`:

   | Measure | Count |
   |---|---|
   | `CREATE POLICY` statements | 76 |
   | Distinct policy names | 70 |
   | `DROP POLICY` statements | 6 |

   The net figure to port is therefore near 70, not 45. Six policies are
   dropped and recreated across migrations, so the frozen schema's final state
   holds fewer than 76 live policies, but the porting work is bounded by the
   distinct-name count.

## Decision

### 1. The cadence-mobile schema is canonical

`cadence-mobile/supabase/migrations/` becomes the single source of truth for the
database. The frozen web schema in `the-project/supabase/` becomes a read-only
reference: it may be consulted and selectively ported, never applied.

Rationale: the mobile app is the 2026 deliverable, the web app is frozen, and
the mobile schema is the one currently serving reads and writes. Choosing the
frozen schema would mean migrating the shipping product's data access to a
schema no shipping product uses.

### 2. The accepted cost

Choosing the newer, smaller schema means the feature-completeness of the older
one has to be re-earned. This is accepted deliberately:

- **~70 RLS policies to port or rewrite**, not the ~45 previously assumed. Each
  needs `TO authenticated` and an acyclicity check before it lands.
- **The `SECURITY DEFINER` recursion workaround is not carried over.** The
  frozen schema's `004_fix_rls_recursion.sql` exists because its policy graph
  contained a cycle. The canonical schema denormalises `coach_id`, which makes
  the graph acyclic and the workaround unnecessary. Reintroducing that pattern
  would import a problem the canonical schema does not have.
- **One `SECURITY DEFINER` function remains justified**: `handle_new_user()`, the
  trigger on `auth.users`, which must run with elevated rights to insert into
  `public.profiles`. It is the only one, and any addition requires a written
  justification in a SQL comment.
- **Feature parity is not immediate.** Session pause, cardio prescription,
  quotes and coach messaging exist only in the frozen schema. Whether each is
  ported is decisions 3 through 7 below.

### 3. Structural blocker to clear first

The canonical schema cannot express a solo athlete. Verified against
`origin/develop`:

```sql
CREATE TABLE programs (
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ...                       -- no created_by column
);

CREATE TABLE program_assignments (
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ...
);
```

With `coach_id` mandatory on both tables and every policy written as
`FOR ALL USING (auth.uid() = coach_id)`, an athlete can neither own a program
nor assign one to themselves. That makes the template-selection feature — the
one that makes the app usable without a coach — impossible to build.

Clearing this is decision 1, settled below, and is implemented by migration
`003_athlete_solo_programs.sql`.

### 4. Open product decisions

Decision 1 is settled. Decisions 2 through 8 are presented with their options
and costs; each carries an empty slot for arbitration.

---

#### Decision 1 — Athlete-created programs

**Question:** can an athlete own a program with no coach involved?

**Options:**

| Option | Cost |
|---|---|
| `coach_id` nullable + `created_by NOT NULL`, with a CHECK requiring at least one owner | One migration; every `programs` and `program_assignments` policy rewritten; an index on `programs(created_by)` |
| Keep `coach_id NOT NULL` and attach solo athletes to a system coach account | No schema change, but a fake user in `profiles` that every query and policy must special-case forever |

**Decision: YES — `coach_id` nullable plus `created_by`.**

The system-coach alternative pushes a permanent special case into every policy
and every query to avoid a single migration. It also misrepresents the data: a
solo athlete's program has no coach, and the schema should say so.

---

#### Decision 2 — Ownership of seeded public exercises

**Question:** the exercise library is shared by all athletes. `exercises.coach_id`
is currently `NOT NULL`. Who owns a seeded exercise?

**Options:**

| Option | Cost |
|---|---|
| A system account owns them | No schema change; requires creating and protecting a real `profiles` row; every "my exercises" query must exclude it |
| `coach_id` nullable + `is_public BOOLEAN` | One migration; a clean read policy (`is_public OR coach_id = auth.uid()`); no phantom user |

Note this decision interacts with decision 1: choosing the nullable+flag shape
here keeps the ownership model consistent with `programs`. It also governs how
templates are marked in the seed work (issue cm#80).

**Decision:** _(à trancher)_

---

#### Decision 3 — Port `motivational_quotes`

**Question:** carry over the quotes table from the frozen schema, with a seed of
20 French quotes?

**Options:**

| Option | Cost |
|---|---|
| Port it | One table, one public-read policy, one seed file, plus sourcing 20 quotes that are actually good and rights-clear |
| Skip for 2026 | No cost now; the home screen loses a small motivational element |

**Decision:** _(à trancher)_

---

#### Decision 4 — Port `coach_messages`

**Question:** carry over the coach messaging table?

Note the canonical schema already has `conversations` and `messages`, so this is
partly duplicated. The 2026 product has no coach.

**Options:**

| Option | Cost |
|---|---|
| Port it | Table plus policies, for a feature with no user in 2026 |
| Skip until 2027 | None now; revisit when the coach space is built, alongside `conversations`/`messages` |

**Decision:** _(à trancher)_

---

#### Decision 5 — Session pause

**Question:** port `paused_at` and `total_paused_seconds` on `session_logs`?

Source: `the-project/supabase/migrations/009_session_pause.sql`, which adds both
columns plus a partial index on `session_logs(athlete_id, paused_at)` filtered on
`paused_at IS NOT NULL AND completed_at IS NULL AND is_deleted = FALSE`.

**Options:**

| Option | Cost |
|---|---|
| Port it | Two columns, one partial index; the live-logging feature must maintain them correctly, including after a crash |
| Skip | Elapsed session time counts wall-clock, which overstates duration when an athlete is interrupted |

This one has a real bearing on the live-logging work (issue cm#25): duration is
computed there, and retrofitting pause afterwards means revisiting that logic.

**Decision:** _(à trancher)_

---

#### Decision 6 — Cardio prescription

**Question:** port the cardio columns?

Source: `the-project/supabase/migrations/013_exercise_types_and_cardio.sql`,
which introduces:

```sql
CREATE TYPE exercise_type AS ENUM ('strength', 'cardio', 'flexibility');
CREATE TYPE intensity_level AS ENUM ('easy', 'moderate', 'hard', 'very_hard');

ALTER TABLE exercises
  ADD COLUMN exercise_type exercise_type NOT NULL DEFAULT 'strength',
  ADD COLUMN target_distance_km DECIMAL(6,2),
  ADD COLUMN target_heart_rate INTEGER,
  ADD COLUMN intensity intensity_level;
```

**Options:**

| Option | Cost |
|---|---|
| Port it | Two enums, four columns, one index; the logging UI must branch on exercise type |
| Skip | The 2026 seed templates are strength-only, so nothing breaks — but adding cardio later means a migration plus a UI rework |

**Decision:** _(à trancher)_

---

#### Decision 7 — `sessions.session_type`

**Question:** port `session_type`, typed with the same `exercise_type` enum and
defaulting to `'strength'`?

This is coupled to decision 6: `session_type` reuses the `exercise_type` enum, so
porting it without decision 6 means creating that enum anyway.

**Options:**

| Option | Cost |
|---|---|
| Port it | One column, one filtered index; only meaningful if decision 6 is yes |
| Skip | Sessions stay untyped; adequate while every template is strength-based |

**Decision:** _(à trancher)_

---

#### Decision 8 — `flexibility` versus `mobility`

**Question:** the frozen schema's `exercise_type` enum uses `'flexibility'`. The
canonical schema's `exercise_category` enum uses its own set of values. Which
label wins, and how do the two enums map onto each other?

This is not cosmetic. The value is persisted in enum types, so changing it later
requires an `ALTER TYPE` plus a data migration, and it surfaces directly in the
French UI where "flexibilité" and "mobilité" are not synonyms to an athlete.

**Options:**

| Option | Cost |
|---|---|
| Keep `flexibility` | Matches the frozen schema, so ported data needs no rewriting |
| Standardise on `mobility` | Arguably the better term for what the exercises are; requires a mapping at port time and a decision on the French label |

**Decision:** _(à trancher)_

---

## Consequences

### Positive

- One schema, one migration directory, one place to look. The ambiguity that let
  production, migrations, and local databases drift apart is removed.
- The `SECURITY DEFINER` recursion workaround is retired rather than inherited.
- Ownership becomes explicit: `created_by` says who made a program, and the
  absence of a coach is representable instead of faked.

### Negative

- Around 70 RLS policies have to be ported or rewritten, each one requiring an
  acyclicity check. This is the single largest cost of the decision and it is
  front-loaded.
- Feature parity with the frozen schema is lost until decisions 3 through 7 are
  made and the corresponding migrations written.
- The frozen schema stays on disk as a reference, which means it stays available
  to be applied by mistake. It should be marked read-only in its own README.

### Trade-offs

- Migration `003` widens `programs` and `program_assignments` for a use case
  (solo athlete) that will coexist in 2027 with the coach use case. The CHECK
  constraint requiring at least one owner is what keeps the widened shape from
  degrading into "anyone can own anything".
- Deferring decisions 5, 6 and 7 is cheap now and expensive later: each becomes a
  migration plus a UI rework once the logging feature exists. Decision 5 in
  particular should be settled before the live-logging work starts.

### Follow-up

- `waitlist_subscribers` needs a migration that reflects production, so a
  rebuilt database matches. It must be additive and must not edit `001`.
- The athlete-only product decision needs to be written up as an ADR in
  `the-project`; it is currently cited but undocumented.
- The two ADR numbering series should be consolidated.

## References

- `docs/ADR-002-db-schema.md` — the canonical schema's 14-table design
- `docs/ADR-003-project-structure.md` — file-series numbering precedent
- `docs/wiki/Stack-technique.md` — wiki-series ADRs, including the shared
  Supabase instance and the colliding ADR-004
- `the-project/supabase/migrations/` — frozen web schema, 13 migrations,
  read-only reference
- `supabase/scripts/README.md` — why the destructive reset script is not in
  `migrations/`
