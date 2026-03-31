# ADR-002: Database Schema Design

## Status
Accepted

## Context
Cadence needs a relational database schema supporting coach-athlete relationships, program/session management, workout logging, messaging, and readiness tracking. The schema must enforce strict data isolation via Row Level Security (RLS).

## Decision

### 14 tables with the following key design choices:

1. **Exercises as a reusable library** — `exercises` belongs to a coach (not a session). `session_exercises` is the junction table linking exercises to sessions with session-specific parameters (sets, reps, rest, tempo, superset_group). This allows coaches to reuse exercises across programs.

2. **Soft delete everywhere** — All tables have `is_deleted BOOLEAN DEFAULT FALSE` and `deleted_at TIMESTAMPTZ`. All RLS policies filter `WHERE NOT is_deleted`. All indexes are partial indexes `WHERE NOT is_deleted`.

3. **Computed readiness score** — `readiness_logs.overall_readiness` is a `GENERATED ALWAYS AS ... STORED` column that auto-computes from the 5 dimensions (sleep, energy, motivation inverted soreness, inverted stress).

4. **Coach notes are strictly private** — `coach_notes` has a single RLS policy: only the coach can see/manage. Athletes never have access.

5. **Auto-profile creation** — A trigger on `auth.users` INSERT auto-creates the `profiles` row with role from user metadata.

6. **PostgreSQL native enums** — Used for role, status, category, difficulty, and message_type fields for type safety at the DB level.

## Consequences
- Schema is more complex than a minimal MVP but supports all Sprint 1-11 features without migrations
- RLS policies use JOINs for inherited access (sessions → programs → coach), which has a minor performance cost offset by indexes
- Soft delete requires all queries to filter `is_deleted`, but this is handled by RLS policies for reads
