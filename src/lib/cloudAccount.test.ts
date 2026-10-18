import { accountFixture, seedCloudAccount } from "@/test/cloudAccountFixture";
import { describe, expect, it, vi } from "vitest";
import {
  getCloudAccount,
  subscribeCloudAccount,
  readCloudAccount,
  importCloudAccount,
  logoutCloudAccount,
  setOemCloudBootstrapSnapshot,
  getOemCloudBootstrapSnapshot,
  cloudAccountIdentityVersion,
} from "./cloudAccount";

const session = {
  token: "fixture-secret",
  tenant: { id: "tenant-one" },
  user: { id: "user-one" },
  session: { id: "session-one" },
};

describe("shared cloud account projection", () => {
  it("keeps the identity lifetime across metadata refreshes and advances it on A→B→A", async () => {
    await seedCloudAccount(session);
    const initial = cloudAccountIdentityVersion();
    await readCloudAccount();
    await seedCloudAccount({
      ...session,
      user: { ...session.user, displayName: "Updated profile" },
    });
    expect(cloudAccountIdentityVersion()).toBe(initial);
    await seedCloudAccount({ ...session, user: { id: "other-user" } });
    expect(cloudAccountIdentityVersion()).toBe(initial + 1);
    await seedCloudAccount(session);
    expect(cloudAccountIdentityVersion()).toBe(initial + 2);
    await seedCloudAccount({ ...session, session: { id: "new-session" } });
    expect(cloudAccountIdentityVersion()).toBe(initial + 3);
    await seedCloudAccount(session, "https://another-issuer.test");
    expect(cloudAccountIdentityVersion()).toBe(initial + 4);
    await logoutCloudAccount();
    expect(cloudAccountIdentityVersion()).toBe(initial + 5);
  });

  it("restores only RPC metadata and ignores retired local credentials", async () => {
    localStorage.setItem("lime:oem-cloud-session:v1", JSON.stringify(session));
    await readCloudAccount();
    expect(getCloudAccount()).toBeNull();
    const storage = vi.spyOn(Storage.prototype, "setItem");
    await seedCloudAccount(session);
    expect(getCloudAccount()?.session.user.id).toBe("user-one");
    expect(JSON.stringify(getCloudAccount())).not.toContain(session.token);
    expect(storage).not.toHaveBeenCalled();
    expect(Reflect.get(window, "__LIME_SESSION_TOKEN__")).toBeUndefined();
    storage.mockRestore();
    localStorage.clear();
  });

  it("does not emit account changes for unchanged RPC metadata", async () => {
    await seedCloudAccount(session);
    const listener = vi.fn();
    const dispose = subscribeCloudAccount(listener);
    await readCloudAccount();
    await readCloudAccount();
    expect(listener).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("keeps the verified account when import or logout fails", async () => {
    await seedCloudAccount(session);
    accountFixture.login.mockRejectedValueOnce(
      new Error("rejected credential"),
    );
    await expect(
      importCloudAccount({
        baseUrl: "https://other.test",
        tenantId: "other",
        accessToken: "rejected",
      }),
    ).rejects.toThrow("rejected credential");
    expect(getCloudAccount()?.account.userId).toBe("user-one");
    accountFixture.logout.mockRejectedValueOnce(
      new Error("transport unavailable"),
    );
    await expect(logoutCloudAccount()).rejects.toThrow("transport unavailable");
    expect(getCloudAccount()?.account.userId).toBe("user-one");
    await logoutCloudAccount();
    expect(getCloudAccount()).toBeNull();
  });

  it("does not let an old read restore a logged out account", async () => {
    await seedCloudAccount(session);
    const old = accountFixture.account;
    let finish!: (value: unknown) => void;
    accountFixture.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = readCloudAccount();
    await logoutCloudAccount();
    finish({ account: old, requiresOpenaiAuth: false });
    await pending;
    expect(getCloudAccount()).toBeNull();
  });

  it("drops the account token from bootstrap without removing developer access tokens", async () => {
    const profile = await seedCloudAccount(session);
    setOemCloudBootstrapSnapshot({
      session: profile,
      activeAccessToken: { token: "developer-token" },
    });
    const snapshot = getOemCloudBootstrapSnapshot<{
      session: unknown;
      activeAccessToken: { token: string };
    }>()!;
    expect(JSON.stringify(snapshot.session)).not.toContain(session.token);
    expect(snapshot.activeAccessToken.token).toBe("developer-token");
    await logoutCloudAccount();
    expect(getOemCloudBootstrapSnapshot()).toBeNull();
  });
});
