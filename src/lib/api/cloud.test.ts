import { expect, it, vi } from "vitest";
import { AppServerClient } from "./appServer";
import { requestCloud } from "./cloud";

it("uses typed cloud RPC without renderer credentials or HTTP", async () => {
  const client = new AppServerClient();
  const exchange = vi.spyOn(client, "exchange");
  const params = {
    path: "/v1/public/tenants/one/client/bootstrap",
    method: "GET" as const,
  };
  const result = {
    status: 200,
    body: { code: 200, data: {} },
    account: {
      type: "cloud",
      baseUrl: "https://cloud.test",
      tenantId: "one",
      userId: "user",
      sessionId: "session",
      email: null,
      displayName: null,
      expiresAt: null,
    },
  };
  exchange.mockResolvedValueOnce([{ id: 1, result }]);
  await expect(requestCloud(params, client)).resolves.toEqual(result);
  expect(exchange).toHaveBeenCalledWith(
    [{ id: 1, method: "cloud/request", params }],
    {},
  );
  exchange.mockRejectedValueOnce(new Error("not logged in"));
  await expect(requestCloud(params, client)).rejects.toThrow("not logged in");
});
