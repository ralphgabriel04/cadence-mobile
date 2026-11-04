/* eslint-disable -- plain browser script (ES5 style, loaded by a <script> tag), outside the app bundle */
/* Account-deletion request flow for the public web page (story 2.6 c).
 * Two steps, no server code of our own: Supabase emails a one-time code to the
 * address; the person types it; that short session calls public.delete_my_account().
 * Works as a plain script in the browser (window.CadenceDeletion) and as a CommonJS
 * module in tests. Only the PUBLIC anon key is used; it comes from config.js. */
(function (root) {
  var NEUTRAL =
    "Si un compte existe pour ce courriel, un code de confirmation vient d'être envoyé. Vérifie ta boîte de réception.";

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function headers(cfg, extra) {
    return Object.assign({ apikey: cfg.anonKey, "content-type": "application/json" }, extra || {});
  }

  async function requestCode(cfg, email, fetchImpl) {
    var f = fetchImpl || root.fetch.bind(root);
    var address = String(email || "").trim();
    if (!isEmail(address)) {
      return { error: "Écris ton courriel sous la forme nom@exemple.com.", message: null };
    }
    try {
      var res = await f(cfg.url + "/auth/v1/otp", {
        method: "POST",
        headers: headers(cfg),
        body: JSON.stringify({ email: address, create_user: false }),
      });
      if (res.status === 429) {
        return { error: "Trop de tentatives. Réessaie dans quelques minutes.", message: null };
      }
      // Any other answer (sent, unknown address, signups disabled) reads the same ON THE PAGE.
      // This hides nothing at network level: the Supabase API answers 200 for a known address and
      // 422 otp_disabled for an unknown one. Known limit, decision for Ralph (see the PR).
      return { error: null, message: NEUTRAL };
    } catch (e) {
      return { error: "Connexion impossible. Vérifie ta connexion et réessaie.", message: null };
    }
  }

  async function confirmDeletion(cfg, email, code, fetchImpl) {
    var f = fetchImpl || root.fetch.bind(root);
    var invalid = { error: "Code invalide ou expiré. Demande un nouveau code." };
    try {
      var verify = await f(cfg.url + "/auth/v1/verify", {
        method: "POST",
        headers: headers(cfg),
        body: JSON.stringify({ type: "email", email: String(email).trim(), token: String(code).trim() }),
      });
      if (!verify.ok) return invalid;
      var session = await verify.json();
      if (!session || !session.access_token) return invalid;

      var del = await f(cfg.url + "/rest/v1/rpc/delete_my_account", {
        method: "POST",
        headers: headers(cfg, { authorization: "Bearer " + session.access_token }),
        body: "{}",
      });
      if (!del.ok) return { error: "La suppression a échoué. Réessaie dans un instant." };
      return { error: null };
    } catch (e) {
      return { error: "Connexion impossible. Vérifie ta connexion et réessaie." };
    }
  }

  var api = { requestCode: requestCode, confirmDeletion: confirmDeletion, NEUTRAL: NEUTRAL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CadenceDeletion = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
