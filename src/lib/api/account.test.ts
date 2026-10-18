import { describe, expect, it, vi } from "vitest";
import { AppServerClient } from "./appServer";
import { loginAccount, logoutAccount, readAccount } from "./account";

describe("shared account gateway", () => {
  it("uses the typed App Server boundary and propagates rejected credentials", async () => {
    const client = new AppServerClient();
    const exchange = vi.spyOn(client, "exchange");
    const params = {
      type: "cloudAuthTokens" as const,
      baseUrl: "https://cloud.example.test",
      tenantId: "tenant-one",
      accessToken: "fixture-private-token",
    };
    exchange.mockResolvedValueOnce([
      { id: 1, result: { type: "cloudAuthTokens" } },
    ]);
    await expect(loginAccount(params, client)).resolves.toEqual({
      type: "cloudAuthTokens",
    });
    expect(exchange).toHaveBeenLastCalledWith(
      [{ id: 1, method: "account/login/start", params }],
      {},
    );
    exchange.mockResolvedValueOnce([
      { id: 2, result: { account: null, requiresOpenaiAuth: false } },
    ]);
    await expect(readAccount({}, client)).resolves.toEqual({
      account: null,
      requiresOpenaiAuth: false,
    });
    expect(exchange).toHaveBeenLastCalledWith(
      [{ id: 2, method: "account/read", params: {} }],
      {},
    );
    exchange.mockResolvedValueOnce([{ id: 3, result: {} }]);
    await logoutAccount(client);
    expect(exchange).toHaveBeenLastCalledWith(
      [{ id: 3, method: "account/logout" }],
      {},
    );
    exchange.mockRejectedValueOnce(new Error("session rejected"));
    await expect(loginAccount(params, client)).rejects.toThrow(
      "session rejected",
    );
  });
});
