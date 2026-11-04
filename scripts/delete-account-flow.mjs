// Real account-deletion flow of the web page (web/delete-account/flow.js) against the LOCAL
// Supabase stack with delete_my_account() installed (never the remote project).
//
//   node scripts/delete-account-flow.mjs
//   EXPIRY_CASE_SECONDS=10 node scripts/delete-account-flow.mjs   # + real code expiry (stack started
//                                                                  #   with [auth.email] otp_expiry = 10)
//
// Needs API_URL, ANON_KEY (and MAILPIT_URL) from the environment, read from `supabase status -o env`
// by the caller (see scripts/recovery-flow.mjs for a PowerShell snippet). Nothing is printed or written
// with a key. DB_CONTAINER defaults to the local Postgres container. Every check is an assertion: any
// failure prints FAIL and exits with code 1.
//
// Scenario: an account with a program, a session and a logged set, plus a control account with the same
// data. Wrong code -> nothing deleted. Right code -> zero rows for the account in every table it owns,
// control account untouched, sign-in refused. Optionally an expired code -> nothing deleted.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const flow = require("../web/delete-account/flow.js");

const API = process.env.API_URL;
const ANON = process.env.ANON_KEY;
const MAIL = `${process.env.MAILPIT_URL ?? "http://127.0.0.1:54324"}/api/v1`;
if (!API || !ANON) throw new Error("API_URL / ANON_KEY missing: load them from `supabase status -o env`");
const cfg = { url: API, anonKey: ANON };
const H = { apikey: ANON, "content-type": "application/json" };
const DB =
  process.env.DB_CONTAINER ??
  execFileSync("docker", ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"], { encoding: "utf8" })
    .split(/\r?\n/)[0];
const PASSWORD = "motdepasse8";
const stamp = Date.now();
const out = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
const failures = [];
const check = (name, ok, detail = "") => {
  out[`check:${name}`] = ok ? "ok" : `FAIL ${detail}`;
  if (!ok) failures.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) =>
  execFileSync("docker", ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-tAc", q], { encoding: "utf8" }).trim();

async function signup(label) {
  const email = `${label}${stamp}@cadence.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email, password: PASSWORD, data: { first_name: "Test", last_name: label, role: "athlete" } }),
  });
  const id = (await r.json()).user?.id;
  return { email, id };
}

// A program, a session, an exercise and one logged set for the user.
function seed(uid) {
  sql(`DO $$ DECLARE ex uuid := gen_random_uuid(); p uuid := gen_random_uuid(); s uuid := gen_random_uuid();
    se uuid := gen_random_uuid(); l uuid := gen_random_uuid(); BEGIN
    INSERT INTO exercises(id, created_by, is_public, name) VALUES (ex, '${uid}', FALSE, 'proof ex');
    INSERT INTO programs(id, created_by, name, status) VALUES (p, '${uid}', 'proof p', 'active');
    INSERT INTO sessions(id, program_id, name) VALUES (s, p, 'proof s');
    INSERT INTO session_exercises(id, session_id, exercise_id, order_index) VALUES (se, s, ex, 0);
    INSERT INTO program_assignments(program_id, athlete_id, coach_id, start_date) VALUES (p, '${uid}', NULL, CURRENT_DATE);
    INSERT INTO session_logs(id, session_id, athlete_id, status, completed_at) VALUES (l, s, '${uid}', 'completed', NOW());
    INSERT INTO exercise_logs(session_log_id, exercise_id, set_number, reps_completed, weight_kg) VALUES (l, ex, 1, 5, 40);
  END $$;`);
}

// Row counts of everything the account owns (or can reach through what it owns).
function snapshot(uid) {
  return JSON.parse(
    sql(`SELECT jsonb_build_object(
      'auth_users', (SELECT count(*) FROM auth.users WHERE id = '${uid}'),
      'profiles', (SELECT count(*) FROM public.profiles WHERE id = '${uid}'),
      'exercises', (SELECT count(*) FROM exercises WHERE created_by = '${uid}'),
      'programs', (SELECT count(*) FROM programs WHERE created_by = '${uid}'),
      'sessions', (SELECT count(*) FROM sessions WHERE program_id IN (SELECT id FROM programs WHERE created_by = '${uid}')),
      'program_assignments', (SELECT count(*) FROM program_assignments WHERE athlete_id = '${uid}'),
      'session_logs', (SELECT count(*) FROM session_logs WHERE athlete_id = '${uid}'),
      'exercise_logs', (SELECT count(*) FROM exercise_logs WHERE session_log_id IN (SELECT id FROM session_logs WHERE athlete_id = '${uid}'))
    )::text`)
  );
}
const total = (s) => Object.values(s).reduce((a, b) => a + Number(b), 0);

async function codeFor(email) {
  for (let i = 0; i < 40; i++) {
    const { messages } = await (await fetch(`${MAIL}/messages`)).json();
    const m = messages.find((x) => x.To.some((t) => t.Address === email));
    if (m) {
      const full = await (await fetch(`${MAIL}/message/${m.ID}`)).json();
      return { subject: full.Subject, code: (full.Text || "").match(/\b(\d{6,8})\b/)?.[1] };
    }
    await sleep(500);
  }
  return {};
}

async function main() {
  check("function-installed", sql("SELECT to_regproc('public.delete_my_account') IS NOT NULL") === "t", "apply migration 009 to the LOCAL database first");

  const target = await signup("cible");
  const control = await signup("temoin");
  check("signups", !!target.id && !!control.id);
  seed(target.id);
  seed(control.id);
  const before = snapshot(target.id);
  const controlBefore = snapshot(control.id);
  out.rowsBefore = before;
  check("witness-data-present", Object.values(before).every((n) => Number(n) >= 1), JSON.stringify(before));

  // Request: the page shows the same message for a known and an unknown address (UI level only: the
  // Supabase API itself answers differently, see the PR description).
  const known = await flow.requestCode(cfg, target.email);
  const unknown = await flow.requestCode(cfg, `inconnu${stamp}@cadence.test`);
  check("same-page-message", JSON.stringify(known) === JSON.stringify(unknown));
  const { subject, code } = await codeFor(target.email);
  out.emailSubject = subject ?? null;
  check("code-received", !!code);
  check("email-subject-french", subject === "Ton code de confirmation Cadence", String(subject));

  // Wrong code: refused, nothing deleted.
  const wrong = await flow.confirmDeletion(cfg, target.email, "000000");
  check("wrong-code-refused", !!wrong.error);
  const afterWrong = snapshot(target.id);
  out.rowsAfterWrongCode = afterWrong;
  check("wrong-code-deletes-nothing", JSON.stringify(afterWrong) === JSON.stringify(before), JSON.stringify(afterWrong));

  // Right code: everything of the account is gone, the control account is untouched.
  const done = await flow.confirmDeletion(cfg, target.email, code);
  check("right-code-accepted", done.error === null, String(done.error));
  const after = snapshot(target.id);
  out.rowsAfter = after;
  check("zero-rows-everywhere", total(after) === 0, JSON.stringify(after));
  check("control-account-intact", JSON.stringify(snapshot(control.id)) === JSON.stringify(controlBefore));
  const login = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email: target.email, password: PASSWORD }),
  });
  const loginBody = await login.json();
  out.signInAfter = { status: login.status, code: loginBody.error_code ?? null };
  check("sign-in-refused", login.status === 400 && loginBody.error_code === "invalid_credentials", JSON.stringify(out.signInAfter));

  // Real expiry (stack started with a short otp_expiry): an expired code deletes nothing.
  const wait = Number(process.env.EXPIRY_CASE_SECONDS);
  if (wait > 0) {
    const late = await signup("expire");
    seed(late.id);
    const snap = snapshot(late.id);
    await flow.requestCode(cfg, late.email);
    const { code: lateCode } = await codeFor(late.email);
    check("expiry-code-received", !!lateCode);
    await sleep((wait + 3) * 1000);
    const res = await flow.confirmDeletion(cfg, late.email, lateCode);
    check("expired-code-refused", !!res.error, String(res.error));
    check("expired-code-deletes-nothing", JSON.stringify(snapshot(late.id)) === JSON.stringify(snap));
    out.expiredWaitedSeconds = wait + 3;
  } else {
    out.expiry = "not run (set EXPIRY_CASE_SECONDS and start the stack with a short otp_expiry)";
  }
}

try {
  await main();
} catch (e) {
  check("no-exception", false, String(e));
}
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
if (failures.length) {
  process.stderr.write(`FAIL: ${failures.join(", ")}\n`);
  process.exit(1);
}
process.stdout.write("OK: all checks passed\n");
