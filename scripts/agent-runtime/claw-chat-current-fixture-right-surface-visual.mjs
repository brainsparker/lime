import path from "node:path";
import {
  collectThreadSidePanelNewTabEvidence,
  createThreadSidePanelFileFixture,
} from "../electron/lib/thread-side-panel-new-tab-scenario.mjs";
import { selectThreadSidePanelTool } from "../electron/lib/thread-side-panel-navigation.mjs";
import { waitForPageCondition } from "../electron/mcp-config-fixture-smoke.mjs";
import {
  APP_SERVER_METHOD_WORKSPACE_RIGHT_SURFACE_PENDING_LIST,
  APP_SERVER_METHOD_WORKSPACE_RIGHT_SURFACE_REQUEST,
  EXPERT_SKILLS_RUNTIME_SESSION_ID,
} from "./claw-chat-current-fixture-constants.mjs";
import { invokeAppServerFromPage } from "./claw-chat-current-fixture-rpc.mjs";
import {
  assert,
  sanitizeJson,
  sleep,
} from "./claw-chat-current-fixture-utils.mjs";

const RIGHT_SURFACE_ROOTS = {
  appSurface: "workspace-plugin-surface",
  browser: "right-surface-browser-panel",
  files: "workspace-files-surface",
  articleWorkspace: "workspace-article-editor-surface",
};

export async function runRightSurfaceVisualMatrix({
  page,
  options,
  workspace,
  appServerRequests,
  sessionId = EXPERT_SKILLS_RUNTIME_SESSION_ID,
}) {
  assert(
    workspace?.workspaceId,
    "Right Surface visual matrix 缺少 workspaceId",
  );
  assert(
    workspace?.rootPath,
    "Right Surface visual matrix 缺少 workspace rootPath",
  );

  const fileFixture = createThreadSidePanelFileFixture(workspace);

  const requests = {
    files: await requestRightSurfacePending(page, appServerRequests, {
      workspace,
      sessionId,
      surfaceKind: "files",
      candidateId: fileFixture.relativePath,
      metadata: {
        relativePath: fileFixture.relativePath,
        title: fileFixture.relativePath,
      },
    }),
    browser: await requestRightSurfacePending(page, appServerRequests, {
      workspace,
      sessionId,
      surfaceKind: "browser",
      candidateId: "right-surface-visual-browser",
      metadata: {
        browser: {
          launchUrl: "https://example.com/right-surface-browser",
          title: "Right Surface visual browser",
        },
      },
    }),
  };

  const pendingBeforeClicks = await listRightSurfacePending(
    page,
    appServerRequests,
    {
      workspace,
      sessionId,
    },
  );
  const toolbarBeforeClicks = await captureRightSurfaceToolbarDiagnostics(page);

  const captures = {};
  try {
    captures.files = await clickAndAssertRightSurface(page, options, {
      surfaceKind: "files",
      rootTestId: RIGHT_SURFACE_ROOTS.files,
    });
    captures.browser = await clickAndAssertRightSurface(page, options, {
      surfaceKind: "browser",
      rootTestId: RIGHT_SURFACE_ROOTS.browser,
      screenshotName: "right-surface-browser",
    });
    captures.browser.nativeTabs = await page.evaluate(
      async (scope) => {
        return await window.electronAPI.invoke("browser_tab_list", scope);
      },
      {
        browserSessionId: captures.browser.stable.browserSurface.sessionId,
        threadId: captures.browser.stable.browserSurface.threadId,
      },
    );
  } catch (error) {
    const toolbarAfterFailure = await captureRightSurfaceToolbarDiagnostics(
      page,
    ).catch((diagnosticError) => ({
      error:
        diagnosticError instanceof Error
          ? diagnosticError.message
          : String(diagnosticError),
    }));
    const diagnostic = sanitizeJson({
      requests: summarizeRightSurfaceRequests(requests),
      pendingBeforeClicks: summarizePendingList(pendingBeforeClicks.result),
      toolbarBeforeClicks,
      toolbarAfterFailure,
    });
    const message = error instanceof Error ? error.message : String(error);
    return sanitizeJson({
      sessionId,
      error: message,
      ...diagnostic,
      captures,
    });
  }

  captures.newTabLifecycle = await collectThreadSidePanelNewTabEvidence(
    page,
    options,
    workspace,
    fileFixture,
  );

  const pendingAfterClicks = await listRightSurfacePending(
    page,
    appServerRequests,
    {
      workspace,
      sessionId,
    },
  );

  return sanitizeJson({
    sessionId,
    requests: summarizeRightSurfaceRequests(requests),
    pendingBeforeClicks: summarizePendingList(pendingBeforeClicks.result),
    toolbarBeforeClicks,
    captures,
    pendingAfterClicks: summarizePendingList(pendingAfterClicks.result),
  });
}

export async function runThreadSummaryPanelSmoke({ page, options, sessionId }) {
  const toggle = page.getByTestId("thread-workspace-summary-toggle");
  const editor = page.getByTestId("composer-editor");
  await page.setViewportSize({ width: 2100, height: 1000 });
  await toggle.waitFor({ state: "visible", timeout: options.timeoutMs });
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-testid="thread-workspace-summary-toggle"]')
        ?.disabled,
  );
  await page.getByTestId("thread-summary-inline").waitFor({ state: "visible" });
  const editorHandle = await editor.elementHandle();
  const draft = "Summary keeps the unsent canonical draft";
  await editor.fill(draft);
  const capture = async (name) => {
    const snapshot = await page.evaluate(() => {
      const layout = document.querySelector(
        '[data-testid="thread-summary-layout"]',
      );
      const trigger = document.querySelector(
        '[data-testid="thread-workspace-summary-toggle"]',
      );
      return {
        mode: layout?.getAttribute("data-summary-mode"),
        width: layout?.getBoundingClientRect().width,
        contentTransform:
          layout?.firstElementChild &&
          getComputedStyle(layout.firstElementChild).transform,
        inlineVisible: Boolean(
          document.querySelector('[data-testid="thread-summary-inline"]'),
        ),
        popoverVisible: Boolean(
          document.querySelector('[data-testid="thread-summary-popover"]'),
        ),
        pressed: trigger?.getAttribute("aria-pressed"),
        panelCount: document.querySelectorAll(
          '[data-testid="thread-summary-panel"]',
        ).length,
        draft: document.querySelector('[data-testid="composer-editor"]')
          ?.textContent,
        rightSurface:
          document
            .querySelector('[data-testid="workspace-right-surface-host"]')
            ?.getAttribute("data-surface") ?? null,
      };
    });
    const screenshot = path.join(
      options.evidenceDir,
      `${options.prefix}-${name}.png`,
    );
    await page.screenshot({ path: screenshot });
    assert(
      await editorHandle.evaluate((node) => node.isConnected),
      "Summary replaced the editor instance",
    );
    assert(snapshot.draft === draft, "Summary changed the unsent draft");
    assert(snapshot.panelCount <= 1, "Summary mounted duplicate panels");
    return { ...snapshot, screenshot };
  };
  const gutter = await capture("summary-gutter");
  assert(
    gutter.mode === "gutter" && gutter.inlineVisible,
    "Summary gutter layout missing",
  );
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="thread-summary-layout"]')
        ?.getAttribute("data-summary-mode") === "shift",
  );
  const shift = await capture("summary-shift");
  assert(
    shift.contentTransform === "matrix(1, 0, 0, 1, -154, 0)",
    "Summary content shift differs from shipped contract",
  );
  await toggle.click();
  await page
    .getByTestId("thread-summary-inline")
    .waitFor({ state: "detached" });
  const unpinned = await capture("summary-unpinned");
  const key = "app-shell-summary-panel-pinned";
  const pinReceipt = await waitForPageCondition(
    page,
    options,
    async ({ atomKey }) => {
      const result = await window.electronAPI.invoke("persisted_atom_read", {
        key: atomKey,
        query: { kind: "value" },
      });
      return result.key === atomKey &&
        result.outcome === "ready" &&
        result.data.value === false &&
        result.persistence.state === "saved"
        ? result
        : false;
    },
    "Summary pin did not reach saved Main state",
    { atomKey: key },
  );
  // Drafts share this revision; preserve the saved observation before another edit.
  await page.setViewportSize({ width: 800, height: 700 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="thread-summary-layout"]')
        ?.getAttribute("data-summary-mode") === "overlay",
  );
  await toggle.click();
  await page
    .getByTestId("thread-summary-popover")
    .waitFor({ state: "visible" });
  const overlay = await capture("summary-overlay");
  await page.keyboard.press("Escape");
  await page
    .getByTestId("thread-summary-popover")
    .waitFor({ state: "detached" });
  await page.waitForFunction(
    (trigger) => trigger === document.activeElement,
    await toggle.elementHandle(),
    { timeout: Math.min(options.timeoutMs, 10_000) },
  );
  const focusRestored = await toggle.evaluate(
    (node) => node === document.activeElement,
  );
  assert(focusRestored, "Summary Escape did not restore trigger focus");
  assert(
    overlay.rightSurface === null,
    "Summary used the retired Right Surface owner",
  );
  return sanitizeJson({
    sessionId,
    captures: {
      summary: {
        gutter,
        shift,
        unpinned,
        overlay,
        pinReceipt,
        focusRestored,
        sameEditor: await editorHandle.evaluate((node) => node.isConnected),
      },
    },
  });
}

async function requestRightSurfacePending(
  page,
  appServerRequests,
  { workspace, sessionId, surfaceKind, candidateId, metadata },
) {
  return await invokeAppServerFromPage(
    page,
    APP_SERVER_METHOD_WORKSPACE_RIGHT_SURFACE_REQUEST,
    {
      workspaceId: workspace.workspaceId,
      workspaceRoot: workspace.rootPath,
      sessionId,
      surfaceKind,
      origin: "runtime",
      priority: "normal",
      candidateId,
      ttlMs: 120_000,
      metadata,
    },
    appServerRequests,
  );
}

async function listRightSurfacePending(
  page,
  appServerRequests,
  { workspace, sessionId },
) {
  return await invokeAppServerFromPage(
    page,
    APP_SERVER_METHOD_WORKSPACE_RIGHT_SURFACE_PENDING_LIST,
    {
      workspaceId: workspace.workspaceId,
      workspaceRoot: workspace.rootPath,
      sessionId,
      limit: 20,
    },
    appServerRequests,
  );
}

async function captureRightSurfaceToolbarDiagnostics(page) {
  return await page.evaluate(() => {
    const toggleByKind = {
      appSurface: "workspace-right-surface-tab-appSurface",
      browser: "workspace-right-surface-tab-browser",
      files: "workspace-right-surface-tab-files",
      shell: "workspace-right-surface-tab-shell",
      changes: "workspace-right-surface-tab-changes",
      newTab: "workspace-right-surface-new-tab",
    };
    const toolbar = document.querySelector(
      '[data-testid="task-center-utility-toolbar"]',
    );
    const panelGroup = document.querySelector(
      '[data-testid="thread-side-panel-toggle"]',
    );
    const host = document.querySelector(
      '[data-testid="workspace-right-surface-host"]',
    );

    return {
      electron: window.__LIME_ELECTRON__ === true,
      hasElectronInvoke: Boolean(window.electronAPI?.invoke),
      hasElectronSupportsCommand:
        typeof window.electronAPI?.supportsCommand === "function",
      appServerCommandAvailable:
        typeof window.electronAPI?.supportsCommand === "function"
          ? window.electronAPI.supportsCommand("app_server_handle_json_lines")
          : null,
      toolbar: visibleInfo(toolbar),
      panelGroup: visibleInfo(panelGroup),
      activeSurface: host?.getAttribute("data-surface") ?? null,
      toggles: Object.fromEntries(
        Object.entries(toggleByKind).map(([kind, testId]) => {
          const element = document.querySelector(`[data-testid="${testId}"]`);
          const button =
            element instanceof HTMLButtonElement
              ? element
              : element?.closest("button");
          return [
            kind,
            {
              ...visibleInfo(element),
              disabled:
                button instanceof HTMLButtonElement
                  ? button.disabled ||
                    button.getAttribute("aria-disabled") === "true"
                  : null,
              ariaExpanded: button?.getAttribute("aria-expanded") ?? null,
              title: button?.getAttribute("title") ?? "",
              text: (button?.textContent ?? "").trim().slice(0, 80),
            },
          ];
        }),
      ),
      panelButtonKinds: Array.from(
        document.querySelectorAll(
          '[data-testid="task-center-tool-group-panels"] [data-testid]',
        ),
      ).map((element) => {
        const testId = element.getAttribute("data-testid") ?? "";
        return testId
          .replace(/^task-center-/, "")
          .replace(/^workspace-right-surface-tab-/, "surface-tab-")
          .replace(/-toggle$/, "");
      }),
      bodyTextSample: (document.body?.innerText ?? "").slice(0, 1000),
    };

    function visibleInfo(node) {
      const rect = node?.getBoundingClientRect();
      const style = node ? window.getComputedStyle(node) : null;
      return {
        exists: Boolean(node),
        visible: Boolean(
          node &&
          rect &&
          rect.width > 8 &&
          rect.height > 8 &&
          style?.display !== "none" &&
          style?.visibility !== "hidden" &&
          Number(style?.opacity ?? "1") > 0,
        ),
        rect: rect ? rectToJson(rect) : null,
      };
    }

    function rectToJson(rect) {
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      };
    }
  });
}

export async function clickAndAssertRightSurface(
  page,
  options,
  {
    surfaceKind,
    activeSurfaceKind = surfaceKind,
    rootTestId,
    screenshotName = null,
    requireCanvasPanelFill = true,
  },
) {
  const toggle = await selectThreadSidePanelTool(
    page,
    surfaceKind,
    options.timeoutMs,
  );
  const opened = await waitForRightSurfaceSnapshot(page, options, {
    activeSurfaceKind,
    requireCanvasPanelFill,
    surfaceKind,
    rootTestId,
  });

  await sleep(1_000);
  const stable = await captureRightSurfaceSnapshot(page, {
    activeSurfaceKind,
    surfaceKind,
    rootTestId,
  });
  assertRightSurfaceSnapshot(
    stable,
    surfaceKind,
    activeSurfaceKind,
    requireCanvasPanelFill,
  );
  const screenshot = screenshotName
    ? await captureRightSurfaceScreenshot(page, options, screenshotName)
    : null;

  return {
    toggle,
    opened,
    stable,
    screenshot,
  };
}

async function captureRightSurfaceScreenshot(page, options, screenshotName) {
  const screenshotPath = path.join(
    options.evidenceDir,
    `${options.prefix}-${screenshotName}.png`,
  );
  await page.bringToFront();
  await page.screenshot({
    path: screenshotPath,
    fullPage: false,
    timeout: 15_000,
  });
  return screenshotPath;
}

async function waitForRightSurfaceSnapshot(
  page,
  options,
  {
    surfaceKind,
    activeSurfaceKind = surfaceKind,
    requireCanvasPanelFill = true,
    rootTestId,
  },
) {
  const startedAt = Date.now();
  let lastSnapshot = null;
  while (Date.now() - startedAt < options.timeoutMs) {
    const snapshot = await captureRightSurfaceSnapshot(page, {
      surfaceKind,
      rootTestId,
    });
    lastSnapshot = snapshot;
    if (
      isRightSurfaceSnapshotReady(
        snapshot,
        surfaceKind,
        activeSurfaceKind,
        requireCanvasPanelFill,
      )
    ) {
      return snapshot;
    }
    await sleep(options.intervalMs);
  }

  throw new Error(
    `Right Surface 未打开目标 surface: ${surfaceKind}; snapshot=${JSON.stringify(
      sanitizeJson(lastSnapshot),
    )}`,
  );
}

async function captureRightSurfaceSnapshot(
  page,
  { surfaceKind, activeSurfaceKind = surfaceKind, rootTestId },
) {
  return await page.evaluate(
    ({ surfaceKind, activeSurfaceKind, rootTestId, roots }) => {
      const host = document.querySelector(
        '[data-testid="workspace-right-surface-host"]',
      );
      const canvasPanel = document.querySelector(
        '[data-testid="layout-canvas-panel"]',
      );
      const activePane = document.querySelector(
        '[data-testid="workspace-right-surface-active-pane"]',
      );
      const layoutRoot = document.querySelector(
        '[data-testid="layout-transition-root"]',
      );
      const root = document.querySelector(`[data-testid="${rootTestId}"]`);
      const pluginTabs = document.querySelector(
        '[data-testid="workspace-plugin-surface-tabs"]',
      );
      const pluginTabButtons = Array.from(
        document.querySelectorAll(
          '[data-testid^="workspace-plugin-surface-tab-"]',
        ),
      );
      const pluginFrames = Array.from(
        document.querySelectorAll(
          '[data-testid="workspace-plugin-surface-frame"]',
        ),
      );
      const pluginViewports = Array.from(
        document.querySelectorAll(
          '[data-testid="workspace-plugin-surface-viewport"]',
        ),
      );
      const browserPanel = document.querySelector(
        '[data-testid="right-surface-browser-panel"]',
      );
      const hostRect = rectFor(host);
      const canvasPanelRect = rectFor(canvasPanel);
      const activePaneRect = rectFor(activePane);
      const rootRect = rectFor(root);
      const rootVisibility = Object.fromEntries(
        Object.entries(roots).map(([kind, testId]) => {
          const node = document.querySelector(`[data-testid="${testId}"]`);
          return [kind, visibleInfo(node)];
        }),
      );
      const visibleRootKinds = Object.entries(rootVisibility)
        .filter(([, value]) => value.visible)
        .map(([kind]) => kind);
      const hostCanvasWidthDelta =
        hostRect && canvasPanelRect
          ? Math.abs(hostRect.width - canvasPanelRect.width)
          : null;
      const hostCanvasHeightDelta =
        hostRect && canvasPanelRect
          ? Math.abs(hostRect.height - canvasPanelRect.height)
          : null;
      const rootHostWidthDelta =
        hostRect && rootRect ? Math.abs(hostRect.width - rootRect.width) : null;
      const rootHostHeightDelta =
        hostRect && rootRect
          ? Math.abs(hostRect.height - rootRect.height)
          : null;
      const rootActivePaneWidthDelta =
        activePaneRect && rootRect
          ? Math.abs(activePaneRect.width - rootRect.width)
          : null;
      const rootActivePaneHeightDelta =
        activePaneRect && rootRect
          ? Math.abs(activePaneRect.height - rootRect.height)
          : null;
      const rootFillsHost =
        Boolean(hostRect && rootRect) &&
        rootRect.width >= hostRect.width - 8 &&
        rootRect.height >= hostRect.height - 8;
      const rootFillsActivePane =
        Boolean(activePaneRect && rootRect) &&
        rootRect.width >= activePaneRect.width - 8 &&
        rootRect.height >= activePaneRect.height - 8;

      return {
        expectedSurface: surfaceKind,
        expectedActiveSurface: activeSurfaceKind,
        activeSurface: host?.getAttribute("data-surface") ?? null,
        layoutMode: layoutRoot?.getAttribute("data-effective-mode") ?? null,
        hostVisible: visibleInfo(host).visible,
        rootVisible: visibleInfo(root).visible,
        visibleRootKinds,
        rootVisibility,
        rects: {
          host: hostRect,
          canvasPanel: canvasPanelRect,
          activePane: activePaneRect,
          root: rootRect,
        },
        geometry: {
          hostCanvasWidthDelta,
          hostCanvasHeightDelta,
          rootHostWidthDelta,
          rootHostHeightDelta,
          rootActivePaneWidthDelta,
          rootActivePaneHeightDelta,
          hostFillsCanvasPanel:
            Boolean(hostRect && canvasPanelRect) &&
            hostRect.width >= 360 &&
            hostRect.height >= 500 &&
            hostCanvasWidthDelta <= 8 &&
            hostCanvasHeightDelta <= 8,
          rootFillsHost,
          rootFillsActivePane,
          rootFillsSurfaceViewport: rootFillsHost || rootFillsActivePane,
        },
        pluginSurface: {
          tabs: visibleInfo(pluginTabs),
          tabCount: pluginTabButtons.length,
          tabLabels: pluginTabButtons.map((button) =>
            (button.textContent || "").trim(),
          ),
          activeTabLabels: pluginTabButtons
            .filter((button) => button.getAttribute("aria-selected") === "true")
            .map((button) => (button.textContent || "").trim()),
          frameCount: pluginFrames.length,
          visibleFrameCount: pluginFrames.filter(
            (frame) => visibleInfo(frame).visible,
          ).length,
          viewportCount: pluginViewports.length,
          visibleViewportCount: pluginViewports.filter(
            (viewport) => visibleInfo(viewport).visible,
          ).length,
        },
        browserSurface: browserPanel
          ? {
              controlMode:
                browserPanel.getAttribute("data-browser-control-mode") ?? "",
              controlOwner:
                browserPanel.getAttribute("data-browser-control-owner") ?? "",
              humanTakeover:
                browserPanel.getAttribute("data-browser-human-takeover") ?? "",
              lifecycleState:
                browserPanel.getAttribute("data-browser-lifecycle-state") ?? "",
              sessionId:
                browserPanel.getAttribute("data-browser-session-id") ?? "",
              tabId: browserPanel.getAttribute("data-browser-tab-id") ?? "",
              threadId:
                browserPanel.getAttribute("data-browser-thread-id") ?? "",
              webContentsId: Number(
                browserPanel.getAttribute("data-browser-web-contents-id"),
              ),
              hasControlOverlay: Boolean(
                document.querySelector(
                  '[data-testid="right-surface-browser-control-overlay"]',
                ),
              ),
            }
          : null,
        bodyTextSample: (document.body?.innerText || "").slice(0, 2000),
      };

      function visibleInfo(node) {
        const rect = node?.getBoundingClientRect();
        const style = node ? window.getComputedStyle(node) : null;
        return {
          exists: Boolean(node),
          visible: Boolean(
            node &&
            rect &&
            rect.width > 8 &&
            rect.height > 8 &&
            style?.display !== "none" &&
            style?.visibility !== "hidden" &&
            Number(style?.opacity ?? "1") > 0,
          ),
          rect: rect ? rectToJson(rect) : null,
        };
      }

      function rectFor(node) {
        const rect = node?.getBoundingClientRect();
        return rect ? rectToJson(rect) : null;
      }

      function rectToJson(rect) {
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        };
      }
    },
    {
      activeSurfaceKind,
      surfaceKind,
      rootTestId,
      roots: RIGHT_SURFACE_ROOTS,
    },
  );
}

export function isRightSurfaceSnapshotReady(
  snapshot,
  surfaceKind,
  activeSurfaceKind = surfaceKind,
  requireCanvasPanelFill = true,
) {
  const surfaceViewportReady =
    snapshot?.geometry?.rootFillsSurfaceViewport === true &&
    (surfaceKind === "articleWorkspace" ||
      requireCanvasPanelFill === false ||
      snapshot?.geometry?.hostFillsCanvasPanel === true ||
      snapshot?.geometry?.rootFillsActivePane === true);

  return (
    snapshot?.activeSurface === activeSurfaceKind &&
    snapshot?.hostVisible === true &&
    snapshot?.rootVisible === true &&
    Array.isArray(snapshot?.visibleRootKinds) &&
    snapshot.visibleRootKinds.length === 1 &&
    snapshot.visibleRootKinds[0] === surfaceKind &&
    surfaceViewportReady
  );
}

function assertRightSurfaceSnapshot(
  snapshot,
  surfaceKind,
  activeSurfaceKind = surfaceKind,
  requireCanvasPanelFill = true,
) {
  assert(
    isRightSurfaceSnapshotReady(
      snapshot,
      surfaceKind,
      activeSurfaceKind,
      requireCanvasPanelFill,
    ),
    `Right Surface stable snapshot 未保持目标 surface: ${surfaceKind}; snapshot=${JSON.stringify(
      sanitizeJson(snapshot),
    )}`,
  );
}

function summarizeRightSurfaceRequest(invocation) {
  const pending = invocation?.result?.pending ?? {};
  return sanitizeJson({
    requestId: invocation?.result?.requestId ?? pending.requestId ?? null,
    status: invocation?.result?.status ?? pending.status ?? null,
    surfaceKind: pending.surfaceKind ?? null,
    candidateId: pending.candidateId ?? null,
    origin: pending.origin ?? null,
  });
}

function summarizeRightSurfaceRequests(requests) {
  return {
    files: summarizeRightSurfaceRequest(requests.files),
    browser: summarizeRightSurfaceRequest(requests.browser),
  };
}

function summarizePendingList(result) {
  const pending = Array.isArray(result?.pending) ? result.pending : [];
  return sanitizeJson({
    count: pending.length,
    surfaces: pending.map((request) => ({
      requestId: request?.requestId ?? null,
      surfaceKind: request?.surfaceKind ?? null,
      status: request?.status ?? null,
      candidateId: request?.candidateId ?? null,
    })),
  });
}
