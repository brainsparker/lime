import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/** Preserve a failed terminal's actual state before fixture teardown. */
export async function captureTerminalFailure(page, options, attempt) {
  const diagnostics = {
    attempt,
    capturedAt: new Date().toISOString(),
    monotonicMs: performance.now(),
  };
  try {
    diagnostics.renderer = await page.evaluate(() => ({
      capturedAt: new Date().toISOString(),
      monotonicMs: performance.now(),
      focusedElement: document.activeElement?.className,
      terminals: [
        ...document.querySelectorAll('[data-testid="terminal-tab"]'),
      ].map((node) => ({
        sessionId: node.getAttribute("data-session-id"),
        ready: node.getAttribute("data-ready"),
        visible: node.getBoundingClientRect().width > 0,
        text: node.textContent,
      })),
      commandInvocations: JSON.parse(
        localStorage.getItem("lime_invoke_trace_buffer_v1") || "[]",
      ).filter((entry) =>
        entry.args_preview?.request?.lines?.some((line) => {
          try {
            return JSON.parse(line).method?.startsWith("command/exec");
          } catch {
            return false;
          }
        }),
      ),
    }));
    // Read recent output only after the assertion has failed. A second drain
    // during the scenario could consume events before the product sees them.
    diagnostics.recentOutput = await page.evaluate(async (processId) => {
      const response = await window.electronAPI.invoke(
        "app_server_drain_events",
        {
          request: { includeRecent: true, limit: 1000 },
        },
      );
      return (response.lines || []).flatMap((line) => {
        const message = JSON.parse(line);
        if (
          message.method !== "command/exec/outputDelta" ||
          message.params?.processId !== processId
        )
          return [];
        return [message];
      });
    }, attempt.processId ?? null);
  } catch (error) {
    diagnostics.captureError = String(error);
  }
  if (process.platform !== "win32") {
    try {
      diagnostics.processes = execFileSync(
        "ps",
        ["-axo", "pid,ppid,pgid,tpgid,state,etime,comm"],
        { encoding: "utf8" },
      )
        .split("\n")
        .filter(
          (line, index) =>
            index === 0 ||
            /\/(sh|sleep|app-server)$|Electron\.app\//.test(line),
        );
    } catch (error) {
      diagnostics.processCaptureError = String(error);
    }
  }
  const output = path.join(
    options.evidenceDir,
    `${options.prefix}-terminal-failure-${attempt.marker}.json`,
  );
  fs.writeFileSync(output, JSON.stringify(diagnostics, null, 2) + "\n", {
    flag: "wx",
  });
  return output;
}
