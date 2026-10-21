import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { appServerCallFromPage } from "../mcp-config-fixture-smoke.mjs";
import { isObservedPreloadAppServerResponse } from "./mcp-config-fixture-evidence.mjs";
import { captureTerminalFailure } from "./thread-side-panel-terminal-diagnostics.mjs";
import {
  selectThreadSidePanelTool,
  closeThreadSidePanelTab,
} from "./thread-side-panel-navigation.mjs";

/** 真实键盘输入、匹配的 IPC 结果与 PTY 输出共同证明终端可用。 */
export async function writeThreadSidePanelTerminalMarker(
  page,
  options,
  marker,
  delaySeconds = 0,
) {
  const attempt = {
    marker,
    delaySeconds,
    startedAt: new Date().toISOString(),
    monotonicMs: performance.now(),
    phase: "wait-ready",
  };
  try {
    await page
      .locator('[data-testid="terminal-tab"][data-ready="true"]:visible')
      .waitFor({ state: "visible", timeout: options.timeoutMs });
    const startedAt = await page.evaluate(() => Date.now());
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const expectedOutput = `${marker}_${suffix}`;
    attempt.expectedOutput = expectedOutput;
    attempt.phase = "keyboard-input";
    const input = page
      .locator('[data-testid="terminal-xterm"]:visible')
      .locator(".xterm-helper-textarea");
    // The complete marker is absent from the typed command, so terminal echo cannot pass.
    await input.pressSequentially(
      `${delaySeconds ? `sleep ${delaySeconds}; ` : ""}printf '${marker}_%s\\n' '${suffix}'`,
    );
    await input.press("Enter");
    attempt.phase = "wait-keyboard-rpc";
    const write = await page.waitForFunction(
      (after) => {
        const entries = JSON.parse(
          localStorage.getItem("lime_invoke_trace_buffer_v1") || "[]",
        );
        for (const entry of entries.reverse()) {
          if (
            entry.transport !== "electron-ipc" ||
            entry.status !== "success" ||
            Date.parse(entry.timestamp) < after
          )
            continue;
          for (const line of entry.args_preview?.request?.lines ?? []) {
            const request = JSON.parse(line);
            if (
              request.method === "command/exec/write" &&
              request.params?.processId
            )
              return {
                method: request.method,
                transport: entry.transport,
                status: entry.status,
                processId: request.params.processId,
              };
          }
        }
        return null;
      },
      startedAt,
      { timeout: options.timeoutMs },
    );
    const request = await write.jsonValue();
    attempt.processId = request.processId;
    attempt.phase = "wait-keyboard-output";
    const waitOutput = async (expected) => {
      await page.waitForFunction(
        (expected) => {
          const terminal = [
            ...document.querySelectorAll('[data-testid="terminal-xterm"]'),
          ].find((node) => node.getBoundingClientRect().width > 0);
          return terminal?.textContent?.includes(expected);
        },
        expected,
        { timeout: options.timeoutMs },
      );
    };
    await waitOutput(expectedOutput);
    attempt.phase = "rpc-input";
    const rpcMarker = `${marker}_RPC_${suffix}`;
    const response = await appServerCallFromPage(page, "command/exec/write", {
      processId: request.processId,
      deltaBase64: Buffer.from(
        `printf '${marker}_RPC_%s\\n' '${suffix}'\r`,
      ).toString("base64"),
    });
    assert.equal(
      isObservedPreloadAppServerResponse(
        response.ipcObservation,
        "command/exec/write",
      ),
      true,
      "Terminal write requires a real matching JSON-RPC result",
    );
    assert.deepEqual(response.result, {});
    attempt.phase = "wait-rpc-output";
    await waitOutput(rpcMarker);
    return {
      ...request,
      expectedOutput,
      rpcOutput: rpcMarker,
      rpcObservation: response.ipcObservation,
      rpcResult: response.result,
      actualOutput: await page
        .locator('[data-testid="terminal-xterm"]:visible')
        .textContent(),
      lifetimeMs: (await page.evaluate(() => Date.now())) - startedAt,
    };
  } catch (error) {
    const diagnostic = await captureTerminalFailure(page, options, attempt);
    throw new Error(`${String(error)}; terminal diagnostics: ${diagnostic}`, {
      cause: error,
    });
  }
}

/** 删除旧 Canvas 终端后，验证唯一右侧面 owner 的进程与后台输出。 */
export async function collectThreadSidePanelTerminalEvidence(page, options) {
  const tabs = page.getByTestId("workspace-right-surface-tab-shell");
  assert.equal(await tabs.count(), 0);
  const editor = page.getByTestId("composer-editor");
  const originalDraft = await editor.textContent();
  const editorHandle = await editor.elementHandle();
  const openTerminal = async () => {
    await page.getByTestId("workspace-right-surface-new-tab").click();
    await page
      .locator('[data-testid="side-panel-new-tab-terminal"]:visible')
      .click();
    await page
      .locator('[data-testid="terminal-tab"][data-ready="true"]:visible')
      .waitFor({ timeout: options.timeoutMs });
  };
  await selectThreadSidePanelTool(page, "shell", options.timeoutMs);
  const firstHandle = await page
    .locator('[data-testid="terminal-tab"]:visible')
    .elementHandle();
  const firstTabId = await tabs.getAttribute("id");
  const firstSessionId = await firstHandle.getAttribute("data-session-id");
  const first = await writeThreadSidePanelTerminalMarker(
    page,
    options,
    "LIME_CURRENT_FIRST",
  );
  await openTerminal();
  assert.equal(await tabs.count(), 2);
  const secondHandle = await page
    .locator('[data-testid="terminal-tab"]:visible')
    .elementHandle();
  const secondSessionId = await secondHandle.getAttribute("data-session-id");
  assert.notEqual(firstSessionId, secondSessionId);
  const second = await writeThreadSidePanelTerminalMarker(
    page,
    options,
    "LIME_CURRENT_SECOND",
  );
  assert.notEqual(first.processId, second.processId);
  assert.ok(!second.actualOutput.includes(first.expectedOutput));

  const suffix = crypto.randomUUID().replaceAll("-", "");
  const backgroundMarker = `LIME_CURRENT_BACKGROUND_${suffix}`;
  const completionPath = path.join(
    options.workspaceRoot,
    `.terminal-completed-${suffix}`,
  );
  const quotedCompletionPath = `'${completionPath.replaceAll("'", "'\\''")}'`;
  assert.equal(fs.existsSync(completionPath), false);
  const started = Date.now();
  const write = await appServerCallFromPage(page, "command/exec/write", {
    processId: second.processId,
    deltaBase64: Buffer.from(
      `sleep 31; printf 'LIME_CURRENT_BACKGROUND_%s\\n' '${suffix}'; printf '%s' '${suffix}' > ${quotedCompletionPath}\r`,
    ).toString("base64"),
  });
  assert.ok(
    isObservedPreloadAppServerResponse(
      write.ipcObservation,
      "command/exec/write",
    ),
  );
  await page.locator(`[id="${firstTabId}"]`).click();
  // xterm pauses hidden DOM rendering. Observe execution while hidden, then
  // require the original terminal to show the retained stdout on return.
  while (!fs.existsSync(completionPath)) {
    if (Date.now() - started >= options.timeoutMs) {
      const diagnostic = await captureTerminalFailure(page, options, {
        marker: backgroundMarker,
        processId: second.processId,
        phase: "wait-background-completion",
      });
      throw new Error(
        `Background terminal completion timed out: ${diagnostic}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(fs.readFileSync(completionPath, "utf8"), suffix);
  const completedAfterMs = Date.now() - started;
  assert.ok(completedAfterMs >= 31_000);
  assert.equal(
    await page.locator(`[id="${firstTabId}"]`).getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await secondHandle.evaluate((node) => node.getBoundingClientRect().width),
    0,
  );
  const secondTabId = await tabs.evaluateAll(
    (nodes, firstId) => nodes.find((node) => node.id !== firstId)?.id,
    firstTabId,
  );
  assert.ok(secondTabId);
  await page.locator(`[id="${secondTabId}"]`).click();
  await page.waitForFunction(
    ({ sessionId, marker }) => {
      const terminal = Array.from(
        document.querySelectorAll('[data-testid="terminal-tab"]'),
      ).find((node) => node.getAttribute("data-session-id") === sessionId);
      return (
        terminal?.getBoundingClientRect().width > 0 &&
        terminal?.textContent?.includes(marker)
      );
    },
    { sessionId: secondSessionId, marker: backgroundMarker },
    { timeout: options.timeoutMs },
  );
  assert.equal(await secondHandle.evaluate((node) => node.isConnected), true);
  assert.equal(
    await secondHandle.getAttribute("data-session-id"),
    secondSessionId,
  );
  const backgroundOutput = await secondHandle.textContent();
  assert.ok(!backgroundOutput.includes(first.expectedOutput));
  const restoredSecond = await writeThreadSidePanelTerminalMarker(
    page,
    options,
    "LIME_CURRENT_RESTORED_SECOND",
  );
  assert.equal(restoredSecond.processId, second.processId);
  await page.locator(`[id="${firstTabId}"]`).click();
  // 关闭非活动的第二个标签，只能终止它自己的进程。
  await page
    .locator(`[id="${secondTabId}"]`)
    .locator("..")
    .getByTestId("workspace-right-surface-tab-close")
    .click();
  await page.waitForFunction(
    (processId) =>
      JSON.parse(
        localStorage.getItem("lime_invoke_trace_buffer_v1") || "[]",
      ).some(
        (entry) =>
          entry.transport === "electron-ipc" &&
          entry.status === "success" &&
          entry.args_preview?.request?.lines?.some((line) => {
            const request = JSON.parse(line);
            return (
              request.method === "command/exec/terminate" &&
              request.params?.processId === processId
            );
          }),
      ),
    second.processId,
    { timeout: options.timeoutMs },
  );
  assert.equal(await secondHandle.evaluate((node) => node.isConnected), false);
  assert.equal(await tabs.count(), 1);
  const survivor = await writeThreadSidePanelTerminalMarker(
    page,
    options,
    "LIME_CURRENT_SURVIVOR",
  );
  assert.equal(survivor.processId, first.processId);
  const screenshotPath = path.join(
    options.evidenceDir,
    `${options.prefix}-current-terminal.png`,
  );
  await page.screenshot({ path: screenshotPath, animations: "disabled" });
  await closeThreadSidePanelTab(page, "shell");
  assert.equal(await firstHandle.evaluate((node) => node.isConnected), false);
  assert.equal(await editorHandle.evaluate((node) => node.isConnected), true);
  assert.equal(await editor.textContent(), originalDraft);
  assert.equal(
    await page.getByTestId("canvas-workbench-panel-terminal").count(),
    0,
  );
  return {
    firstSessionId,
    secondSessionId,
    first,
    second,
    restoredSecond,
    survivor,
    background: {
      processId: second.processId,
      marker: backgroundMarker,
      durationMs: Date.now() - started,
      completedAfterMs,
      completedWhileHidden: true,
      stdoutBufferedOnReturn: true,
      actualOutput: backgroundOutput,
      ipcObservation: write.ipcObservation,
    },
    screenshotPath,
    sameComposer: true,
    oldCanvasTerminalCount: 0,
  };
}
