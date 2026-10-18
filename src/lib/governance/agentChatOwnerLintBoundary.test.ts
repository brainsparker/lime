// @vitest-environment node
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: path.join(root, "eslint.config.js"),
});
const filePath = path.join(
  root,
  "src/components/agent/chat/workspace/ownerProbe.ts",
);

async function restricted(source: string) {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.filter(
    (message) => message.ruleId === "no-restricted-imports",
  );
}

describe("current Agent Chat owner import boundary", () => {
  beforeAll(async () => {
    await eslint.calculateConfigForFile(filePath);
  }, 30_000);
  it.each([
    "@/components/agent/chat/hooks/useAgentChat",
    "../hooks/useAgentChat",
    "../hooks/useAgentChat.testUtils",
  ])("admits the current owner and its test fixture: %s", async (specifier) => {
    expect(
      await restricted(
        `import { owner } from "${specifier}"; export { owner };`,
      ),
    ).toEqual([]);
  });
  it.each([
    "@/stores/agentStore",
    "@/components/chat",
    "@/components/general-chat/hooks/useChat",
  ])("keeps retired owner reentry forbidden: %s", async (specifier) => {
    expect(
      await restricted(
        `import { useChat as owner } from "${specifier}"; export { owner };`,
      ),
    ).not.toEqual([]);
  });
});
