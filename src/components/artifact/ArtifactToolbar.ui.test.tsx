import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { Artifact } from "@/lib/artifact/types";
import { registerLightweightRenderers } from "./renderers";
import { ArtifactToolbar } from "./ArtifactToolbar";
import { Provider, createStore } from "jotai";
import {
  presentationControllersAtom,
  type PresentationController,
} from "./presentation/PresentationController";
import {
  workbookControllersAtom,
  type WorkbookController,
} from "./workbook/WorkbookController";

const openHtmlPreviewWindowMock = vi.hoisted(() => vi.fn());
const openPathWithDefaultAppMock = vi.hoisted(() => vi.fn());
const hasDesktopHostInvokeCapabilityMock = vi.hoisted(() => vi.fn());
const openExternalUrlWithSystemBrowserMock = vi.hoisted(() => vi.fn());
const readFileBytesMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));
vi.mock("@/lib/api/fileBrowser", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/api/fileBrowser")>()),
  readFileBytes: readFileBytesMock,
}));

vi.mock("@/lib/api/fileSystem", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/fileSystem")>();
  return {
    ...actual,
    openHtmlPreviewWindow: openHtmlPreviewWindowMock,
    openPathWithDefaultApp: openPathWithDefaultAppMock,
  };
});

vi.mock("@/lib/desktop-runtime", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/desktop-runtime")>();
  return {
    ...actual,
    hasDesktopHostInvokeCapability: hasDesktopHostInvokeCapabilityMock,
  };
});

vi.mock("@/lib/api/externalUrl", () => ({
  openExternalUrlWithSystemBrowser: openExternalUrlWithSystemBrowserMock,
}));

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function buildArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "artifact-toolbar-1",
    type: "code",
    title: "index.html",
    content: "<main>Hello</main>",
    status: "streaming",
    meta: {
      language: "html",
      writePhase: "streaming",
    },
    position: { start: 0, end: 18 },
    createdAt: 1_777_777_000,
    updatedAt: 1_777_777_999,
    ...overrides,
  };
}

function renderToolbar(
  artifact = buildArtifact(),
  store = createStore(),
  callbacks: Partial<ComponentProps<typeof ArtifactToolbar>> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <Provider store={store}>
        <ArtifactToolbar
          artifact={artifact}
          viewMode="preview"
          previewSize="mobile"
          onViewModeChange={vi.fn()}
          onPreviewSizeChange={vi.fn()}
          onClose={vi.fn()}
          tone="light"
          {...callbacks}
        />
      </Provider>,
    );
  });

  mountedRoots.push({ root, container });
  return container;
}

function expectButtonTitle(container: HTMLElement, title: string) {
  expect(container.querySelector(`button[title="${title}"]`)).not.toBeNull();
}

function queryButtonByTitle(container: HTMLElement, title: string) {
  return container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
}

it.each(["close", "source"] as const)(
  "%s 在保存成功前不离开预览，失败保留可见文件",
  async (action) => {
    const store = createStore();
    let resolve!: (value: boolean) => void;
    const flushPublicFile = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const path = "/workspace/local.pptx";
    store
      .get(presentationControllersAtom)
      .set(path, { flushPublicFile } as unknown as PresentationController);
    const onClose = vi.fn(),
      onViewModeChange = vi.fn();
    const container = renderToolbar(
      buildArtifact({ type: "document", meta: { sourcePath: path } }),
      store,
      { onClose, onViewModeChange },
    );
    const title = action === "close" ? "Close" : "Source";
    const target = queryButtonByTitle(container, title)!;
    expect(target).not.toBeNull();
    await act(async () => target.click());
    expect(flushPublicFile).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onViewModeChange).not.toHaveBeenCalled();
    await act(async () => resolve(false));
    expect(onClose).not.toHaveBeenCalled();
    expect(onViewModeChange).not.toHaveBeenCalled();
    await act(async () => target.click());
    await act(async () => resolve(true));
    if (action === "close") expect(onClose).toHaveBeenCalledTimes(1);
    else expect(onViewModeChange).toHaveBeenCalledExactlyOnceWith("source");
  },
);

beforeEach(async () => {
  readFileBytesMock.mockReset();
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn(async () => undefined),
    },
  });

  registerLightweightRenderers();
  openHtmlPreviewWindowMock.mockResolvedValue(false);
  openPathWithDefaultAppMock.mockResolvedValue(undefined);
  openExternalUrlWithSystemBrowserMock.mockResolvedValue(undefined);
  hasDesktopHostInvokeCapabilityMock.mockReturnValue(false);
  await changeLimeLocale("en-US");
});

afterEach(async () => {
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

  await changeLimeLocale("zh-CN");
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("ArtifactToolbar", () => {
  const fileArtifact = () =>
    buildArtifact({
      type: "document",
      title: "slides.pptx",
      content: "This projection must never become the downloaded PPTX",
      meta: {
        filename: "slides.pptx",
        filePath: "/workspace/slides.pptx",
        renderMode: "presentation",
        isSourceBacked: true,
      },
    });
  const withFileEditor = (flushPublicFile: () => Promise<boolean>) => {
    const store = createStore();
    store.get(presentationControllersAtom).set("/workspace/slides.pptx", {
      flushPublicFile,
    } as PresentationController);
    return store;
  };
  const clickAction = async (container: HTMLElement, title: string) => {
    await act(async () => {
      queryButtonByTitle(container, title)!.click();
    });
  };

  it.each([
    {
      meta: { filePath: "/workspace/My slides.pptx" },
      filename: "My slides.pptx",
    },
    {
      meta: { filePath: "C:\\workspace\\年度报告.pptx" },
      filename: "年度报告.pptx",
    },
    {
      meta: { sourcePath: "\\\\server\\share\\slides.pptx" },
      filename: "slides.pptx",
    },
    {
      meta: {
        filePath: "/workspace/slides.pptx",
        filename: "exported.pptx",
      },
      filename: "exported.pptx",
    },
  ])("下载真实源文件时保留名称 $filename", async ({ meta, filename }) => {
    readFileBytesMock.mockResolvedValue(new Uint8Array([80, 75]));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:source-file"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const downloadedNames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedNames.push(this.download);
    });
    const container = renderToolbar(
      buildArtifact({
        type: "document",
        title: "演示文稿预览",
        content: "Preview projection",
        meta: { ...meta, renderMode: "presentation" },
      }),
    );

    await clickAction(container, "Download file");

    expect(readFileBytesMock).toHaveBeenCalledWith(
      meta.filePath || meta.sourcePath,
    );
    expect(downloadedNames).toEqual([filename]);
  });

  it("Workbook 系统打开委托同路径编辑 owner 保存后再执行", async () => {
    const path = "/workspace/data.xlsx";
    const flush = vi.fn(async () => true);
    const store = createStore();
    store.get(workbookControllersAtom).set(path, {
      flushPublicFile: flush,
    } as WorkbookController);
    const container = renderToolbar(
      buildArtifact({
        type: "document",
        title: "数据预览",
        content: "Workbook projection",
        meta: { sourcePath: path, renderMode: "workbook" },
      }),
      store,
    );

    await clickAction(container, "Open in new window");

    expect(flush).toHaveBeenCalledTimes(1);
    expect(openPathWithDefaultAppMock).toHaveBeenCalledWith(path);
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
      openPathWithDefaultAppMock.mock.invocationCallOrder[0],
    );
    expect(openHtmlPreviewWindowMock).not.toHaveBeenCalled();
  });

  it("保存成功后下载真实二进制，不使用预览正文，并阻止重复动作", async () => {
    let finishSave!: (value: boolean) => void;
    const flush = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve;
        }),
    );
    const bytes = new Uint8Array([80, 75, 0, 255, 128, 13, 10]);
    readFileBytesMock.mockResolvedValue(bytes);
    const createUrl = vi.fn((_blob: Blob) => "blob:original-pptx");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const container = renderToolbar(fileArtifact(), withFileEditor(flush));
    await clickAction(container, "Download file");
    await clickAction(container, "Download file");
    expect(flush).toHaveBeenCalledTimes(1);
    expect(readFileBytesMock).not.toHaveBeenCalled();
    expect(createUrl).not.toHaveBeenCalled();
    await act(async () => {
      finishSave(true);
    });
    expect(readFileBytesMock).toHaveBeenCalledWith("/workspace/slides.pptx");
    expect(createUrl).toHaveBeenCalledTimes(1);
    const downloaded = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = reject;
      reader.readAsArrayBuffer(createUrl.mock.calls[0][0]);
    });
    expect(downloaded).toEqual(bytes);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:original-pptx");
  });

  it("保存失败阻止下载和系统打开，保留可重试入口", async () => {
    const flush = vi.fn(async () => false);
    const container = renderToolbar(fileArtifact(), withFileEditor(flush));
    await clickAction(container, "Download file");
    await clickAction(container, "Open in new window");
    expect(flush).toHaveBeenCalledTimes(2);
    expect(readFileBytesMock).not.toHaveBeenCalled();
    expect(openPathWithDefaultAppMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Unable to save. Your edits are preserved. Retry before continuing.",
    );
    expect(queryButtonByTitle(container, "Download file")?.disabled).toBe(
      false,
    );
  });

  it("系统打开等待保存后使用原路径，不打开文本投影窗口", async () => {
    let finishSave!: (value: boolean) => void;
    const flush = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve;
        }),
    );
    const openWindow = vi.spyOn(window, "open").mockReturnValue(null);
    const container = renderToolbar(fileArtifact(), withFileEditor(flush));
    await clickAction(container, "Open in new window");
    expect(openPathWithDefaultAppMock).not.toHaveBeenCalled();
    await act(async () => {
      finishSave(true);
    });
    expect(openPathWithDefaultAppMock).toHaveBeenCalledWith(
      "/workspace/slides.pptx",
    );
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("真实读取期间切换文件再返回也取消旧下载", async () => {
    let finishRead!: (value: Uint8Array) => void;
    readFileBytesMock.mockImplementation(
      () =>
        new Promise<Uint8Array>((resolve) => {
          finishRead = resolve;
        }),
    );
    const createUrl = vi.fn(() => "blob:stale");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createUrl,
    });
    const store = withFileEditor(async () => true);
    const artifact = fileArtifact();
    const container = renderToolbar(artifact, store);
    await clickAction(container, "Download file");
    expect(readFileBytesMock).toHaveBeenCalledTimes(1);
    const root = mountedRoots.at(-1)!.root;
    act(() => {
      root.render(
        <Provider store={store}>
          <ArtifactToolbar artifact={buildArtifact()} />
        </Provider>,
      );
    });
    act(() => {
      root.render(
        <Provider store={store}>
          <ArtifactToolbar artifact={artifact} />
        </Provider>,
      );
    });
    await act(async () => {
      finishRead(new Uint8Array([80, 75]));
    });
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("读取失败不回退预览文本，显示错误并允许重试", async () => {
    readFileBytesMock.mockRejectedValue(new Error("file missing"));
    const createUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createUrl,
    });
    const container = renderToolbar(
      fileArtifact(),
      withFileEditor(async () => true),
    );
    await clickAction(container, "Download file");
    expect(createUrl).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      "The file action failed. Please retry.",
    );
    expect(queryButtonByTitle(container, "Download file")?.disabled).toBe(
      false,
    );
  });

  it("应通过 workspace namespace 渲染英文工具栏 chrome", () => {
    const container = renderToolbar();
    const text = container.textContent ?? "";

    expect(text).toContain("Code");
    expect(text).toContain("Writing");
    expect(text).not.toContain("代码");
    expect(text).not.toContain("正在写入");
    expectButtonTitle(container, "Source");
    expectButtonTitle(container, "Preview");
    expectButtonTitle(container, "Phone");
    expectButtonTitle(container, "Tablet");
    expectButtonTitle(container, "Desktop");
    expectButtonTitle(container, "Copy content");
    expectButtonTitle(container, "Download file");
    expectButtonTitle(container, "Open in new window");
    expectButtonTitle(container, "Close");
  });

  it("有绝对本地 HTML 路径时应优先使用 Desktop Host 独立预览窗口", async () => {
    openHtmlPreviewWindowMock.mockResolvedValueOnce(true);
    const openWindow = vi.fn();
    vi.spyOn(window, "open").mockImplementation(openWindow);
    const container = renderToolbar(
      buildArtifact({
        meta: {
          language: "html",
          filePath: "/tmp/lime/artifacts/index.html",
        },
      }),
    );

    await act(async () => {
      queryButtonByTitle(container, "Open in new window")?.click();
      await Promise.resolve();
    });

    expect(openHtmlPreviewWindowMock).toHaveBeenCalledWith(
      "/tmp/lime/artifacts/index.html",
      { title: "index.html" },
    );
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("无绝对本地路径时保留内存内容预览，不误走 Desktop Host 文件预览", async () => {
    const documentClose = vi.fn();
    const documentWrite = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({
      document: {
        write: documentWrite,
        close: documentClose,
      },
    } as unknown as Window);
    const container = renderToolbar(
      buildArtifact({
        meta: {
          language: "html",
          filePath: "relative/index.html",
        },
      }),
    );

    await act(async () => {
      queryButtonByTitle(container, "Open in new window")?.click();
      await Promise.resolve();
    });

    expect(openHtmlPreviewWindowMock).not.toHaveBeenCalled();
    expect(documentWrite).toHaveBeenCalledWith("<main>Hello</main>");
    expect(documentClose).toHaveBeenCalledTimes(1);
  });

  it("Desktop Host 预览窗口失败时不应回退浏览器空白窗口", async () => {
    openHtmlPreviewWindowMock.mockResolvedValueOnce(false);
    hasDesktopHostInvokeCapabilityMock.mockReturnValue(true);
    const openWindow = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(window, "open").mockImplementation(openWindow);
    const container = renderToolbar(
      buildArtifact({
        meta: {
          language: "html",
          filePath: "/tmp/lime/artifacts/index.html",
        },
      }),
    );

    await act(async () => {
      queryButtonByTitle(container, "Open in new window")?.click();
      await Promise.resolve();
    });

    expect(openHtmlPreviewWindowMock).toHaveBeenCalledWith(
      "/tmp/lime/artifacts/index.html",
      { title: "index.html" },
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Desktop Host HTML 预览窗口创建失败",
    );
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("source-backed preview artifact 应按 renderMode 使用独立窗口", async () => {
    openHtmlPreviewWindowMock.mockResolvedValueOnce(true);
    const openWindow = vi.fn();
    vi.spyOn(window, "open").mockImplementation(openWindow);
    const container = renderToolbar(
      buildArtifact({
        type: "document",
        title: "prototype.html",
        content: "",
        meta: {
          previewArtifact: true,
          sourcePath: "/tmp/lime/artifacts/prototype.html",
          renderMode: "external_window",
          capabilities: {
            externalWindow: true,
          },
        },
      }),
    );

    await act(async () => {
      queryButtonByTitle(container, "Open in new window")?.click();
      await Promise.resolve();
    });

    expect(openHtmlPreviewWindowMock).toHaveBeenCalledWith(
      "/tmp/lime/artifacts/prototype.html",
      { title: "prototype.html" },
    );
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("system_open preview artifact 应通过系统默认应用打开真实文件", async () => {
    const openWindow = vi.fn();
    vi.spyOn(window, "open").mockImplementation(openWindow);
    const container = renderToolbar(
      buildArtifact({
        type: "document",
        title: "archive.zip",
        content: "该文件暂不支持在工作台内嵌预览。",
        meta: {
          previewArtifact: true,
          sourcePath: "/tmp/lime/archive.zip",
          renderMode: "system_open",
          capabilities: {
            systemOpen: true,
          },
        },
      }),
    );

    await act(async () => {
      queryButtonByTitle(container, "Open in new window")?.click();
      await Promise.resolve();
    });

    expect(openPathWithDefaultAppMock).toHaveBeenCalledWith(
      "/tmp/lime/archive.zip",
    );
    expect(openHtmlPreviewWindowMock).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("URL preview artifact 应通过统一外部链接通道打开来源网页", async () => {
    const openWindow = vi.fn();
    vi.spyOn(window, "open").mockImplementation(openWindow);
    const container = renderToolbar(
      buildArtifact({
        type: "document",
        title: "在线报告",
        content: "导入摘要",
        meta: {
          previewArtifact: true,
          source: "url",
          sourceRef: "https://example.com/report",
          sourcePath: "https://example.com/report",
          renderMode: "inline",
        },
      }),
    );

    await act(async () => {
      queryButtonByTitle(container, "Open in new window")?.click();
      await Promise.resolve();
    });

    expect(openExternalUrlWithSystemBrowserMock).toHaveBeenCalledWith(
      "https://example.com/report",
    );
    expect(openPathWithDefaultAppMock).not.toHaveBeenCalled();
    expect(openHtmlPreviewWindowMock).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });
});
