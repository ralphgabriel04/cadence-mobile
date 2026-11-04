-- ============================================================================
-- 94 -- Isolation, part 2 (cm#153): write-side holes fixed by 011, then the
-- remaining athlete tables. Reuses the iso_* helpers and fixtures of 92_.
-- ============================================================================
INSERT INTO iso_ids
SELECT k, md5('iso:' || k)::uuid
  FROM unnest(ARRAY['SXA','SXB','RA','RB','CVA','CVB','MA','MB','IA','IB','NA','NB']) AS k;

-- Parents from 92_, re-created if a (deliberately broken) run let an attack delete them.
INSERT INTO exercises (id, is_public, name) VALUES (iso_id('X'), TRUE, 'iso exercise') ON CONFLICT DO NOTHING;
INSERT INTO programs (id, created_by, name, status) VALUES
  (iso_id('PA'), iso_id('A'), 'iso PA', 'active'), (iso_id('PB'), iso_id('B'), 'iso PB', 'active') ON CONFLICT DO NOTHING;
INSERT INTO sessions (id, program_id, name) VALUES
  (iso_id('SA'), iso_id('PA'), 'iso SA'), (iso_id('SB'), iso_id('PB'), 'iso SB') ON CONFLICT DO NOTHING;
INSERT INTO session_logs (id, session_id, athlete_id, status, completed_at) VALUES
  (iso_id('LA'), iso_id('SA'), iso_id('A'), 'completed', NOW()),
  (iso_id('LB'), iso_id('SB'), iso_id('B'), 'completed', NOW()) ON CONFLICT DO NOTHING;
INSERT INTO session_exercises (id, session_id, exercise_id, order_index) VALUES
  (iso_id('SXA'), iso_id('SA'), iso_id('X'), 0), (iso_id('SXB'), iso_id('SB'), iso_id('X'), 0);
INSERT INTO readiness_logs (id, athlete_id) VALUES (iso_id('RA'), iso_id('A')), (iso_id('RB'), iso_id('B'));
INSERT INTO conversations (id, coach_id, athlete_id) VALUES
  (iso_id('CVA'), iso_id('K'), iso_id('A')), (iso_id('CVB'), iso_id('K'), iso_id('B'));
INSERT INTO messages (id, conversation_id, sender_id, content) VALUES
  (iso_id('MA'), iso_id('CVA'), iso_id('A'), 'iso a'), (iso_id('MB'), iso_id('CVB'), iso_id('B'), 'iso b');
INSERT INTO session_images (id, session_log_id, athlete_id, image_url) VALUES
  (iso_id('IA'), iso_id('LA'), iso_id('A'), 'https://example.test/a.jpg'),
  (iso_id('IB'), iso_id('LB'), iso_id('B'), 'https://example.test/b.jpg');
INSERT INTO coach_notes (id, coach_id, athlete_id, content) VALUES
  (iso_id('NA'), iso_id('K'), iso_id('A'), 'iso note a'), (iso_id('NB'), iso_id('K'), iso_id('B'), 'iso note b');

CREATE TABLE iso_base AS SELECT max(n) AS n FROM iso_cases;
\o /dev/null
-- write-side holes (migration 011)
SELECT iso_case('programs insert: A plants a program in B''s coach space', 'A', $q$INSERT INTO programs(coach_id,created_by,name,status) VALUES ('{B}','{A}','iso planted','draft')$q$, 'denied');
SELECT iso_case('programs insert: A publishes to the public library', 'A', $q$INSERT INTO programs(created_by,is_public,is_template,name,status) VALUES ('{A}',TRUE,TRUE,'iso pub','draft')$q$, 'denied');
SELECT iso_case('programs update: A publishes own program', 'A', $q$UPDATE programs SET is_public=TRUE, is_template=TRUE WHERE id='{PA2}'$q$, 'denied');
SELECT iso_case('session_logs update: A points own log at a session A cannot see', 'A', $q$UPDATE session_logs SET session_id='{SB}' WHERE id='{LA}'$q$, 'denied');
SELECT iso_case('exercises insert: A publishes to the public library', 'A', $q$INSERT INTO exercises(created_by,is_public,name) VALUES ('{A}',TRUE,'iso pub')$q$, 'denied');
SELECT iso_case('exercises insert: A plants one in B''s coach space', 'A', $q$INSERT INTO exercises(coach_id,created_by,name) VALUES ('{B}','{A}','iso planted')$q$, 'denied');
SELECT iso_case('exercises insert: A publishes through the coach policy', 'A', $q$INSERT INTO exercises(coach_id,created_by,is_public,name) VALUES ('{A}','{A}',TRUE,'iso pub2')$q$, 'denied');
SELECT iso_case('programs insert: A publishes through the coach policy', 'A', $q$INSERT INTO programs(coach_id,created_by,is_public,is_template,name,status) VALUES ('{A}','{A}',TRUE,TRUE,'iso pub2','draft')$q$, 'denied');
-- session_exercises
SELECT iso_case('session_exercises select: A reads own (control)', 'A', $q$SELECT count(*) FROM session_exercises WHERE id='{SXA}'$q$, 'rows=1');
SELECT iso_case('session_exercises select: A reads B''s', 'A', $q$SELECT count(*) FROM session_exercises WHERE id='{SXB}'$q$, 'rows=0');
SELECT iso_case('session_exercises select: anon', 'anon', $q$SELECT count(*) FROM session_exercises$q$, 'blocked');
SELECT iso_case('session_exercises insert: A into own session (control)', 'A', $q$INSERT INTO session_exercises(session_id,exercise_id,order_index) VALUES ('{SA}','{X}',5)$q$, 'rows=1');
SELECT iso_case('session_exercises insert: A into B''s session', 'A', $q$INSERT INTO session_exercises(session_id,exercise_id,order_index) VALUES ('{SB}','{X}',5)$q$, 'denied');
SELECT iso_case('session_exercises insert: anon', 'anon', $q$INSERT INTO session_exercises(session_id,exercise_id,order_index) VALUES ('{SA}','{X}',6)$q$, 'denied');
SELECT iso_case('session_exercises update: A edits B''s', 'A', $q$UPDATE session_exercises SET sets=99 WHERE id='{SXB}'$q$, 'blocked');
SELECT iso_case('session_exercises delete: A deletes B''s', 'A', $q$DELETE FROM session_exercises WHERE id='{SXB}'$q$, 'blocked');
SELECT iso_case('session_exercises delete: anon', 'anon', $q$DELETE FROM session_exercises$q$, 'blocked');
-- readiness_logs
SELECT iso_case('readiness_logs select: A reads own (control)', 'A', $q$SELECT count(*) FROM readiness_logs WHERE id='{RA}'$q$, 'rows=1');
SELECT iso_case('readiness_logs select: A reads B''s', 'A', $q$SELECT count(*) FROM readiness_logs WHERE id='{RB}'$q$, 'rows=0');
SELECT iso_case('readiness_logs select: B reads A''s', 'B', $q$SELECT count(*) FROM readiness_logs WHERE id='{RA}'$q$, 'rows=0');
SELECT iso_case('readiness_logs select: anon', 'anon', $q$SELECT count(*) FROM readiness_logs$q$, 'blocked');
SELECT iso_case('readiness_logs insert: A own (control)', 'A', $q$INSERT INTO readiness_logs(athlete_id,log_date) VALUES ('{A}',CURRENT_DATE+2)$q$, 'rows=1');
SELECT iso_case('readiness_logs insert: A for B', 'A', $q$INSERT INTO readiness_logs(athlete_id,log_date) VALUES ('{B}',CURRENT_DATE+3)$q$, 'denied');
SELECT iso_case('readiness_logs insert: anon', 'anon', $q$INSERT INTO readiness_logs(athlete_id,log_date) VALUES ('{A}',CURRENT_DATE+4)$q$, 'denied');
SELECT iso_case('readiness_logs update: A edits B''s', 'A', $q$UPDATE readiness_logs SET notes='iso hacked' WHERE id='{RB}'$q$, 'blocked');
SELECT iso_case('readiness_logs delete: A deletes B''s', 'A', $q$DELETE FROM readiness_logs WHERE id='{RB}'$q$, 'blocked');
SELECT iso_case('readiness_logs delete: anon', 'anon', $q$DELETE FROM readiness_logs$q$, 'blocked');
-- conversations and messages
SELECT iso_case('conversations select: A reads own (control)', 'A', $q$SELECT count(*) FROM conversations WHERE id='{CVA}'$q$, 'rows=1');
SELECT iso_case('conversations select: A reads B''s', 'A', $q$SELECT count(*) FROM conversations WHERE id='{CVB}'$q$, 'rows=0');
SELECT iso_case('conversations select: B reads A''s', 'B', $q$SELECT count(*) FROM conversations WHERE id='{CVA}'$q$, 'rows=0');
SELECT iso_case('conversations select: anon', 'anon', $q$SELECT count(*) FROM conversations$q$, 'blocked');
SELECT iso_case('conversations insert: A opens a thread between K and B', 'A', $q$INSERT INTO conversations(coach_id,athlete_id) VALUES ('{K}','{B}')$q$, 'denied');
SELECT iso_case('conversations update: A edits B''s', 'A', $q$UPDATE conversations SET last_message_at=NOW() WHERE id='{CVB}'$q$, 'blocked');
SELECT iso_case('conversations delete: A deletes own (no API delete)', 'A', $q$DELETE FROM conversations WHERE id='{CVA}'$q$, 'blocked');
SELECT iso_case('messages select: A reads own thread (control)', 'A', $q$SELECT count(*) FROM messages WHERE id='{MA}'$q$, 'rows=1');
SELECT iso_case('messages select: A reads B''s thread', 'A', $q$SELECT count(*) FROM messages WHERE id='{MB}'$q$, 'rows=0');
SELECT iso_case('messages select: anon', 'anon', $q$SELECT count(*) FROM messages$q$, 'blocked');
SELECT iso_case('messages insert: A in own thread (control)', 'A', $q$INSERT INTO messages(conversation_id,sender_id,content) VALUES ('{CVA}','{A}','iso hi')$q$, 'rows=1');
SELECT iso_case('messages insert: A in B''s thread', 'A', $q$INSERT INTO messages(conversation_id,sender_id,content) VALUES ('{CVB}','{A}','iso intruder')$q$, 'denied');
SELECT iso_case('messages insert: A writes as the coach', 'A', $q$INSERT INTO messages(conversation_id,sender_id,content) VALUES ('{CVA}','{K}','iso spoof')$q$, 'denied');
SELECT iso_case('messages update: A edits B''s message', 'A', $q$UPDATE messages SET content='iso hacked' WHERE id='{MB}'$q$, 'blocked');
SELECT iso_case('messages delete: A deletes B''s message', 'A', $q$DELETE FROM messages WHERE id='{MB}'$q$, 'blocked');
-- session_images
SELECT iso_case('session_images select: A reads own (control)', 'A', $q$SELECT count(*) FROM session_images WHERE id='{IA}'$q$, 'rows=1');
SELECT iso_case('session_images select: A reads B''s', 'A', $q$SELECT count(*) FROM session_images WHERE id='{IB}'$q$, 'rows=0');
SELECT iso_case('session_images select: anon', 'anon', $q$SELECT count(*) FROM session_images$q$, 'blocked');
SELECT iso_case('session_images insert: A on B''s workout', 'A', $q$INSERT INTO session_images(session_log_id,athlete_id,image_url) VALUES ('{LB}','{A}','https://example.test/x.jpg')$q$, 'denied');
SELECT iso_case('session_images update: A edits B''s', 'A', $q$UPDATE session_images SET caption='iso hacked' WHERE id='{IB}'$q$, 'blocked');
SELECT iso_case('session_images delete: A deletes B''s', 'A', $q$DELETE FROM session_images WHERE id='{IB}'$q$, 'blocked');
-- coach_notes and coach_athletes
SELECT iso_case('coach_notes select: coach K reads own note (control)', 'K', $q$SELECT count(*) FROM coach_notes WHERE id='{NA}'$q$, 'rows=1');
SELECT iso_case('coach_notes select: A cannot read the coach''s private note', 'A', $q$SELECT count(*) FROM coach_notes WHERE id='{NA}'$q$, 'rows=0');
SELECT iso_case('coach_notes select: A cannot read the note about B', 'A', $q$SELECT count(*) FROM coach_notes WHERE id='{NB}'$q$, 'rows=0');
SELECT iso_case('coach_notes select: anon', 'anon', $q$SELECT count(*) FROM coach_notes$q$, 'blocked');
SELECT iso_case('coach_notes insert: A writes a note about B', 'A', $q$INSERT INTO coach_notes(coach_id,athlete_id,content) VALUES ('{A}','{B}','iso note')$q$, 'denied');
SELECT iso_case('coach_notes update: A edits the note about A', 'A', $q$UPDATE coach_notes SET content='iso hacked' WHERE id='{NA}'$q$, 'blocked');
SELECT iso_case('coach_notes delete: A deletes the note about A', 'A', $q$DELETE FROM coach_notes WHERE id='{NA}'$q$, 'blocked');
SELECT iso_case('coach_athletes select: A reads own link (control)', 'A', $q$SELECT count(*) FROM coach_athletes WHERE athlete_id='{A}'$q$, 'rows=1');
SELECT iso_case('coach_athletes select: B reads A''s link', 'B', $q$SELECT count(*) FROM coach_athletes WHERE athlete_id='{A}'$q$, 'rows=0');
SELECT iso_case('coach_athletes select: anon', 'anon', $q$SELECT count(*) FROM coach_athletes$q$, 'blocked');
SELECT iso_case('coach_athletes insert: B makes self coach of A, active', 'B', $q$INSERT INTO coach_athletes(coach_id,athlete_id,status) VALUES ('{B}','{A}','active')$q$, 'denied');
SELECT iso_case('coach_athletes update: B edits A''s link', 'B', $q$UPDATE coach_athletes SET notes='iso hacked' WHERE athlete_id='{A}'$q$, 'blocked');
SELECT iso_case('coach_athletes delete: B deletes A''s link', 'B', $q$DELETE FROM coach_athletes WHERE athlete_id='{A}'$q$, 'blocked');

\o
DO $$
DECLARE c RECORD; got TEXT; ok BOOLEAN;
BEGIN
  FOR c IN SELECT * FROM iso_cases WHERE n > (SELECT n FROM iso_base) ORDER BY n LOOP
    got := iso_run(c.role, (SELECT id FROM iso_ids WHERE key = c.uid_key), c.sql);
    ok := CASE c.expect WHEN 'blocked' THEN got IN ('rows=0', 'err=42501')
                        WHEN 'denied' THEN got = 'err=42501' ELSE got = c.expect END;
    PERFORM rec('ISO ' || c.name, ok, format('got %s, wanted %s', got, c.expect));
  END LOOP;
END $$;
