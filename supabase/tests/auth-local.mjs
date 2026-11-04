// Manual check of story 2.1 against the LOCAL Supabase stack. Not run in CI (needs `supabase start`).
//
//   $env:API_URL = "<API URL from supabase status>"; $env:ANON_KEY = "<anon key from supabase status>"
//   node supabase/tests/auth-local.mjs
//
// The keys are read from the environment and never printed. Test addresses end in
// @cadence.test; the local Mailpit (port 54324) receives the emails.
const API = process.env.API_URL;
const KEY = process.env.ANON_KEY;
if (!API || !KEY) throw new Error("Set API_URL and ANON_KEY (from `supabase status -o env`).");
const MAIL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324/api/v1";
const H = { apikey: KEY, "content-type": "application/json" };
const stamp = Date.now();
const out = {};

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

async function roleAfterReconnect(email, password, role) {
  const created = await signUp(email, password, role);
  const mail = await mailTo(email);
  const early = await post("/auth/v1/token?grant_type=password", { email, password });
  const link = mail?.HTML.match(/href="([^"]+)"/)?.[1].replace(/&amp;/g, "&");
  if (link) await fetch(link, { redirect: "manual" });
  const login = await post("/auth/v1/token?grant_type=password", { email, password });
  const token = login.body.access_token;
  const profile = token
    ? await (await fetch(`${API}/rest/v1/profiles?select=role&id=eq.${login.body.user.id}`, {
        headers: { apikey: KEY, authorization: `Bearer ${token}` },
      })).json()
    : null;
  return {
    signUpStatus: created.status,
    confirmationEmail: mail ? { subject: mail.Subject, to: email } : null,
    loginBeforeConfirmation: early.body.error_code ?? early.status,
    loginAfterConfirmation: login.status,
    roleRequested: role,
    roleStoredInProfiles: profile?.[0]?.role ?? null,
  };
}

out.password7 = await signUp(`court${stamp}@cadence.test`, "1234567", "athlete").then((r) => ({
  status: r.status,
  code: r.body.error_code ?? null,
}));
out.password8Coach = await roleAfterReconnect(`coach${stamp}@cadence.test`, "motdepasse8", "coach");
out.password8Athlete = await roleAfterReconnect(`athlete${stamp}@cadence.test`, "motdepasse8", "athlete");

// Same address a second time: what does the public see?
const again = await signUp(`coach${stamp}@cadence.test`, "motdepasse8", "coach");
out.alreadyRegisteredSignUp = { status: again.status, error: again.body.error_code ?? null };

// eslint-disable-next-line no-console -- manual script, its only output is the report
console.log(JSON.stringify(out, null, 2));
