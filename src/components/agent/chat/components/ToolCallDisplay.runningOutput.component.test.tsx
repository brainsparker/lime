import { act } from "react";
import { describe, expect, it } from "vitest";
import type { AgentToolCallState } from "@/lib/api/agentProtocol";
import { changeLimeLocale } from "@/i18n/createI18n";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { renderTool } from "./ToolCallDisplay.testFixtures";

const runningCommand = (output: string): AgentToolCallState => ({
  id: "command-live-output",
  name: "exec_command",
  arguments: JSON.stringify({ cmd: "Write-Output 'ready'" }),
  status: "running",
  result: { success: true, output },
  startTime: new Date("2026-10-13T00:00:00Z"),
});

describe("ToolCallDisplay running command output", () => {
  it.each([false, true])(
    "运行中可披露真实输出，增长与终态保持披露状态 grouped=%s",
    (grouped) => {
      const original = runningCommand("\u001b[?1h\u001b=ready\r\n");
      const { container, root } = renderTool(original, { grouped });
      const toggle = container.querySelector(
        "button[aria-expanded]",
      ) as HTMLButtonElement;
      expect(toggle).toBeTruthy();
      expect(
        container.querySelector('[data-testid="tool-call-result-panel"]'),
      ).toBeNull();
      act(() => toggle.click());
      const result = () =>
        container.querySelector('[data-testid="tool-call-rendered-result"]');
      expect(result()?.textContent).toContain("ready");
      expect(result()?.textContent).not.toContain("[?1h");
      for (const status of ["running", "completed"] as const) {
        act(() =>
          root.render(
            <ToolCallDisplay
              toolCall={{
                ...original,
                status,
                result: {
                  success: true,
                  output: original.result!.output + "tail\n",
                },
              }}
              grouped={grouped}
            />,
          ),
        );
        expect(result()?.textContent).toContain("tail");
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
      }
      act(() => toggle.click());
      expect(result()).toBeNull();
      expect(original.result?.output).toBe("\u001b[?1h\u001b=ready\r\n");
    },
  );

  it("空输出和未完成控制序列不生成运行中空结果入口", () => {
    for (const output of ["", "\u001b[?1"]) {
      const { container } = renderTool(runningCommand(output));
      expect(container.querySelector("button[aria-expanded]")).toBeNull();
    }
  });

  it("运行中 stdout/stderr 可以展开查看", () => {
    const toolCall = runningCommand("");
    toolCall.result = {
      success: false,
      output: "",
      metadata: { stdout: "\u001b[31mready\u001b[0m", stderr: "diagnostic" },
    };
    const { container } = renderTool(toolCall, { defaultExpanded: true });
    expect(
      container.querySelector(
        '[data-testid="tool-call-command-output-stdout"] pre',
      )?.textContent,
    ).toBe("ready");
    expect(
      container.querySelector(
        '[data-testid="tool-call-command-output-stderr"] pre',
      )?.textContent,
    ).toBe("diagnostic");
  });

  it("运行中不把 success=false 当作最终失败，失败终态仍有失败样式", () => {
    const toolCall = runningCommand("ready");
    toolCall.result!.success = false;
    const { container, root } = renderTool(toolCall, { defaultExpanded: true });
    const result = () =>
      container.querySelector('[data-testid="tool-call-rendered-result"]');
    expect(result()?.classList.contains("border-rose-200")).toBe(false);
    act(() =>
      root.render(
        <ToolCallDisplay
          toolCall={{ ...toolCall, status: "failed" }}
          defaultExpanded
        />,
      ),
    );
    expect(result()?.classList.contains("border-rose-200")).toBe(true);
  });

  it("流式消息中主动收起后，输出增长和完成都不重新打开详情", () => {
    const toolCall = runningCommand("ready");
    const { container, root } = renderTool(toolCall, {
      isMessageStreaming: true,
    });
    const toggle = container.querySelector(
      "button[aria-expanded]",
    ) as HTMLButtonElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    act(() => toggle.click());
    for (const status of ["running", "completed"] as const) {
      act(() =>
        root.render(
          <ToolCallDisplay
            toolCall={{
              ...toolCall,
              status,
              result: { success: true, output: "ready\ntail" },
            }}
            isMessageStreaming
          />,
        ),
      );
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(
        container.querySelector('[data-testid="tool-call-result-panel"]'),
      ).toBeNull();
    }
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
    "%s 复用现有披露文案，恢复运行中输出",
    async (locale) => {
      await changeLimeLocale(locale);
      const { container } = renderTool(runningCommand("restored ready"), {
        defaultExpanded: true,
      });
      const toggle = container.querySelector("button[aria-expanded]");
      expect(toggle?.getAttribute("title")).toBeTruthy();
      expect(toggle?.getAttribute("title")).not.toContain("agentChat.");
      expect(
        container.querySelector('[data-testid="tool-call-rendered-result"]')
          ?.textContent,
      ).toContain("restored ready");
    },
  );
});
