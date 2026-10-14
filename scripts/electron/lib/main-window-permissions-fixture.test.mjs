import { describe, expect, it } from "vitest";
import { runMainWindowClipboardPermissionQueryGate } from "./main-window-permissions-fixture.mjs";

const passing = () => ({
  mode: "native-permissions-api-query",
  mainFrame: { secureContext: true, write: "granted", read: "denied" },
  childFrame: { secureContext: true, write: "denied", read: "denied" },
  childFrameRemoved: true,
});
const page = (facts) => ({ evaluate: async () => facts });

describe("installed main-window clipboard permission query gate", () => {
  it("accepts only secure main writes and rejects reads and child access", async () => {
    const facts = passing();
    facts.privateClipboard = "PRIVATE CLIPBOARD";
    const proof = await runMainWindowClipboardPermissionQueryGate(page(facts));
    expect(proof).toMatchObject({
      mainFrame: { write: "granted", read: "denied" },
      childFrame: { write: "denied", read: "denied" },
      requestPermissionClaim: false,
      clipboardContentRead: false,
    });
    expect(JSON.stringify(proof)).not.toContain("PRIVATE");
  });

  it.each([
    ["main write blocked", (f) => (f.mainFrame.write = "denied")],
    ["main read allowed", (f) => (f.mainFrame.read = "granted")],
    ["child write allowed", (f) => (f.childFrame.write = "granted")],
    ["child read allowed", (f) => (f.childFrame.read = "granted")],
    ["insecure main context", (f) => (f.mainFrame.secureContext = false)],
    ["insecure child context", (f) => (f.childFrame.secureContext = false)],
    ["missing child cleanup", (f) => (f.childFrameRemoved = false)],
    ["unknown permission state", (f) => (f.mainFrame.read = "PRIVATE ERROR")],
  ])("rejects %s", async (_name, change) => {
    const facts = passing();
    change(facts);
    await expect(
      runMainWindowClipboardPermissionQueryGate(page(facts)),
    ).rejects.toThrow("Installed clipboard check policy failed");
  });

  it("preserves a native query failure", async () => {
    const failure = new Error("native query failed");
    await expect(
      runMainWindowClipboardPermissionQueryGate({
        evaluate: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
  });
});
