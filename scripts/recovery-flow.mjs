// Real password-recovery flow against the LOCAL Supabase stack (never the remote project).
//
//   node scripts/recovery-flow.mjs                      # normal flow
//   EXPIRY_CASE_SECONDS=10 node scripts/recovery-flow.mjs   # + real expiry (stack started with
//                                                            #   [auth.email] otp_expiry = 10)
//
// No key lives in this file: the API URL, the anon key and the mailbox URL come from the
// environment (API_URL, ANON_KEY, MAILPIT_URL) or, failing that, from `supabase status -o env`
// at run time. Nothing read from there is printed or written; link tokens are redacted.
// PowerShell, to load them without printing them:
//   foreach ($l in (pnpm dlx supabase status -o env)) { if ($l -match '^(API_URL|ANON_KEY|MAILPIT_URL)="?([^"]+)') { Set-Item "env:$($Matches[1])" $Matches[2] } }
// Every check is an assertion: any failure prints FAIL and exits with code 1.
import { execSync, spawnSync } from "node:child_process";

function fromStatus() {
  try {
    return readStatus();
  } catch {
    return {};
  }
}

function readStatus() {
  // Exit code 3 only means "optional services stopped" (imgproxy, pooler): stdout is still valid.
  // The CLI sometimes prints nothing while a container restarts (vector does on Windows): retry.
  let raw = "";
  for (let i = 0; i < 4 && !raw; i++) {
    raw = spawnSync("pnpm dlx supabase status -o env", { shell: true, encoding: "utf8" }).stdout ?? "";
  }
  const get = (k) => raw.split(/\r?\n/).find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).replace(/^"|"$/g, "");
  return { API_URL: get("API_URL"), ANON_KEY: get("ANON_KEY"), MAILPIT_URL: get("MAILPIT_URL") };
}
const env = process.env.API_URL && process.env.ANON_KEY ? process.env : { ...fromStatus(), ...process.env };
const API = env.API_URL;
const MAIL = `${env.MAILPIT_URL ?? "http://127.0.0.1:54324"}/api/v1`;
if (!API || !env.ANON_KEY) throw new Error("API_URL / ANON_KEY unavailable: is the local stack running? (see the PowerShell snippet at the top of this file)");
const H = { apikey: env.ANON_KEY, "content-type": "application/json" };

const stamp = Date.now();
const known = `recup${stamp}@cadence.test`;
const unknown = `inconnu${stamp}@cadence.test`;
const OLD = "ancienmdp1";
const NEW = "nouveaumdp2";
const REDIRECT = "cadence://reset-password";
const redact = (s) => s.replace(/(access_token|refresh_token)=[^&]+/g, "$1=<redacted>");
const out = { commit: execSync("git rev-parse HEAD").toString().trim() };
const failures = [];
const check = (name, ok, detail = "") => {
  out[`check:${name}`] = ok ? "ok" : `FAIL ${detail}`;
  if (!ok) failures.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function recover(email) {
  const t = Date.now();
  const r = await fetch(`${API}/auth/v1/recover?redirect_to=${encodeURIComponent(REDIRECT)}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email }),
  });
  return { status: r.status, body: await r.text(), ms: Date.now() - t };
}

async function waitMail(email, pattern) {
  for (let i = 0; i < 40; i++) {
    const { messages } = await (await fetch(`${MAIL}/messages`)).json();
    const m = messages.find((x) => x.To.some((t) => t.Address === email) && pattern.test(x.Subject));
    if (m) return m;
    await sleep(500);
  }
  return null;
}

async function linkOf(msg) {
  const full = await (await fetch(`${MAIL}/message/${msg.ID}`)).json();
  return { full, link: full.HTML.match(/href="([^"]+)"/)[1].replace(/&amp;/g, "&") };
}

async function signup(email) {
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email, password: OLD, data: { first_name: "Test", last_name: "Recup", role: "athlete" } }),
  });
  return r;
}

async function main() {
  check("signup", (await signup(known)).status === 200);

  // 1. Request: same answer for a known and an unknown address; mail only for the known one.
  const t0 = Date.now();
  const rk = await recover(known);
  const ru = await recover(unknown);
  check("recover-same-status-and-body", rk.status === ru.status && rk.body === ru.body, `${rk.status}/${ru.status}`);
  out.recoverLatencyMs = { known: rk.ms, unknown: ru.ms }; // observed only (timing is not asserted)

  const msg = await waitMail(known, /mot de passe/i);
  check("mail-received", !!msg);
  if (!msg) return;
  out.receivedAfterMs = Date.now() - t0;
  check("mail-under-5-minutes", out.receivedAfterMs < 5 * 60 * 1000);
  const { full, link } = await linkOf(msg);
  out.sender = full.From.Address; // real Cadence sender: blocked by the Cadence domain (Ralph)
  check("mail-french-subject", /^Réinitialise ton mot de passe Cadence$/.test(full.Subject), full.Subject);
  check("mail-html-lang-fr", /<html lang="fr"/.test(full.HTML));
  const { messages } = await (await fetch(`${MAIL}/messages`)).json();
  check("no-mail-to-unknown", !messages.some((m) => m.To.some((t) => t.Address === unknown)));

  // 2. First use: redirect to the app destination with recovery tokens in the fragment.
  const first = await fetch(link, { redirect: "manual" });
  const loc = first.headers.get("location") ?? "";
  out.firstUse = { status: first.status, location: redact(loc) };
  check("first-use-redirects-to-app", first.status === 303 && loc.startsWith(`${REDIRECT}#`), loc.slice(0, 40));
  const tok = new URLSearchParams(loc.split("#")[1] ?? "");
  check("first-use-recovery-tokens", !!tok.get("access_token") && !!tok.get("refresh_token") && tok.get("type") === "recovery");

  // 3. New password works, old one does not.
  const put = await fetch(`${API}/auth/v1/user`, {
    method: "PUT",
    headers: { ...H, authorization: `Bearer ${tok.get("access_token")}` },
    body: JSON.stringify({ password: NEW }),
  });
  check("password-updated", put.status === 200, String(put.status));
  const login = async (p) =>
    (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: H, body: JSON.stringify({ email: known, password: p }) })).status;
  check("login-new-password", (await login(NEW)) === 200);
  check("login-old-password-refused", (await login(OLD)) === 400);

  // 4. Second use of the same link is refused.
  const second = await fetch(link, { redirect: "manual" });
  const loc2 = second.headers.get("location") ?? "";
  out.secondUse = { status: second.status, location: redact(loc2) };
  check("second-use-refused", /error_code=otp_expired/.test(loc2) && !/access_token/.test(loc2), loc2.slice(0, 60));

  // 5. Real expiry (only when the stack was started with a short otp_expiry).
  const wait = Number(env.EXPIRY_CASE_SECONDS);
  if (wait > 0) {
    const exp = `expire${stamp}@cadence.test`;
    await signup(exp);
    await recover(exp);
    const m = await waitMail(exp, /mot de passe/i);
    check("expiry-mail-received", !!m);
    if (m) {
      const { link: l } = await linkOf(m);
      await sleep((wait + 3) * 1000);
      const late = await fetch(l, { redirect: "manual" });
      const locL = late.headers.get("location") ?? "";
      out.expiredUse = { waitedSeconds: wait + 3, status: late.status, location: redact(locL) };
      check("expired-link-refused", /error_code=otp_expired/.test(locL) && !/access_token/.test(locL), locL.slice(0, 60));
    }
  } else {
    out.expiry = "not run (set EXPIRY_CASE_SECONDS and start the stack with a short otp_expiry)";
  }

  // 6. Observed only: what the Supabase API itself reveals about an account (client cannot hide it).
  const dup = await signup(known);
  out.apiEnumerationObserved = {
    signupExistingAddress: { status: dup.status, code: (await dup.json()).error_code ?? null },
    otpKnown: await otpProbe(known),
    otpUnknown: await otpProbe(unknown),
  };
}

async function otpProbe(email) {
  const t = Date.now();
  const r = await fetch(`${API}/auth/v1/otp`, { method: "POST", headers: H, body: JSON.stringify({ email, create_user: false }) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, code: j.error_code ?? null, ms: Date.now() - t };
}

try {
  await main();
} catch (e) {
  check("no-exception", false, String(e));
}
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
if (failures.length) {
  console.error(`FAIL: ${failures.join(", ")}`);
  process.exit(1);
}
process.stdout.write("OK: all checks passed\n");
