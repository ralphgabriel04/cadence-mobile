// Manual check of story 2.1 against the LOCAL Supabase stack. Not run in CI (needs `supabase start`).
//
//   pnpm dlx supabase status -o env      (read API_URL and ANON_KEY from it)
//   $env:API_URL = "<API_URL>"; $env:ANON_KEY = "<ANON_KEY>"
//   node supabase/tests/auth-local.mjs
//
// Exits with a non-zero code if any assertion fails. The keys are read from the environment and
// never printed. Test addresses end in @cadence.test; the local Mailpit (port 54324) receives the emails.
const API = process.env.API_URL;
const KEY = process.env.ANON_KEY;
if (!API || !KEY) {
  console.error("Set API_URL and ANON_KEY (from `supabase status -o env`).");
  process.exit(2);
}
const MAIL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324/api/v1";
const H = { apikey: KEY, "content-type": "application/json" };
const stamp = Date.now();
const PASSWORD_7 = "abcd123";
const PASSWORD_8 = "abcd1234";
const out = {};
const failures = [];

function check(name, ok, detail) {
  // eslint-disable-next-line security/detect-object-injection -- name is a literal chosen in this script
  out[name] = { ok: !!ok, ...(detail === undefined ? {} : { detail }) };
  if (!ok) failures.push(name);
}

const post = async (path, body, headers = H) => {
  const r = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const signUp = (email, password, role) =>
  post("/auth/v1/signup", { email, password, data: { first_name: "Test", last_name: "Local", role } });

async function mailTo(email) {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((s) => setTimeout(s, 500));
    const list = await (await fetch(`${MAIL}/messages`)).json();
    const msg = list.messages.find((m) => m.To.some((t) => t.Address === email));
    if (msg) return fetch(`${MAIL}/message/${msg.ID}`).then((r) => r.json());
  }
  return null;
}

async function accountFlow(label, role) {
  const email = `${label}${stamp}@cadence.test`;
  const created = await signUp(email, PASSWORD_8, role);
  check(`${label}.signUp8Accepted`, created.status === 200, created.status);
  const mail = await mailTo(email);
  check(`${label}.confirmationEmailReceived`, !!mail, mail?.Subject ?? null);
  const early = await post("/auth/v1/token?grant_type=password", { email, password: PASSWORD_8 });
  check(`${label}.loginRefusedBeforeConfirmation`, early.body.error_code === "email_not_confirmed", early.body.error_code);
  const link = mail?.HTML.match(/href="([^"]+)"/)?.[1].replace(/&amp;/g, "&");
  if (link) await fetch(link, { redirect: "manual" });
  const login = await post("/auth/v1/token?grant_type=password", { email, password: PASSWORD_8 });
  check(`${label}.loginAfterConfirmation`, login.status === 200, login.status);
  const rows = login.body.access_token
    ? await (
        await fetch(`${API}/rest/v1/profiles?select=role&id=eq.${login.body.user.id}`, {
          headers: { apikey: KEY, authorization: `Bearer ${login.body.access_token}` },
        })
      ).json()
    : [];
  check(`${label}.roleStoredIsRoleRequested`, rows[0]?.role === role, { requested: role, stored: rows[0]?.role ?? null });
  return email;
}

check("password8IsExactly8Characters", PASSWORD_8.length === 8, PASSWORD_8.length);
check("password7IsExactly7Characters", PASSWORD_7.length === 7, PASSWORD_7.length);

const short = await signUp(`court${stamp}@cadence.test`, PASSWORD_7, "athlete");
check("password7Refused", short.status === 422 && short.body.error_code === "weak_password", {
  status: short.status,
  code: short.body.error_code ?? null,
});

const coachEmail = await accountFlow("coach", "coach");
await accountFlow("athlete", "athlete");

// Known limit (decision for Ralph): the Supabase API itself answers differently for a new and an
// already-registered address, and for an unknown address on /otp. The app shows a neutral message,
// but this cannot be hidden from someone calling the API directly.
const again = await signUp(coachEmail, PASSWORD_8, "coach");
check("enumerationProbe.signUpExistingConfirmed", again.status === 422 && again.body.error_code === "user_already_exists", {
  newAccountStatus: 200,
  existingStatus: again.status,
  existingCode: again.body.error_code ?? null,
});
const otp = await post("/auth/v1/otp", { email: `inconnu${stamp}@cadence.test`, create_user: false });
out["enumerationProbe.otpUnknown"] = { status: otp.status, code: otp.body.error_code ?? null };

// eslint-disable-next-line no-console -- manual script, its only output is the report
console.log(JSON.stringify(out, null, 2));
if (failures.length > 0) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
// eslint-disable-next-line no-console -- manual script
console.log("All checks passed.");
