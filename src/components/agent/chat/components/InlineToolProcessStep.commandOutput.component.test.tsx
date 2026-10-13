import { act } from "react";
import { describe, expect, it } from "vitest";
import { InlineToolProcessStep } from "./InlineToolProcessStep";
import { renderTool } from "./InlineToolProcessStep.testHarness";

describe("InlineToolProcessStep command output", () => {
  it("运行中全文可以展开，ANSI 清理只影响展示，增长与终态保留披露", () => {
    const raw = "\u001b[?1h\u001b=ready\r\n<tag> **literal**";
    const original = {
      id: "inline-command-output",
      name: "exec_command",
      arguments: JSON.stringify({ cmd: "test" }),
      status: "running" as const,
      result: { success: true, output: raw },
      startTime: new Date("2026-10-13T00:00:00Z"),
    };
    const { container, root } = renderTool(original, {
      isMessageStreaming: true,
    });
    const toggle = container.querySelector("[aria-expanded]") as HTMLElement;
    expect(toggle).toBeTruthy();
    expect(container.textContent).not.toContain("[?1h");
    if (toggle.getAttribute("aria-expanded") !== "true")
      act(() => toggle.click());
    const output = () =>
      container.querySelector(
        '[data-testid="inline-tool-process-command-output"]',
      );
    expect(output()?.textContent).toBe("ready\r\n<tag> **literal**");
    for (const status of ["running", "completed"] as const) {
      act(() =>
        root.render(
          <InlineToolProcessStep
            toolCall={{
              ...original,
              status,
              result: { success: true, output: raw + "\ntail" },
            }}
            isMessageStreaming
          />,
        ),
      );
      expect(output()?.textContent).toContain("tail");
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
    }
    expect(original.result.output).toBe(raw);
  });
});
