import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parseDocumentPreviewOptions } from "./lib/document-preview-options.mjs";
import {
  writePresentationScenarioFixture,
  runPresentationScenarios,
} from "./lib/document-preview-presentation-scenarios.mjs";
import {
  hash,
  manifest,
  sourcePaths,
} from "./lib/document-preview-provenance.mjs";
import { launchElectronFixture } from "./mcp-config-fixture-smoke.mjs";
import { captureMainProcessExit } from "./lib/persisted-atom-fixture-driver.mjs";
import {
  createTempRuntimeEnv,
  startTextProviderFixtureServer,
} from "../agent-runtime/claw-chat-current-fixture-backend-file.mjs";
import {
  initializeAppServer,
  ensureDefaultWorkspace,
  ensureFixtureTextProvider,
  bindGuiWorkspaceAndModelPreferences,
  reloadRendererDocument,
  invokeAppServerFromPage,
  collectTraceRequestMethods,
} from "../agent-runtime/claw-chat-current-fixture-rpc.mjs";
import { sendPromptFromGui } from "../agent-runtime/claw-chat-current-fixture-gui-actions.mjs";
import {
  GREETING_PROMPT,
  GREETING_DONE_TEXT,
  GREETING_SUMMARY_TEXT,
} from "../agent-runtime/claw-chat-current-fixture-constants.mjs";
import { waitForSessionReadCompleted } from "../agent-runtime/claw-chat-current-fixture-read-model-waits.mjs";
import { settleFixtureResources } from "../agent-runtime/claw-chat-current-fixture-teardown.mjs";
import {
  readJsonl,
  sanitizeText,
} from "../agent-runtime/claw-chat-current-fixture-utils.mjs";
import {
  electronAppServerBinaryDestination,
  resolveElectronAppServerRuntimeEnv,
} from "../lib/electron-app-server-assets.mjs";
import { inspectElectronFixtureBuildFreshness } from "../lib/electron-fixture-build.mjs";
import {
  installInvokeTraceCollector,
  captureInvokeTraceCollector,
  stopInvokeTraceCollector,
  validateInvokeTraceCollectorCapture,
} from "../lib/invoke-trace-collector.mjs";
import {
  writePdfPreviewFixture,
  runPdfPreviewScenario,
} from "./lib/pdf-preview-scenario.mjs";
import {
  runPdfAnnotationScenario,
  runPdfRegionRecoveryScenario,
} from "./lib/pdf-annotation-scenario.mjs";
import {
  writeDocxPreviewFixture,
  runDocxPreviewScenario,
} from "./lib/docx-preview-scenario.mjs";
import { runDocxAnnotationScenario } from "./lib/docx-annotation-scenario.mjs";

import { runDocxAnnotationBatchScenario } from "./lib/docx-annotation-batch-scenario.mjs";
import {
  writeWorkbookPreviewFixture,
  runWorkbookPreviewScenario,
} from "./lib/workbook-preview-scenario.mjs";
import { runWorkbookAnnotationScenario } from "./lib/workbook-annotation-scenario.mjs";
import {
  runWorkbookEditingScenario,
  runDelimitedWorkbookEditingScenario,
} from "./lib/workbook-editing-scenario.mjs";
import { runWorkbookFlushScenario } from "./lib/workbook-flush-scenario.mjs";
import {
  writeWorkbookClipboardFixture,
  runWorkbookClipboardScenario,
} from "./lib/workbook-clipboard-scenario.mjs";
import { runPresentationPreviewScenario } from "./lib/presentation-preview-scenario.mjs";
import { runPresentationAnnotationScenario } from "./lib/presentation-annotation-scenario.mjs";
import { runPresentationFlushScenario } from "./lib/presentation-flush-scenario.mjs";
import {
  observePreviewConsoleError,
  capturePreviewFailureTrace,
} from "./lib/document-preview-diagnostics.mjs";

const previewOptions = parseDocumentPreviewOptions(process.argv);
const {
  runId,
  withAnnotations,
  withWorkbookEditing,
  withWorkbookClipboard,
  withPresentationEditing,
  withPresentationTableFormat,
  withPresentationTableBuiltin,
  withPresentationElements,
  withPresentationRichText,
  withPresentationTable,
  withPresentationStructure,
  withPresentationNavigation,
  withDelimitedEditing,
  withBatchAnnotations,
  fromComposer,
  format,
  filename,
} = previewOptions;
const evidenceDir = path.resolve(".lime/qc/professional-files", runId);
assert.equal(
  fs.existsSync(evidenceDir),
  false,
  "never overwrite previous evidence",
);
fs.mkdirSync(evidenceDir, { recursive: true });
const options = { timeoutMs: 120_000, intervalMs: 250 };
const runtimeEnv = createTempRuntimeEnv();
const summary = {
  runId,
  ok: false,
  scope: `${format.toUpperCase()} renderer${withAnnotations ? " and annotation submission" : ""} with real Electron/Host/IPC/canonical Thread; external backend bypasses production provider execution. No live/Windows/installer claim.`,
  consoleErrors: [],
  consoleErrorDetails: [],
  pageErrors: [],
  mainLifecycle: [],
  sourcesBefore: manifest(sourcePaths),
};
let handle, provider, mainExit, collector, failure;
const consoleObservations = [];
const fresh = () => {
  const value = inspectElectronFixtureBuildFreshness({
    rootDir: process.cwd(),
  });
  assert.equal(value.ready, true, `current build freshness: ${value.reason}`);
  return value;
};
const stage = (name) => {
  summary.stage = name;
  console.log(`[document-preview] ${name}`);
};
try {
  stage("freshness");
  summary.freshnessBefore = fresh();
  summary.artifactsBefore = manifest([
    "dist",
    "dist-electron",
    "packages/app-server-client/dist",
  ]);
  const packagedBinary = electronAppServerBinaryDestination();
  const binary = runtimeEnv.env.APP_SERVER_BIN?.trim() || packagedBinary;
  assert.equal(
    hash(binary),
    hash(packagedBinary),
    "fixture App Server must match the fresh packaged sidecar",
  );
  summary.sidecarBefore = { path: binary, sha256: hash(binary) };
  provider = await startTextProviderFixtureServer();
  stage("launch");
  handle = await launchElectronFixture({
    options,
    runtimeEnv,
    consoleErrors: summary.consoleErrors,
    pageErrors: summary.pageErrors,
    backendMode: "external",
    appServerEnv: {
      ...resolveElectronAppServerRuntimeEnv({
        env: { ...runtimeEnv.env, APP_SERVER_BIN: binary },
      }),
      APP_SERVER_BACKEND_COMMAND: process.execPath,
      APP_SERVER_BACKEND_ARGS: JSON.stringify([
        runtimeEnv.backendPath,
        runtimeEnv.backendLedgerPath,
        runtimeEnv.cancelSignalPath,
        runtimeEnv.typedErrorSignalPath,
      ]),
      APP_SERVER_BACKEND_TIMEOUT_MS: "10000",
      LIME_ALLOW_LIVE_PROVIDER_SMOKE: "0",
      LIME_REAL_API_TEST: "0",
    },
  });
  mainExit = captureMainProcessExit(handle.app.process());
  const lifecyclePrefix = "[document-preview-main] ";
  let lifecycleBuffer = "";
  handle.app.process().stdout?.on("data", (chunk) => {
    lifecycleBuffer += chunk.toString();
    const lines = lifecycleBuffer.split("\n");
    lifecycleBuffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith(lifecyclePrefix))
        summary.mainLifecycle.push(
          JSON.parse(line.slice(lifecyclePrefix.length)),
        );
    }
  });
  handle.app.process().stderr?.on("data", (chunk) => {
    if (chunk.toString().includes("Waiting for the debugger to disconnect"))
      summary.mainLifecycle.push({
        event: "waiting-for-debugger-disconnect",
        at: new Date().toISOString(),
      });
  });
  handle.app.on("close", () =>
    summary.mainLifecycle.push({
      event: "playwright-app-closed",
      at: new Date().toISOString(),
    }),
  );
  await handle.app.evaluate(({ app, BrowserWindow }, prefix) => {
    for (const event of ["before-quit", "will-quit", "quit"])
      app.on(event, () => {
        process.stdout.write(
          prefix +
            JSON.stringify({
              event,
              at: new Date().toISOString(),
              windows: BrowserWindow.getAllWindows().length,
              activeResources: process.getActiveResourcesInfo(),
            }) +
            "\n",
        );
      });
  }, lifecyclePrefix);
  handle.app.on("console", (message) => {
    if (message.type() === "error")
      summary.consoleErrorDetails.push({
        stage: summary.stage,
        source: "main",
        location: message.location(),
        text: sanitizeText(message.text()),
      });
  });
  const { page } = handle;
  page.on("console", (message) => {
    if (message.type() === "error") {
      summary.consoleErrors.push(sanitizeText(message.text()));
      observePreviewConsoleError(
        message,
        summary.stage,
        summary.consoleErrorDetails,
        consoleObservations,
      );
    }
  });
  await initializeAppServer(page);
  const workspace = await ensureDefaultWorkspace(page);
  const preference = await ensureFixtureTextProvider(page, undefined, {
    apiHost: provider.baseUrl,
  });
  await bindGuiWorkspaceAndModelPreferences(page, workspace.workspaceId, {
    provider: preference.providerId,
    model: preference.modelId,
  });
  const filePath = path.join(workspace.rootPath, filename);
  const clipboardFiles = [
    filePath,
    ...["Values.csv", "Values.tsv"].map((name) =>
      path.join(workspace.rootPath, name),
    ),
  ];
  if (withWorkbookClipboard)
    for (const target of clipboardFiles)
      await writeWorkbookClipboardFixture(target);
  else if (format === "presentation")
    await writePresentationScenarioFixture(filePath, previewOptions);
  else
    await (
      format === "workbook"
        ? writeWorkbookPreviewFixture
        : format === "docx"
          ? writeDocxPreviewFixture
          : writePdfPreviewFixture
    )(filePath);
  await reloadRendererDocument(page, options);
  collector = await installInvokeTraceCollector(page);
  await page.getByTestId("app-sidebar-home-button").click();
  await page.getByTestId("composer-utility-project-trigger").click();
  await page
    .locator(
      `[data-testid="composer-utility-opened-project"][data-project-id="${workspace.workspaceId}"]`,
    )
    .press("Enter");
  await sendPromptFromGui(page, options, GREETING_PROMPT, {
    allowTaskCenterHomeInput: true,
  });
  stage("canonical-thread");
  await page
    .getByText(GREETING_SUMMARY_TEXT, { exact: false })
    .first()
    .waitFor();
  const starts = () =>
    readJsonl(runtimeEnv.backendLedgerPath).filter(
      (entry) => entry.kind === "turnStart",
    );
  assert.equal(starts().length, 1);
  const list = await invokeAppServerFromPage(page, "thread/list", {
    archived: false,
    limit: 100,
  });
  const thread = list.result.data.find(
    (item) => item.sessionId === starts()[0].sessionId,
  );
  assert.ok(thread);
  const completed = await waitForSessionReadCompleted(
    page,
    options,
    undefined,
    {
      threadId: thread.id,
      prompt: GREETING_PROMPT,
      doneText: GREETING_DONE_TEXT,
      summaryText: GREETING_SUMMARY_TEXT,
    },
  );
  summary.identity = {
    threadId: thread.id,
    sessionId: starts()[0].sessionId,
    turns: completed.thread.turns.map((turn) => ({
      id: turn.id,
      items: turn.items.map((item) => item.id),
    })),
  };
  stage("open-workspace-file");
  const workbenchToggle = page.getByTestId("task-center-workbench-toggle");
  summary.workbenchBeforeOpen =
    await workbenchToggle.getAttribute("aria-label");
  assert.ok(["打开工作台", "关闭工作台"].includes(summary.workbenchBeforeOpen));
  if (summary.workbenchBeforeOpen === "打开工作台")
    await workbenchToggle.click();
  assert.equal(await workbenchToggle.getAttribute("aria-label"), "关闭工作台");
  if (!withWorkbookClipboard) {
    await page.getByTestId("canvas-workbench-tab-menu-trigger").click();
    await page
      .getByRole("menuitem", { name: "新建工作台标签-文件", exact: true })
      .click();
    await page
      .locator(
        `[data-testid="canvas-workbench-panel-workspace"] button[title="${filename}"]`,
      )
      .click();
  }
  stage(`${format}-pages`);
  summary.assetFetchProbe = await page.evaluate(async (filePath) => {
    try {
      const response = await fetch(`asset://${encodeURIComponent(filePath)}`);
      return { ok: response.ok, status: response.status };
    } catch (error) {
      return { ok: false, name: error.name, message: error.message };
    }
  }, filePath);
  if (format === "presentation")
    summary.presentation = await runPresentationPreviewScenario({
      page,
      evidenceDir,
      filePath,
    });
  else if (withWorkbookClipboard) {
    summary.workbookClipboard = [];
    for (const target of clipboardFiles) {
      stage(`workbook-clipboard-${path.extname(target).slice(1)}`);
      summary.workbookClipboard.push(
        await runWorkbookClipboardScenario({
          app: handle.app,
          page,
          evidenceDir,
          filePath: target,
          readTrace: async () => {
            const trace = validateInvokeTraceCollectorCapture(
              await captureInvokeTraceCollector(page, collector),
              collector,
            );
            assert.equal(trace.complete, true);
            return trace.ledgerEntries;
          },
        }),
      );
      assert.equal(
        starts().length,
        1,
        "clipboard editing creates no extra Turn",
      );
    }
  } else if (format === "workbook")
    summary.workbook = await runWorkbookPreviewScenario({
      page,
      evidenceDir,
      options,
      filePath,
      identity: summary.identity,
    });
  else if (format === "docx")
    summary.docx = await runDocxPreviewScenario({ page, evidenceDir, options });
  else {
    summary.pdf = { pages: [], screenshots: [] };
    await runPdfPreviewScenario({ page, evidenceDir, result: summary.pdf });
  }
  assert.equal(starts().length, 1, "preview does not create another Turn");
  const after = await invokeAppServerFromPage(page, "thread/read", {
    threadId: thread.id,
    includeTurns: true,
  });
  assert.deepEqual(
    after.result.thread.turns.map((turn) => ({
      id: turn.id,
      items: turn.items.map((item) => item.id),
    })),
    summary.identity.turns.map((turn, index) => ({
      ...turn,
      items:
        summary.workbook?.artifactItemId && index === 0
          ? [...turn.items, summary.workbook.artifactItemId]
          : turn.items,
    })),
  );
  if (withWorkbookEditing) {
    assert.equal(format, "workbook");
    stage("workbook-editing");
    summary.editing = await runWorkbookEditingScenario({
      page,
      evidenceDir,
      filePath,
    });
    assert.equal(starts().length, 1, "file editing creates no extra Turn");
  }
  if (withDelimitedEditing) {
    assert.equal(format, "workbook");
    stage("workbook-delimited-editing");
    summary.delimitedEditing = await runDelimitedWorkbookEditingScenario({
      page,
      evidenceDir,
      filePath,
      readTrace: async () => {
        const trace = validateInvokeTraceCollectorCapture(
          await captureInvokeTraceCollector(page, collector),
          collector,
        );
        assert.equal(trace.complete, true);
        return trace.ledgerEntries;
      },
    });
    assert.equal(starts().length, 1, "CSV/TSV editing creates no extra Turn");
  }
  if (format === "presentation")
    Object.assign(
      summary,
      await runPresentationScenarios({
        app: handle.app,
        page,
        evidenceDir,
        filePath,
        options: previewOptions,
        stage,
        assertNoExtraTurn: (name) =>
          assert.equal(starts().length, 1, `${name} creates no extra Turn`),
        readTrace: async () => {
          const trace = validateInvokeTraceCollectorCapture(
            await captureInvokeTraceCollector(page, collector),
            collector,
          );
          assert.equal(trace.complete, true);
          return trace.ledgerEntries;
        },
      }),
    );
  if (withAnnotations && format === "presentation") {
    if (withPresentationEditing) {
      stage("presentation-flush");
      summary.flush = await runPresentationFlushScenario({
        page,
        evidenceDir,
        filePath,
        identity: summary.identity,
        starts,
        options,
      });
    }
    stage("presentation-annotation");
    summary.annotation = await runPresentationAnnotationScenario({
      page,
      evidenceDir,
      filePath,
      identity: summary.flush
        ? { ...summary.identity, turns: [{ id: summary.flush.turnId }] }
        : summary.identity,
      starts,
      options,
    });
  } else if (withAnnotations && format === "workbook") {
    if (withWorkbookEditing) {
      stage("workbook-flush");
      summary.flush = await runWorkbookFlushScenario({
        page,
        evidenceDir,
        filePath,
        identity: summary.identity,
        starts,
        options,
      });
    }
    stage("workbook-annotation");
    summary.annotation = await runWorkbookAnnotationScenario({
      page,
      evidenceDir,
      filePath,
      identity: summary.flush
        ? { ...summary.identity, turns: [{ id: summary.flush.turnId }] }
        : summary.identity,
      starts,
      options,
    });
  } else if (withAnnotations && format === "docx") {
    stage("docx-annotation");
    summary.annotation = await runDocxAnnotationScenario({
      page,
      evidenceDir,
      filePath: path.join(workspace.rootPath, filename),
      identity: summary.identity,
      starts,
      options,
      onStage: (name) => stage(`docx-annotation:${name}`),
    });
  } else if (withAnnotations) {
    stage("pdf-annotation");
    summary.annotation = await runPdfAnnotationScenario({
      page,
      evidenceDir,
      filePath: path.join(workspace.rootPath, "Preview-report.pdf"),
      identity: summary.identity,
      starts,
      options,
      fromComposer,
    });
    stage("pdf-region-recovery");
    summary.regionRecovery = await runPdfRegionRecoveryScenario({
      page,
      evidenceDir,
      filePath: path.join(workspace.rootPath, "Preview-report.pdf"),
      identity: summary.identity,
      starts,
      options,
    });
  }
  if (withBatchAnnotations) {
    stage("docx-annotation-batch");
    summary.annotationBatch = await runDocxAnnotationBatchScenario({
      page,
      evidenceDir,
      filePath,
      identity: summary.identity,
      starts,
      options,
      fromComposer,
    });
  }
  const trace = validateInvokeTraceCollectorCapture(
    await captureInvokeTraceCollector(page, collector),
    collector,
  );
  if (format === "workbook" && !withAnnotations)
    assert.equal(
      starts().length,
      1,
      "file preview and local editing create no extra Turn",
    );
  assert.equal(trace.complete, true);
  summary.trace = {
    provenance: trace.provenance,
    methods: [...new Set(collectTraceRequestMethods(trace.ledgerEntries))],
    ipc: trace.ledgerEntries.filter(
      (entry) =>
        entry.transport === "electron-ipc" &&
        entry.command === "app_server_handle_json_lines",
    ).length,
    errors: trace.ledgerEntries.filter((entry) => entry.status === "error")
      .length,
    mockHits: trace.ledgerEntries.filter((entry) =>
      /mock/i.test(entry.transport ?? ""),
    ).length,
  };
  assert.ok(summary.trace.ipc > 0);
  assert.ok(summary.trace.methods.includes("fs/readFile"));
  if (
    withWorkbookEditing ||
    withWorkbookClipboard ||
    withDelimitedEditing ||
    withPresentationEditing ||
    withPresentationTable ||
    withPresentationTableFormat ||
    withPresentationTableBuiltin ||
    withPresentationElements ||
    withPresentationRichText ||
    withPresentationStructure ||
    withPresentationNavigation
  )
    assert.ok(summary.trace.methods.includes("fs/writeFile"));
  assert.equal(summary.trace.errors, 0);
  assert.equal(summary.trace.mockHits, 0);
  summary.sourcesAfter = manifest(sourcePaths);
  assert.deepEqual(summary.sourcesAfter, summary.sourcesBefore);
  assert.deepEqual(
    manifest(["dist", "dist-electron", "packages/app-server-client/dist"]),
    summary.artifactsBefore,
  );
  assert.deepEqual(
    { path: binary, sha256: hash(binary) },
    summary.sidecarBefore,
  );
  summary.freshnessAfter = fresh();
  assert.deepEqual(summary.consoleErrors, []);
  assert.deepEqual(summary.pageErrors, []);
} catch (error) {
  failure = error;
  summary.error = sanitizeText(error.stack ?? error.message);
  if (collector)
    summary.failureTrace = await capturePreviewFailureTrace(
      handle.page,
      collector,
    ).catch((error) => ({ observationError: sanitizeText(String(error)) }));
  if (handle) {
    summary.failureGeometry = await handle.page
      .evaluate(() => {
        const box = (element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        const elements = document.querySelectorAll(
          '[data-testid="workbook-grid"], [data-testid="pdf-preview-pages"], [data-testid="presentation-panel"]',
        );
        return [...elements].map((element) => ({
          testId: element.getAttribute("data-testid"),
          box: box(element),
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
          scrollHeight: element.scrollHeight,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          clientWidth: element.clientWidth,
          slide: (() => {
            const slide = element
              .querySelector("iframe")
              ?.contentDocument?.querySelector("[data-slide-id]");
            return slide
              ? {
                  slideId: slide.getAttribute("data-slide-id"),
                  box: box(slide),
                }
              : null;
          })(),
          targets: [
            ...element.querySelectorAll(
              '[role="gridcell"][aria-selected="true"], [data-pdf-page]',
            ),
          ].map((target) => ({
            address:
              target.getAttribute("data-address") ??
              target.getAttribute("data-pdf-page"),
            box: box(target),
          })),
        }));
      })
      .catch(() => null);
    summary.failureBody = await handle.page
      .locator("body")
      .innerText()
      .catch(() => "unavailable");
    await handle.page
      .screenshot({ path: path.join(evidenceDir, "failure.png") })
      .catch(() => undefined);
  }
} finally {
  await Promise.allSettled(consoleObservations);
  summary.teardown = await settleFixtureResources({
    app: handle?.app,
    mainExit,
    invokeTraceCollector: collector
      ? { stop: () => stopInvokeTraceCollector(handle.page, collector) }
      : undefined,
    textProviderFixtureServer: provider,
  });
  summary.ok = !failure && summary.teardown.ok;
  fs.writeFileSync(
    path.join(evidenceDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
}
assert.equal(summary.ok, true, summary.error ?? "fixture teardown failed");
console.log(`[document-preview] passed: ${evidenceDir}`);
