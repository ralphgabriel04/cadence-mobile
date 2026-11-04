#!/usr/bin/env bash
# ============================================================================
# Negative control for the isolation suite (cm#153, criterion 3).
#
# Breaks one protection at a time in the disposable container; the suite must FAIL
# on an ISO test each time, else exit 1. Not part of CI. Never touches Supabase.
# A lone UPDATE/DELETE policy with USING (true) is no break (SELECT policies also
# apply to the rows touched), so such breaks use FOR ALL.
# ============================================================================
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

declare -a NAMES SQLS
add() { NAMES+=("$1"); SQLS+=("$2"); }

add "drop the own-profile read policy and open profiles to every account" \
  'DROP POLICY "Users can read their own profile" ON profiles; CREATE POLICY leak ON profiles FOR SELECT TO authenticated USING (true);'
add "replace the session_logs read policy by USING (true)" \
  'DROP POLICY "Athletes can read their session logs" ON session_logs; CREATE POLICY leak ON session_logs FOR SELECT TO authenticated USING (true);'
add "open exercise_logs to everyone (FOR ALL USING true)" \
  'CREATE POLICY leak ON exercise_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);'
add "let anon read programs" \
  'CREATE POLICY leak ON programs FOR SELECT TO anon USING (true);'
add "disable row level security on sessions" \
  'ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;'
add "replace the session_logs delete policy by FOR ALL USING (true)" \
  'DROP POLICY "Athletes can delete their session logs" ON session_logs; CREATE POLICY leak ON session_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);'
add "remove the trigger that freezes assignment keys (forged-assignment read leak)" \
  'DROP TRIGGER program_assignments_freeze_keys ON program_assignments;'
add "restore the old coach FOR ALL policy on program_assignments (any coach_id accepted)" \
  'CREATE POLICY old_coach ON program_assignments FOR ALL TO authenticated USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);'
add "restore the old session_images policy (image on someone else's workout)" \
  'CREATE POLICY old_img ON session_images FOR ALL TO authenticated USING (auth.uid() = athlete_id) WITH CHECK (auth.uid() = athlete_id);'
add "restore the old programs creator policy (publish to library)" \
  'CREATE POLICY old_pub ON programs FOR ALL TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);'

missed=0
for i in "${!NAMES[@]}"; do
  f="$TMP/break_$i.sql"
  printf '%s\n' "${SQLS[$i]}" > "$f"
  echo "=== BREAK $((i+1)): ${NAMES[$i]}"
  out="$(POST_MIGRATION_SQL="$f" bash "$HERE/run.sh" 2>&1)"
  rc=$?
  echo "$out" | grep -E 'FAIL \| ISO' | sed 's/  */ /g' | head -5
  if [ $rc -ne 0 ] && echo "$out" | grep -qE 'FAIL \| ISO'; then
    echo "--- detected (exit $rc)"
  else
    echo "--- NOT DETECTED (exit $rc): the suite would let this leak through"
    missed=$((missed+1))
  fi
done

if [ "$missed" -ne 0 ]; then echo "NEGATIVE CONTROL FAILED: $missed break(s) not detected" >&2; exit 1; fi
echo "Negative control OK: all ${#NAMES[@]} breaks were detected."
