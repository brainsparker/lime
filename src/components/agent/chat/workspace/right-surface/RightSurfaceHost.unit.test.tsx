import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RightSurfaceHost } from "./RightSurfaceHost";
import {
  RightSurfaceTabStrip,
  type RightSurfaceTabStripProps,
} from "./RightSurfaceTabStrip";
import type { RightSurfaceDefinition } from "./rightSurfaceTypes";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const copy: Record<string, string> = {
        "agentChat.rightSurface.tabs.appSurface": "Plugin",
        "agentChat.rightSurface.tabs.browser": "浏览器",
        "agentChat.rightSurface.tabs.articleWorkspace": "文章编辑器",
        "agentChat.rightSurface.tabs.files": "文件",
        "agentChat.rightSurface.tabs.shell": "Shell",
      };
      return copy[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

const definitions: RightSurfaceDefinition[] = [
  {
    kind: "appSurface",
    render: () => <div data-testid="plugin-pane">Plugin</div>,
  },
  {
    kind: "articleWorkspace",
    render: () => <div data-testid="article-workspace-pane">文章详情</div>,
  },
  {
    kind: "files",
    render: () => <div data-testid="files-pane">文件预览</div>,
  },
  {
    kind: "shell",
    render: () => <div data-testid="shell-pane">Shell</div>,
  },
  {
    kind: "browser",
    label: "Example Domain",
    render: () => <div data-testid="browser-pane">Browser</div>,
  },
];

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) {
      break;
    }
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.clearAllMocks();
});

function renderHost(props?: Partial<RightSurfaceTabStripProps>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <>
        <div role="tablist">
          <RightSurfaceTabStrip
            activeSurface="articleWorkspace"
            definitions={definitions}
            openSurfaces={["articleWorkspace", "files", "shell"]}
            idPrefix="surface-fixture"
            {...props}
          />
        </div>
        <RightSurfaceHost
          activeSurface={props?.activeSurface ?? "articleWorkspace"}
          definitions={definitions}
          idPrefix="surface-fixture"
        />
      </>,
    );
  });

  mountedRoots.push({ root, container });
  return container;
}

describe("RightSurfaceHost", () => {
  it("应在同一右侧 Dock 内渲染多个 surface tab，并只显示 active pane", () => {
    const container = renderHost();

    expect(
      container.querySelector('[data-testid="workspace-right-surface-host"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="workspace-right-surface-tabs"]'),
    ).not.toBeNull();
    expect(
      container
        .querySelector(
          '[data-testid="workspace-right-surface-tab-articleWorkspace"]',
        )
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    expect(container.textContent).toContain("文章编辑器");
    expect(container.textContent).toContain("文件");
    expect(container.textContent).toContain("Shell");
    expect(
      container.querySelector('[data-testid="article-workspace-pane"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="files-pane"]')).toBeNull();
  });

  it("点击非 active tab 时应请求切换 surface", () => {
    const onSelectSurface = vi.fn();
    const container = renderHost({ onSelectSurface });

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="workspace-right-surface-tab-files"]',
        )
        ?.click();
    });

    expect(onSelectSurface).toHaveBeenCalledWith("files");
  });

  it("browser tab 应优先显示页面标题", () => {
    const container = renderHost({
      activeSurface: "files",
      openSurfaces: ["files", "browser"],
    });

    expect(container.textContent).toContain("Example Domain");
    expect(
      container
        .querySelector('[data-testid="workspace-right-surface-tab-browser"]')
        ?.getAttribute("aria-label"),
    ).toBe("Example Domain");
  });

  it("单一右侧面仍提供可关联的标签，pane只由内容host承载", () => {
    const container = renderHost({ openSurfaces: ["articleWorkspace"] });
    const tab = container.querySelector('[role="tab"]')!;
    const pane = container.querySelector('[role="tabpanel"]')!;
    expect(tab.getAttribute("aria-controls")).toBe(pane.id);
    expect(pane.getAttribute("aria-labelledby")).toBe(tab.id);
    expect(
      container.querySelector(
        '[data-testid="workspace-right-surface-host"] [role="tablist"]',
      ),
    ).toBeNull();
  });

  it("关闭及Delete委托同一owner，去重并排除不可用标签", () => {
    const close = vi.fn();
    const container = renderHost({
      openSurfaces: ["files", "files", "workbench", "articleWorkspace"],
      onCloseSurface: close,
    });
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
    const files = container.querySelector(
      '[data-testid="workspace-right-surface-tab-files"]',
    )!;
    act(() =>
      files.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Delete", bubbles: true }),
      ),
    );
    expect(close).toHaveBeenLastCalledWith("files");
    const button = container
      .querySelector(
        '[data-testid="workspace-right-surface-tab-articleWorkspace"]',
      )
      ?.parentElement?.querySelector<HTMLButtonElement>(
        "button:not([role=tab])",
      );
    act(() => button?.click());
    expect(close).toHaveBeenLastCalledWith("articleWorkspace");
  });
});
