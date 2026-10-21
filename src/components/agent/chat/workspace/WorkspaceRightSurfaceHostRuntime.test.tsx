import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderWorkspaceRightSurfaceHostRuntime,
  type RenderWorkspaceRightSurfaceHostRuntimeParams,
} from "./WorkspaceRightSurfaceHostRuntime";
import type { ThreadOutput } from "./right-surface/threadOutputs";
import type { ThreadSidePanelTab } from "./right-surface/threadSidePanelTabs";
import { useWorkspaceRightSurfaceHostRuntime } from "./useWorkspaceRightSurfaceHostRuntime";
import {
  applyWorkspaceRightSurfacePendingChanges,
  buildWorkspaceRightSurfacePendingListParams,
} from "./useWorkspaceRightSurfacePendingRuntime";
import type {
  WorkspaceRightSurfacePendingRequest,
  WorkspaceRightSurfaceRequestParams,
} from "@/lib/api/workspaceRightSurface";

const requestWebsite = vi.hoisted(() =>
  vi.fn<(params: WorkspaceRightSurfaceRequestParams) => Promise<void>>(),
);
vi.mock("@/lib/api/workspaceRightSurface", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/workspaceRightSurface")>()),
  requestWorkspaceRightSurface: requestWebsite,
}));
vi.mock("@/lib/api/projectGit", () => ({
  readProjectGitStatus: vi.fn(async () => ({ available: false })),
}));

vi.mock("../components/TerminalTab", () => ({ TerminalTab: () => null }));
vi.mock("./LocalConversationBackgroundTerminalTab", () => ({
  LocalConversationBackgroundTerminalTab: () => null,
}));
vi.mock("../experts/ExpertInfoPanel", () => ({ ExpertInfoPanel: () => null }));
vi.mock("./WorkspaceHarnessDialogs", () => ({
  GeneralWorkbenchHarnessSurfaceSection: () => null,
}));
vi.mock("./WorkspaceArticleEditorRightSurface", () => ({
  WorkspaceArticleEditorRightSurface: () => null,
}));
vi.mock("./WorkspaceFileThreadSidePanelTab", () => ({
  WorkspaceFileThreadSidePanelTab: () => null,
}));
vi.mock("./ReviewThreadSidePanelTab", () => ({
  ReviewThreadSidePanelTab: () => null,
}));
vi.mock("./WorkspacePluginSurface", () => ({
  WorkspacePluginSurface: () => null,
}));
vi.mock("./WorkspaceTraceTab", () => ({ WorkspaceTraceTab: () => null }));
vi.mock("./right-surface/browser/RightSurfaceBrowserPanel", () => ({
  RightSurfaceBrowserPanel: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  requestWebsite.mockClear();
  requestWebsite.mockResolvedValue(undefined);
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Recents production Host routing", () => {
  it.each([
    [{ type: "website", target: "http://localhost:4317/demo" }, null],
    [{ type: "website", target: "out/index.html" }, "/project/out/index.html"],
    [{ type: "file", path: "/project/report.pdf" }, "/project/report.pdf"],
    [
      { type: "generated-image", path: "/project/image.png" },
      "/project/image.png",
    ],
  ] as const)(
    "routes %j through the existing owner with the reference source-tab policy",
    (resource, path) => {
      const source: ThreadSidePanelTab = {
        tabId: "new-tab:source",
        kind: "workspace-new-tab",
      };
      const output: ThreadOutput = {
        ...resource,
        threadId: "thread",
        turnId: "turn",
        itemId: "item",
      };
      const onOpenWebsite = vi.fn(),
        onOpenWorkspaceFile = vi.fn();
      // 非活动surface的props不会被求值；实际渲染New tab、Recents和共享Host。
      const params = {
        idPrefix: "recents-host",
        outputs: [output],
        onOpenWebsite,
        onOpenWorkspaceFile,
        canvasWorkbenchRootPath: "/project",
        sidePanelActions: [],
        sidePanelTabs: {
          open: true,
          activeTabId: source.tabId,
          tabs: [source],
        },
        rightSurfaceState: {
          activeSurface: "workspace-new-tab",
          previousSurface: null,
          openSurfaces: ["workspace-new-tab"],
          source: "user",
          layoutVariant: "docked",
        },
      } as RenderWorkspaceRightSurfaceHostRuntimeParams;
      act(() =>
        root.render(renderWorkspaceRightSurfaceHostRuntime(params).content),
      );
      const button = container.querySelector<HTMLButtonElement>("ul button")!;
      expect(button).not.toBeNull();
      act(() => button.click());
      if (path) {
        if (resource.type === "website") {
          expect(onOpenWorkspaceFile).toHaveBeenCalledExactlyOnceWith(path);
        } else {
          expect(onOpenWorkspaceFile).toHaveBeenCalledExactlyOnceWith(
            path,
            source,
          );
          expect(onOpenWorkspaceFile.mock.calls[0][1]).toBe(source);
        }
        expect(onOpenWebsite).not.toHaveBeenCalled();
      } else {
        expect(onOpenWebsite).toHaveBeenCalledExactlyOnceWith(
          "http://localhost:4317/demo",
        );
        expect(onOpenWorkspaceFile).not.toHaveBeenCalled();
        expect(
          container.querySelector('[data-testid="thread-side-panel-new-tab"]'),
        ).not.toBeNull();
      }
    },
  );

  it("真实Host hook发出的网站请求能被当前workspace pending消费者接收", async () => {
    const source: ThreadSidePanelTab = {
      tabId: "new-tab:website",
      kind: "workspace-new-tab",
    };
    const tabs = { open: true, activeTabId: source.tabId, tabs: [source] };
    const state = {
      activeSurface: "workspace-new-tab",
      previousSurface: null,
      openSurfaces: ["workspace-new-tab"],
      source: "user",
      layoutVariant: "docked",
    };
    const outputs: ThreadOutput[] = [
      {
        type: "website",
        target: "http://localhost:4317/demo",
        threadId: "thread",
        turnId: "turn",
        itemId: "website-message",
      },
    ];
    const params = {
      sidePanelTabs: tabs,
      rightSurfaceState: state,
      canvasWorkbenchRootPath: "/project",
      runtimeWorkspaceId: "workspace",
      sceneSessionId: "session",
      sceneThreadId: "thread",
      rightSurfaceRuntime: {
        sidePanelTabs: tabs,
        rightSurfaceState: state,
        rightSurfaceLaunchers: [],
        outputs,
        getFileDraft: () => null,
        setFileDraft: vi.fn(),
        handleCloseSidePanelTab: vi.fn(),
        openWorkspaceFile: vi.fn(),
      },
      handleSendRef: { current: vi.fn() },
      restoreInput: vi.fn(),
      setLayoutMode: vi.fn(),
    } as unknown as Parameters<typeof useWorkspaceRightSurfaceHostRuntime>[0];
    function Probe() {
      return useWorkspaceRightSurfaceHostRuntime(params).content;
    }
    await act(async () => root.render(<Probe />));
    const button = container.querySelector<HTMLButtonElement>("ul button")!;
    await act(async () => button.click());
    expect(requestWebsite).toHaveBeenCalledOnce();
    const request = requestWebsite.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      surfaceKind: "browser",
      sessionId: "session",
      workspaceId: "workspace",
      workspaceRoot: "/project",
      priority: "foreground",
      metadata: { browser: { launchUrl: "http://localhost:4317/demo" } },
    });
    const pending = {
      ...request,
      requestId: "website-request",
      status: "pending",
      requestedAt: "2026-10-21T00:00:00Z",
    } as WorkspaceRightSurfacePendingRequest;
    const listParams = buildWorkspaceRightSurfacePendingListParams({
      workspaceId: "workspace",
      workspaceRoot: "/project",
      sessionId: "session",
    });
    expect(
      applyWorkspaceRightSurfacePendingChanges(
        [],
        [{ changeType: "requested", pending: [pending] }],
        listParams,
      ),
    ).toEqual([pending]);
  });
});
