# ADR-004: Canonical Database Schema

## Status

Accepted — all eight decisions settled, implemented in migrations 003 to 006 and
verified by 24 automated tests (`supabase/tests/run.sh`).

Decisions 3, 4, 6 and 7 are resolved as *deferred*, which is a decision, not an
omission: each names what would have to change to revisit it. Any of the eight
may be reopened, but reopening now costs a migration rather than an edit.

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

4. **`001_initial_schema.sql` could not be executed at all.** Found by actually
   running it against an empty database:

   ```
   psql:205: ERROR:  relation "program_assignments" does not exist
   ```

   Three athlete policies — on `programs`, `sessions` and `session_exercises` —
   reference `program_assignments`, which is created 150 lines later. PostgreSQL
   validates a policy expression when the policy is created, so the failure is
   immediate rather than deferred, and `program_assignments` cannot be moved
   earlier because it holds a foreign key to `programs`.

   This compounds finding 1: the canonical schema's single migration was not
   reproducible, which is how production and `migrations/` were able to drift in
   the first place. The three policies were moved to the end of the file, a pure
   reordering that yields the same 28 policies and the same final schema.

   The general lesson for this ADR: three of these four findings were invisible
   to reading and appeared only on execution. The schema is now covered by a
   runnable test suite for exactly that reason.

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

**Decision:** settled — see "Resolution of decisions 2 to 8" below.

---

#### Decision 3 — Port `motivational_quotes`

**Question:** carry over the quotes table from the frozen schema, with a seed of
20 French quotes?

**Options:**

| Option | Cost |
|---|---|
| Port it | One table, one public-read policy, one seed file, plus sourcing 20 quotes that are actually good and rights-clear |
| Skip for 2026 | No cost now; the home screen loses a small motivational element |

**Decision:** settled — see "Resolution of decisions 2 to 8" below.

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

**Decision:** settled — see "Resolution of decisions 2 to 8" below.

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

**Decision:** settled — see "Resolution of decisions 2 to 8" below.

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

**Decision:** settled — see "Resolution of decisions 2 to 8" below.

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

**Decision:** settled — see "Resolution of decisions 2 to 8" below.

---

#### Decision 8 — `flexibility` versus `mobility`

**Question:** the two schemas classify exercises with different enums, and the
canonical one is strictly finer-grained:

```sql
-- frozen web schema (013_exercise_types_and_cardio.sql)
CREATE TYPE exercise_type AS ENUM ('strength', 'cardio', 'flexibility');

-- canonical schema (001_initial_schema.sql)
CREATE TYPE exercise_category AS ENUM
  ('strength', 'cardio', 'flexibility', 'mobility', 'plyometrics', 'other');
```

So this is not "which label wins" — the canonical enum already carries **both**
`flexibility` and `mobility` as distinct values. The real question is where the
frozen schema's `flexibility` rows land when ported, given that it collapses a
distinction the canonical schema makes.

This is not cosmetic. The value is persisted in an enum type, so revising it
later requires an `ALTER TYPE` plus a data migration, and it surfaces directly
in the French UI where "flexibilité" and "mobilité" are not synonyms to an
athlete.

**Options:**

| Option | Cost |
|---|---|
| Map frozen `flexibility` → canonical `flexibility` wholesale | Mechanical, no judgement needed; mislabels any stretching-vs-mobility work that was only ever `flexibility` because the frozen enum had no better slot |
| Triage the ported rows between `flexibility` and `mobility` | Correct data, but requires a human pass over the frozen exercise seed and a documented rule for future entries |
| Drop `mobility` from the canonical enum | Simplest UI, but `ALTER TYPE ... DROP VALUE` is unsupported in PostgreSQL — it means recreating the type and rewriting every dependent column |

Whichever is chosen, the French labels for the six canonical values need to be
fixed at the same time, since they reach the athlete directly.

**Decision:** settled — see "Resolution of decisions 2 to 8" below.

---

## Resolution of decisions 2 to 8

Settled by the implementation track on 2026-08-17. Each entry states the ruling,
the reason, and what reopening it would cost.

| # | Ruling | Reason | Cost to reopen |
|---|---|---|---|
| 2 | **`coach_id` nullable + `created_by` + `is_public`** on `exercises` and `programs` | Keeps ownership consistent with decision 1 and avoids a phantom system account that every query and policy would have to special-case forever | None; it is the shape everything else was built on |
| 3 | **Defer `motivational_quotes`** | No 2026 task depends on it, and the real work is not the table but sourcing 20 French quotes that are good and rights-clear | One table, one public-read policy, one seed |
| 4 | **Defer `coach_messages` to 2027** | The 2026 product has no coach, and the canonical schema already has `conversations` + `messages`, so porting now would add a second messaging model with no user | Revisit alongside the existing messaging tables when the coach space is built |
| 5 | **Port session pause** | Session duration is computed by the live-logging feature; without pause tracking it counts wall-clock and overstates any interrupted session. Retrofitting means revisiting that logic *and* every duration already recorded | Already done — two columns, one partial index, in 005 |
| 6 | **Defer cardio prescription** | The 2026 seed templates are strength-only. `exercise_logs` already carries `duration_seconds` and `distance_meters`, so cardio *logging* is possible today; only the prescription columns are deferred | Two enums, four columns, one index — plus a logging UI that branches on exercise type |
| 7 | **Defer `sessions.session_type`** | Coupled to decision 6: it reuses the `exercise_type` enum, so it is meaningless on its own | One column, one filtered index, once 6 lands |
| 8 | **Map frozen `flexibility` → canonical `flexibility`, unchanged** | Nothing is actually being ported from the frozen exercise seed: cm#80 writes a fresh seed against the canonical 6-value enum, so there are no rows needing triage. The mapping rule matters only if that seed is ever imported | A human pass over the imported rows, at import time |

Two consequences of the deferrals worth stating plainly:

- Deferring 3, 4, 6 and 7 means the canonical schema is **narrower** than the
  frozen one for the whole of 2026. That is the intended trade: the frozen
  schema's extra surface serves a coach product that is not shipping.
- Decision 6's deferral is the one most likely to hurt. The wireframe tree
  already contains `session-live/distance-temps/` and `session-live/intervalles/`
  designs, so cardio is designed even though it is not prescribed. If those
  screens are in scope for 2026, decision 6 has to flip before cm#25 ships.

## Validation

The schema is not merely written; it executes and is tested.

`supabase/tests/run.sh` starts a disposable PostgreSQL 17 container, applies
`00_harness.sql` (a minimal Supabase shape: the `auth` schema, an `auth.uid()`
stub, and the `anon` / `authenticated` / `service_role` roles), applies every
file in `migrations/` in order, and runs 24 scenarios. It exits non-zero if any
fail, so CI can gate on it.

What the suite covers: solo program creation and self-assignment, refusal of
cross-athlete assignment and cross-athlete reads, public template readability
through `programs` → `sessions` → `session_exercises`, profile read scoping,
refusal of role self-promotion, the one-in-progress-session rule, set-logging
idempotency, PR recomputation on insert / soft delete / downward correction,
caller scoping of the history functions, the `status` ↔ `completed_at`
invariant, waitlist insert-but-not-read, and the ownership CHECK.

**What it does not cover.** `auth.uid()` is stubbed by a session GUC, so the
suite validates *policy logic*, not Supabase's JWT handling — a policy that
passes here can still be reached with an unexpected identity if the client sends
the wrong token. It also runs on an empty database, so it proves the migrations
are correct on a fresh schema, not that they apply cleanly to production's
current state. Applying them to a real project still requires a dev branch and a
rollback plan.

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

Done since this ADR was first drafted:

- ~~`waitlist_subscribers` needs a migration that reflects production~~ — added
  additively in `004`, with `IF NOT EXISTS` so it is a no-op on production, and
  with SELECT removed for `anon`/`authenticated`.
- ~~`001` is not reproducible~~ — fixed by reordering; a test suite now guards it.

Still open:

- The athlete-only product decision needs to be written up as an ADR in
  `the-project`; it is currently cited but undocumented.
- The two ADR numbering series should be consolidated.
- The migration sequence skips `002`. Nothing depends on the number — Supabase
  applies files in lexical order — but the hole reads as a lost migration. It is
  the number an out-of-band `002_waitlist_public_insert.sql` occupied in local
  work that was never committed; `004` supersedes it.
- `supabase/tests/run.sh` is not wired into CI. It needs Docker, which the
  current runners have, but adding a job is out of scope for this ADR.
- The frozen schema stays on disk and stays applicable by mistake. It should get
  a README marking it read-only.

## References

- `docs/ADR-002-db-schema.md` — the canonical schema's 14-table design
- `docs/ADR-003-project-structure.md` — file-series numbering precedent
- `docs/wiki/Stack-technique.md` — wiki-series ADRs, including the shared
  Supabase instance and the colliding ADR-004
- `the-project/supabase/migrations/` — frozen web schema, 13 migrations,
  read-only reference
- `supabase/scripts/README.md` — why the destructive reset script is not in
  `migrations/`
