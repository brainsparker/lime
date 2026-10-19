import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForRichRestoreSnapshot } from "./claw-chat-current-fixture-inputbar-rich-restore.mjs";
import { SESSION_ID } from "./claw-chat-current-fixture-constants.mjs";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("rich restore canonical skill observation", () => {
  it.each([
    {
      name: "capability-report",
      displayName: "Capability Report",
      active: true,
    },
    { name: "capability-report", displayName: "能力报告", active: true },
    {
      name: "capabilityreport",
      displayName: "Capability Report",
      active: false,
    },
    { name: "other", displayName: "capability-report", active: false },
  ])(
    "uses canonical $name independently of $displayName",
    async ({ name, displayName, active }) => {
      const host = document.createElement("div");
      host.dataset.testid = "inputbar-core-container";
      const editor = document.createElement("div");
      editor.dataset.testid = "composer-editor";
      editor.dataset.sessionId = SESSION_ID;
      editor.setAttribute("role", "textbox");
      editor.setAttribute("contenteditable", "true");
      const token = document.createElement("span");
      token.dataset.composerToken = "skill";
      token.dataset.composerName = name;
      token.dataset.composerLabel = `$${name}`;
      token.dataset.composerDisplayName = displayName;
      token.setAttribute("contenteditable", "false");
      token.textContent = displayName;
      editor.append(token);
      host.append(editor);
      document.body.append(host);
      vi.spyOn(editor, "getClientRects").mockReturnValue([{}]);
      vi.spyOn(editor, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 100, 80),
      );
      const page = { evaluate: async (fn, arg) => fn(arg) };
      const snapshot = await waitForRichRestoreSnapshot(
        page,
        { timeoutMs: 100, intervalMs: 1 },
        () => true,
        "observe canonical skill",
      );
      expect(snapshot.editorCount).toBe(1);
      expect(snapshot.editorText).toBe(`$${name}`);
      expect(snapshot.skillRestored).toBe(active);
      expect(snapshot.skillTokenData[0]).toMatchObject({
        name,
        displayName,
        renderedText: displayName,
        label: `$${name}`,
      });
    },
  );
});
