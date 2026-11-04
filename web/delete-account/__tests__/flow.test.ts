// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS browser script, no types
const flow = require("../flow");

const CFG = { url: "http://localhost:54321", anonKey: "anon-test-key" };
const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe("2.6 (c) · web deletion flow", () => {
  describe("requestCode", () => {
    // Critère 4 + anti-énumération : même résultat que le courriel soit inscrit ou non.
    it("gives the same public answer for a known and an unknown address", async () => {
      const known = await flow.requestCode(
        CFG,
        "inscrit@cadence.test",
        jest.fn(async (..._args: unknown[]) => json(200, {}))
      );
      const unknown = await flow.requestCode(
        CFG,
        "inconnu@cadence.test",
        jest.fn(async (..._args: unknown[]) =>
          json(422, { error_code: "otp_disabled", msg: "Signups not allowed for otp" })
        )
      );
      expect(known).toEqual(unknown);
      expect(known.error).toBeNull();
      expect(known.message).toMatch(/Si un compte existe/);
    });

    it("asks Supabase for a code without creating a user", async () => {
      const fetchImpl = jest.fn(async (..._args: unknown[]) => json(200, {}));
      await flow.requestCode(CFG, "a@cadence.test", fetchImpl);
      const [url, init] = fetchImpl.mock.calls[0] as [
        string,
        { body: string; headers: Record<string, string> },
      ];
      expect(url).toBe("http://localhost:54321/auth/v1/otp");
      expect(JSON.parse(init.body)).toEqual({ email: "a@cadence.test", create_user: false });
      expect(init.headers.apikey).toBe("anon-test-key");
    });

    it("reports a rate limit and a network failure", async () => {
      expect(
        (
          await flow.requestCode(CFG, "a@cadence.test", async (..._args: unknown[]) =>
            json(429, {})
          )
        ).error
      ).toMatch(/Trop de tentatives/);
      const down = async () => {
        throw new TypeError("Failed to fetch");
      };
      expect((await flow.requestCode(CFG, "a@cadence.test", down)).error).toMatch(
        /Connexion impossible/
      );
    });

    it("rejects an obviously invalid address before any request", async () => {
      const fetchImpl = jest.fn();
      expect((await flow.requestCode(CFG, "nom@", fetchImpl)).error).toMatch(/courriel/i);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe("confirmDeletion", () => {
    it("verifies the code, then deletes with that session only", async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(json(200, { access_token: "tok-1", user: { id: "u" } }))
        .mockResolvedValueOnce(json(204, null));
      const res = await flow.confirmDeletion(CFG, "a@cadence.test", " 123456 ", fetchImpl);
      expect(res).toEqual({ error: null });
      const [verifyUrl, verifyInit] = fetchImpl.mock.calls[0] as [string, { body: string }];
      expect(verifyUrl).toBe("http://localhost:54321/auth/v1/verify");
      expect(JSON.parse(verifyInit.body)).toEqual({
        type: "email",
        email: "a@cadence.test",
        token: "123456",
      });
      const [rpcUrl, rpcInit] = fetchImpl.mock.calls[1] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(rpcUrl).toBe("http://localhost:54321/rest/v1/rpc/delete_my_account");
      expect(rpcInit.headers.authorization).toBe("Bearer tok-1");
    });

    it("never deletes when the code is wrong or expired", async () => {
      const fetchImpl = jest.fn(async (..._args: unknown[]) =>
        json(403, { error_code: "otp_expired" })
      );
      const res = await flow.confirmDeletion(CFG, "a@cadence.test", "000000", fetchImpl);
      expect(res.error).toMatch(/Code invalide ou expiré/);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("reports a failed deletion", async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(json(200, { access_token: "tok-1" }))
        .mockResolvedValueOnce(json(500, {}));
      expect(
        (await flow.confirmDeletion(CFG, "a@cadence.test", "123456", fetchImpl)).error
      ).toMatch(/échoué/);
    });
  });
});
