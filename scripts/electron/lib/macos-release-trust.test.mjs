import { describe, expect, it, vi } from "vitest";

import {
  parseDeveloperIdSignatureIdentity,
  verifyCodeSignature,
  verifyMacOSReleaseTrust,
} from "./macos-release-trust.mjs";

const APP_AUTHORITY = "Developer ID Application: Lime Cloud (TEAM123456)";

describe("macOS release trust", () => {
  it("复用严格签名校验供 packaged helper 完整性判断", () => {
    const execFileSyncImpl = vi.fn();
    expect(
      verifyCodeSignature("/Applications/Lime.app", execFileSyncImpl),
    ).toBe(true);
    expect(execFileSyncImpl).toHaveBeenCalledWith(
      "codesign",
      ["--verify", "--strict", "/Applications/Lime.app"],
      { stdio: "ignore" },
    );

    execFileSyncImpl.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });
    expect(
      verifyCodeSignature("/Applications/Lime.app", execFileSyncImpl),
    ).toBe(false);
  });

  it("parses a Developer ID signature identity", () => {
    expect(
      parseDeveloperIdSignatureIdentity(
        `Authority=${APP_AUTHORITY}\nTeamIdentifier=TEAM123456\n`,
        "/Applications/Lime.app",
      ),
    ).toEqual({
      authority: APP_AUTHORITY,
      teamIdentifier: "TEAM123456",
    });
  });

  it("rejects ad-hoc or identity-less signatures", () => {
    expect(() =>
      parseDeveloperIdSignatureIdentity(
        "Signature=adhoc\nTeamIdentifier=not set\n",
        "/Applications/Lime.app",
      ),
    ).toThrow("not Developer ID signed");
  });

  it("requires app/helper team parity, Gatekeeper, and stapling", async () => {
    const execFileSyncImpl = vi.fn();
    const spawnSyncImpl = vi.fn(() => ({
      status: 0,
      stdout: "",
      stderr: `Authority=${APP_AUTHORITY}\nTeamIdentifier=TEAM123456\n`,
    }));

    expect(
      await verifyMacOSReleaseTrust("/Applications/Lime.app", "/helper.app", {
        execFileSyncImpl,
        spawnSyncImpl,
      }),
    ).toMatchObject({
      status: "passed",
      developerId: true,
      gatekeeperAccepted: true,
      stapleValid: true,
      teamIdentifier: "TEAM123456",
    });
    expect(execFileSyncImpl).toHaveBeenCalledWith(
      "spctl",
      [
        "--assess",
        "--type",
        "execute",
        "--verbose=4",
        "/Applications/Lime.app",
      ],
      { stdio: "pipe" },
    );
    expect(execFileSyncImpl).toHaveBeenCalledWith(
      "xcrun",
      ["stapler", "validate", "/Applications/Lime.app"],
      { stdio: "pipe" },
    );
  });

  it("rejects a helper signed by another team", async () => {
    const spawnSyncImpl = vi
      .fn()
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: `Authority=${APP_AUTHORITY}\nTeamIdentifier=TEAM123456\n`,
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr:
          "Authority=Developer ID Application: Other (OTHER12345)\n" +
          "TeamIdentifier=OTHER12345\n",
      });

    await expect(
      verifyMacOSReleaseTrust("/Applications/Lime.app", "/helper.app", {
        execFileSyncImpl: vi.fn(),
        spawnSyncImpl,
      }),
    ).rejects.toThrow("signing teams do not match");
  });

  it("preserves native stapler output and rejects the failed trust check", async () => {
    const failure = Object.assign(
      new Error("Command failed: xcrun stapler validate"),
      {
        status: 68,
        stdout: Buffer.from("The validate action failed! Error 68."),
        stderr: Buffer.from("CloudKit lookup failed"),
      },
    );
    const execFileSyncImpl = vi.fn((command) => {
      if (command === "xcrun") throw failure;
    });
    await expect(
      verifyMacOSReleaseTrust("/Applications/Lime.app", "/helper.app", {
        execFileSyncImpl,
        spawnSyncImpl: vi.fn(() => ({
          status: 0,
          stderr: `Authority=${APP_AUTHORITY}\nTeamIdentifier=TEAM123456\n`,
        })),
      }),
    ).rejects.toThrow(/Error 68\.[\s\S]*CloudKit lookup failed/);
    expect(failure.status).toBe(68);
  });

  it("retries CloudKit validation failures while retaining every trust check", async () => {
    const failure = Object.assign(new Error("Command failed: xcrun"), {
      status: 68,
      stdout: Buffer.from(
        "NSURLErrorDomain Code=-1005\nThe validate action failed! Error 68.",
      ),
    });
    let validations = 0;
    const execFileSyncImpl = vi.fn((command) => {
      if (command === "xcrun" && ++validations < 3) throw failure;
    });
    const sleep = vi.fn().mockResolvedValue();
    await expect(
      verifyMacOSReleaseTrust("/Applications/Lime.app", "/helper.app", {
        execFileSyncImpl,
        spawnSyncImpl: vi.fn(() => ({
          status: 0,
          stderr: `Authority=${APP_AUTHORITY}\nTeamIdentifier=TEAM123456\n`,
        })),
        sleep,
        log: vi.fn(),
      }),
    ).resolves.toMatchObject({ status: "passed", stapleValid: true });
    expect(validations).toBe(3);
    expect(sleep.mock.calls).toEqual([[15_000], [30_000]]);
    expect(execFileSyncImpl.mock.calls.map(([command]) => command)).toEqual([
      "codesign",
      "codesign",
      "spctl",
      "xcrun",
      "xcrun",
      "xcrun",
    ]);
  });

  it("fails closed after the CloudKit validation retry budget", async () => {
    const failure = Object.assign(new Error("Command failed: xcrun"), {
      stdout:
        "NSURLErrorDomain Code=-1005\nThe validate action failed! Error 68.",
    });
    const sleep = vi.fn().mockResolvedValue();
    let validations = 0;
    await expect(
      verifyMacOSReleaseTrust("/Applications/Lime.app", "/helper.app", {
        execFileSyncImpl: vi.fn((command) => {
          if (command === "xcrun") {
            validations += 1;
            throw failure;
          }
        }),
        spawnSyncImpl: vi.fn(() => ({
          status: 0,
          stderr: `Authority=${APP_AUTHORITY}\nTeamIdentifier=TEAM123456\n`,
        })),
        sleep,
        log: vi.fn(),
      }),
    ).rejects.toBe(failure);
    expect(validations).toBe(6);
    expect(sleep).toHaveBeenCalledTimes(5);
  });
});
