import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Virtualizer } from "@tanstack/react-virtual";
import { changeLimeLocale } from "@/i18n/createI18n";
import { PdfPreviewPanel } from "./PdfPreviewPanel";
import type { PdfDocumentSnapshot } from "./pdfDocument";
import {
  ArtifactCommentSubmissionContext,
  type ArtifactCommentSubmission,
} from "../ArtifactCommentSubmissionContext";
import { ArtifactAnnotationDraftStore } from "../annotations/ArtifactAnnotationDraftStore";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  isAbsolutePath: vi.fn(),
  virtualizer: null as unknown,
  onChange: null as unknown,
}));
vi.mock("@tanstack/react-virtual", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-virtual")>();
  return {
    ...actual,
    useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) => {
      mocks.onChange = options.onChange;
      const instance = actual.useVirtualizer(options);
      mocks.virtualizer = instance;
      return instance;
    },
  };
});
vi.mock("./pdfDocument", () => ({
  loadPdfDocument: mocks.load,
  isPdfPasswordError: (error: Error) => error.name === "PasswordException",
}));
vi.mock("@/lib/api/fileSystem", () => ({
  isAbsoluteLocalFilePath: mocks.isAbsolutePath,
}));
vi.mock("./PdfPageView", () => ({
  PdfPageView: () => <div data-testid="pdf-page" />,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function documentWithPages(numPages: number) {
  return {
    document: {
      numPages,
      getPage: vi.fn().mockResolvedValue({
        getViewport: () => ({ width: 600, height: 800 }),
      }),
    } as unknown as PDFDocumentProxy,
    sourceSha256: "a".repeat(64),
  };
}

describe("PdfPreviewPanel 文件生命周期", () => {
  let root: Root;
  let container: HTMLDivElement;
  let first: ReturnType<typeof deferred<PdfDocumentSnapshot>>;
  let destroy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    await changeLimeLocale("zh-CN");
    first = deferred<PdfDocumentSnapshot>();
    destroy = vi.fn().mockResolvedValue(undefined);
    mocks.load.mockReset().mockReturnValue({ promise: first.promise, destroy });
    mocks.isAbsolutePath
      .mockReset()
      .mockImplementation((path: string) => path.startsWith("/"));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await changeLimeLocale("zh-CN");
  });

  const render = async (path = "/tmp/a.pdf", version = "1") => {
    await act(async () =>
      root.render(
        <PdfPreviewPanel
          path={path}
          title="研究.pdf"
          previewRequestKey={version}
        />,
      ),
    );
  };
  const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    )!;

  it("重开后的批注定位在默认分页初始化后生效，不被滚回第一页", async () => {
    const drafts = new ArtifactAnnotationDraftStore();
    drafts.create("s1:t1", {
      format: "pdf",
      id: "note2",
      path: "/tmp/a.pdf",
      sourceSha256: "a".repeat(64),
      pageNumber: 2,
      pageCount: 3,
      pageSize: { width: 600, height: 800 },
      anchor: { kind: "point", point: { x: 80, y: 120 } },
    });
    drafts.getSnapshot()[0].controller.setText("回到第二页");
    drafts.focus("note2", "reopen-2");
    await act(async () =>
      root.render(
        <ArtifactCommentSubmissionContext.Provider
          value={{
            scopeKey: "s1:t1:epoch1",
            draftScopeKey: "s1:t1",
            drafts,
            submit: vi.fn().mockResolvedValue("rejected"),
          }}
        >
          <PdfPreviewPanel
            path="/tmp/a.pdf"
            title="研究.pdf"
            previewRequestKey="reopen-2"
          />
        </ArtifactCommentSubmissionContext.Provider>,
      ),
    );
    const scroll = vi.spyOn(
      mocks.virtualizer as Virtualizer<Element, Element>,
      "scrollToIndex",
    );
    await act(async () => first.resolve(documentWithPages(3)));
    expect(container.querySelector("textarea")?.value).toBe("回到第二页");
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("2");
    expect(scroll).toHaveBeenLastCalledWith(1, { align: "start" });
    expect(drafts.getFocusSnapshot()).toBeNull();
  });

  it("加载实际文件后显示页数，翻页和缩放都不重新读取文件", async () => {
    await render();
    expect(container.querySelector("[role=status]")?.textContent).toContain(
      "正在加载",
    );
    await act(async () => first.resolve(documentWithPages(3)));
    expect(container.textContent).toContain("/ 3");
    expect(button("上一页").disabled).toBe(true);
    await act(async () => button("下一页").click());
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("2");
    await act(async () => button("放大").click());
    expect(container.textContent).toContain("125%");
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith("/tmp/a.pdf");
  });

  it("尺寸测量不回写第一页，用户实际滚动仍更新当前页", async () => {
    await render();
    await act(async () => first.resolve(documentWithPages(3)));
    await act(async () => button("下一页").click());
    const onChange = mocks.onChange as (
      instance: unknown,
      scrolling: boolean,
    ) => void;
    const viewport = {
      scrollOffset: 0,
      getVirtualItems: () => [{ index: 0, end: 800 }],
    };
    await act(async () => onChange(viewport, false));
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("2");
    await act(async () => onChange(viewport, true));
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("1");
  });

  it("切换文件会取消旧加载，迟到成功不能覆盖新文件", async () => {
    const second = deferred<PdfDocumentSnapshot>();
    const destroySecond = vi.fn().mockResolvedValue(undefined);
    await render();
    mocks.load.mockReturnValueOnce({
      promise: second.promise,
      destroy: destroySecond,
    });
    await render("/tmp/b.pdf");
    expect(destroy).toHaveBeenCalledTimes(1);
    await act(async () => second.resolve(documentWithPages(2)));
    await act(async () => first.resolve(documentWithPages(7)));
    expect(container.textContent).toContain("/ 2");
    expect(container.textContent).not.toContain("/ 7");
  });

  it("适合宽度一次恢复缩放并保持宽度模式，重复点击不退出", async () => {
    await render();
    await act(async () => first.resolve(documentWithPages(3)));
    await act(async () => button("放大").click());
    const fit = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent === "适合宽度",
    )!;
    await act(async () => fit.click());
    expect(container.textContent).toContain("100%");
    expect(fit.getAttribute("aria-pressed")).toBeNull();
    await act(async () => fit.click());
    expect(container.textContent).toContain("100%");
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it("相同路径的新版本也会释放旧文档并重置页面", async () => {
    await render();
    await act(async () => first.resolve(documentWithPages(3)));
    await act(async () => button("下一页").click());
    const next = deferred<PdfDocumentSnapshot>();
    mocks.load.mockReturnValueOnce({
      promise: next.promise,
      destroy: vi.fn().mockResolvedValue(undefined),
    });
    await render("/tmp/a.pdf", "2");
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-status=loading]")).not.toBeNull();
    await act(async () => next.resolve(documentWithPages(1)));
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("1");
    expect(button("下一页").disabled).toBe(true);
  });

  it("损坏文件失败可重试，旧失败不能污染重试结果", async () => {
    await render();
    await act(async () => first.reject(new Error("untrusted file detail")));
    expect(container.querySelector("[role=alert]")?.textContent).toContain(
      "无法显示",
    );
    expect(container.textContent).not.toContain("untrusted file detail");
    const retry = deferred<PdfDocumentSnapshot>();
    mocks.load.mockReturnValueOnce({
      promise: retry.promise,
      destroy: vi.fn().mockResolvedValue(undefined),
    });
    await act(async () =>
      container.querySelector<HTMLButtonElement>("button")!.click(),
    );
    expect(destroy).toHaveBeenCalledTimes(1);
    await act(async () => retry.resolve(documentWithPages(4)));
    expect(container.textContent).toContain("/ 4");
  });

  it("相对路径不启动 PDF 引擎", async () => {
    mocks.isAbsolutePath.mockReturnValue(false);
    await render("relative.pdf");
    expect(container.querySelector("[role=alert]")).not.toBeNull();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("卸载会取消字节读取，迟到拒绝不会触发新状态", async () => {
    await render();
    await act(async () => root.render(null));
    expect(destroy).toHaveBeenCalledTimes(1);
    await act(async () => first.reject(new Error("late")));
    expect(container.innerHTML).toBe("");
  });

  it("关闭及切换文件后可恢复同会话批注，其他会话不可见", async () => {
    const drafts = new ArtifactAnnotationDraftStore();
    drafts.create("thread1", {
      format: "pdf" as const,
      id: "note1",
      path: "/tmp/a.pdf",
      sourceSha256: "a".repeat(64),
      pageNumber: 2,
      pageCount: 3,
      pageSize: { width: 600, height: 800 },
      anchor: { kind: "point", point: { x: 100, y: 200 } },
    });
    drafts.getSnapshot()[0].controller.setText("未提交的正文");
    const submission: ArtifactCommentSubmission = {
      scopeKey: "thread1:epoch1",
      draftScopeKey: "thread1",
      drafts,
      submit: vi.fn(),
    };
    const show = async (path: string, value = submission) =>
      act(async () =>
        root.render(
          <ArtifactCommentSubmissionContext.Provider value={value}>
            <PdfPreviewPanel path={path} title="研究.pdf" />
          </ArtifactCommentSubmissionContext.Provider>,
        ),
      );
    const comments = () => button("批注（1）");
    const open = async () => {
      await act(async () => comments().click());
      await act(async () =>
        Array.from(container.querySelectorAll("aside button"))
          .find((element) => element.textContent?.includes("未提交的正文"))!
          .dispatchEvent(new MouseEvent("click", { bubbles: true })),
      );
      expect(container.querySelector("textarea")?.value).toBe("未提交的正文");
    };
    await show("/tmp/a.pdf");
    await act(async () => first.resolve(documentWithPages(3)));
    await open();
    await act(async () => button("关闭批注").click());
    expect(container.querySelector("textarea")).toBeNull();
    await show("/tmp/b.pdf");
    expect(comments()).toBeNull();
    await show("/tmp/a.pdf");
    await open();
    await show("/tmp/a.pdf", {
      ...submission,
      scopeKey: "thread2:epoch2",
      draftScopeKey: "thread2",
    });
    expect(comments()).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    await show("/tmp/a.pdf", { ...submission, scopeKey: "thread1:epoch3" });
    expect(container.querySelector("textarea")).toBeNull();
    await open();
    expect(drafts.getSnapshot()).toHaveLength(1);
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
    "%s 覆盖密码失败、重试和工具栏的实际文案",
    async (locale) => {
      await changeLimeLocale(locale);
      await render();
      const error = new Error("password");
      error.name = "PasswordException";
      await act(async () => first.reject(error));
      expect(container.querySelector("[role=alert]")?.textContent).toBeTruthy();
      expect(container.textContent).not.toContain("workspace.pdfPreview.");
      const retry = deferred<PdfDocumentSnapshot>();
      mocks.load.mockReturnValueOnce({
        promise: retry.promise,
        destroy: vi.fn().mockResolvedValue(undefined),
      });
      await act(async () =>
        container.querySelector<HTMLButtonElement>("button")!.click(),
      );
      await act(async () => retry.resolve(documentWithPages(2)));
      expect(
        container.querySelector("[role=toolbar]")?.getAttribute("aria-label"),
      ).toBeTruthy();
      expect(container.innerHTML).not.toContain("workspace.pdfPreview.");
    },
  );
});
