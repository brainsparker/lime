import { cloudRequestMock, seedCloudAccount } from "@/test/cloudAccountFixture";
import { expect, it, vi } from "vitest";
import {
  getCloudAccount,
  logoutCloudAccount,
  CloudAccountChangedError,
} from "../cloudAccount";
import {
  requestControlPlane,
  OemCloudControlPlaneError,
} from "./oemCloudControlPlaneRuntime";

const input = {
  tenant: { id: "one" },
  user: { id: "user" },
  session: { id: "session" },
};

it("rejects a response belonging to an account that has been logged out", async () => {
  await seedCloudAccount(input);
  const account = getCloudAccount()!.account;
  let finish!: (response: unknown) => void;
  cloudRequestMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const result = requestControlPlane(
    "/v1/public/tenants/one/client/bootstrap",
    { auth: true },
  );
  const rejected = expect(result).rejects.toBeInstanceOf(
    CloudAccountChangedError,
  );
  await logoutCloudAccount();
  finish({ status: 200, body: { data: { oldUser: true } }, account });
  await rejected;
});

it("preserves HTTP failure status and never calls renderer fetch for authenticated APIs", async () => {
  await seedCloudAccount(input);
  const fetch = vi.spyOn(globalThis, "fetch");
  cloudRequestMock.mockResolvedValueOnce({
    status: 401,
    body: { code: 401, message: "expired" },
    account: getCloudAccount()!.account,
  });
  const request = requestControlPlane(
    "/v1/public/tenants/one/client/bootstrap",
    { auth: true },
  );
  await expect(request).rejects.toBeInstanceOf(OemCloudControlPlaneError);
  await expect(request).rejects.toMatchObject({ status: 401, code: 401 });
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});
