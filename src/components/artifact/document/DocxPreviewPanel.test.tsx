import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { DocxPreviewPanel } from "./DocxPreviewPanel";
import type { DocxDocumentSnapshot } from "./docxDocument";
import {
  ArtifactCommentSubmissionContext,
  type ArtifactCommentSubmission,
} from "../ArtifactCommentSubmissionContext";
import { ArtifactAnnotationDraftStore } from "../annotations/ArtifactAnnotationDraftStore";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./docxDocument", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./docxDocument")>()),
  loadDocxDocument: mocks.load,
}));
const snapshot = (text = "CURRENT") => ({
  sourceSha256: "a".repeat(64),
  pageCount: 2,
  pageWidths: [640, 640],
  hasRedlines: true,
  html: `<section class="docx" data-docx-page="1">${text}</section><section class="docx" data-docx-page="2">SECOND</section>`,
});

describe("DOCX 页面生命周期", () => {
  let root: Root;
  let container: HTMLDivElement;
  let loadedFrames: WeakSet<HTMLIFrameElement>;
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    await changeLimeLocale("zh-CN");
    mocks.load.mockReset().mockResolvedValue(snapshot());
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    loadedFrames = new WeakSet();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    await changeLimeLocale("zh-CN");
  });
  const loadFrame = () =>
    act(async () => {
      const frame = container.querySelector("iframe");
      if (!frame?.contentDocument || loadedFrames.has(frame)) return;
      loadedFrames.add(frame);
      const parsed = new DOMParser().parseFromString(frame.srcdoc, "text/html");
      frame.contentDocument.body.innerHTML = parsed.body.innerHTML;
      frame.dispatchEvent(new Event("load"));
    });
  const show = async (
    path = "/tmp/current.docx",
    version = "1",
    submission: ArtifactCommentSubmission | null = null,
  ) => {
    await act(async () => {
      root.render(
        <ArtifactCommentSubmissionContext.Provider value={submission}>
          <DocxPreviewPanel
            path={path}
            title="Report.docx"
            previewRequestKey={version}
          />
        </ArtifactCommentSubmissionContext.Provider>,
      );
    });
    await loadFrame();
  };
  const button = (name: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
  const prepareBatch = () => {
    const drafts = new ArtifactAnnotationDraftStore();
    for (const [index, body] of ["第一条批注", "第二条批注"].entries()) {
      drafts.create("thread1", {
        id: `batch-${index}`,
        format: "docx",
        path: "/tmp/current.docx",
        sourceSha256: "a".repeat(64),
        pageNumber: index + 1,
        pageCount: 2,
        pageSize: { width: 640, height: 800 },
        anchor: { kind: "point", point: { x: 100, y: 200 } },
      });
      drafts.getSnapshot()[index].controller.setText(body);
    }
    const submit = vi
      .fn<ArtifactCommentSubmission["submit"]>()
      .mockResolvedValue("rejected");
    return {
      drafts,
      submit,
      submission: {
        scopeKey: "thread1:epoch1",
        draftScopeKey: "thread1",
        drafts,
        submit,
      },
    };
  };

  it("旧预览不消费绑定新预览的聚焦，重挂载后原页编辑卡恢复", async () => {
    const batch = prepareBatch();
    await show("/tmp/current.docx", "old-preview", batch.submission);
    await act(async () => batch.drafts.focus("batch-1", "next-preview"));
    expect(container.querySelector("textarea")).toBeNull();
    expect(batch.drafts.getFocusSnapshot()).toMatchObject({
      id: "batch-1",
      previewRequestKey: "next-preview",
    });
    await act(async () => root.render(null));
    await show("/tmp/current.docx", "next-preview", batch.submission);
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("2");
    expect(container.querySelector("textarea")?.value).toBe("第二条批注");
    expect(batch.drafts.getFocusSnapshot()).toBeNull();
    expect(batch.submit).not.toHaveBeenCalled();
  });

  it("主 Composer 的聚焦请求打开同一草稿和原页，重复请求仍响应", async () => {
    const batch = prepareBatch();
    await show("/tmp/current.docx", "1", batch.submission);
    await act(async () => batch.drafts.focus("batch-1"));
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("2");
    expect(container.querySelector("textarea")?.value).toBe("第二条批注");
    await act(async () => button("关闭批注").click());
    await act(async () => batch.drafts.focus("batch-1"));
    expect(container.querySelector("textarea")?.value).toBe("第二条批注");
    expect(batch.drafts.getFocusSnapshot()).toBeNull();
    await act(async () => button("关闭批注").click());
    await show("/tmp/other.docx", "2", batch.submission);
    await show("/tmp/current.docx", "3", batch.submission);
    expect(container.querySelector("textarea")).toBeNull();
    expect(batch.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["zh-CN", "发送全部批注", "下一条批注", "关闭批注"],
    ["zh-TW", "傳送全部註解", "下一則註解", "關閉註解"],
    ["en-US", "Send all annotations", "Next annotation", "Close comment"],
    ["ja-JP", "すべてのコメントを送信", "次のコメント", "コメントを閉じる"],
    ["ko-KR", "모든 주석 보내기", "다음 주석", "주석 닫기"],
  ] as const)(
    "%s 批次审阅、跨页导航、失败重试与一次接受清稿",
    async (locale, send, next, close) => {
      await changeLimeLocale(locale);
      const batch = prepareBatch();
      await show("/tmp/current.docx", "1", batch.submission);
      await act(async () =>
        container
          .querySelector<HTMLButtonElement>("button[aria-expanded]")!
          .click(),
      );
      await act(async () =>
        container.querySelector<HTMLButtonElement>("aside button")!.click(),
      );
      expect(container.querySelector("textarea")?.value).toBe("第一条批注");
      await act(async () => button(next).click());
      expect(container.querySelector("textarea")?.value).toBe("第二条批注");
      expect(container.querySelector<HTMLInputElement>("input")?.value).toBe(
        "2",
      );
      await act(async () => button(close).click());
      const sendButton = () =>
        Array.from(
          container.querySelectorAll<HTMLButtonElement>(
            '[data-testid="document-annotation-batch-controls"] button',
          ),
        ).find((button) => button.textContent === send)!;
      await act(async () => sendButton().click());
      expect(batch.submit).toHaveBeenCalledOnce();
      expect(container.querySelector("[role=alert]")?.textContent).toBeTruthy();
      expect(
        batch.drafts
          .getSnapshot()
          .map((draft) => draft.controller.getDocument().text),
      ).toEqual(["第一条批注", "第二条批注"]);
      batch.submit.mockResolvedValueOnce("accepted");
      await act(async () => sendButton().click());
      expect(batch.submit).toHaveBeenCalledTimes(2);
      expect(batch.drafts.getSnapshot()).toHaveLength(0);
      expect(
        container.querySelector(
          '[data-testid="document-annotation-batch-controls"]',
        ),
      ).toBeNull();
    },
  );

  it("批次在途阻止重发，接受仅清除所捕获 revision；取消不影响其他文件和会话", async () => {
    const batch = prepareBatch();
    const captured = batch.drafts.getSnapshot();
    let resolve!: (result: "accepted") => void;
    batch.submit.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await show("/tmp/current.docx", "1", batch.submission);
    const send = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "发送全部批注",
      )!;
    await act(async () => {
      send().click();
      send().click();
    });
    expect(batch.submit).toHaveBeenCalledOnce();
    await act(async () => captured[0].controller.setText("发送期间的新输入"));
    await act(async () => resolve("accepted"));
    expect(batch.drafts.getSnapshot()).toHaveLength(1);
    expect(batch.drafts.getSnapshot()[0].controller.getDocument().text).toBe(
      "发送期间的新输入",
    );
    const comment = {
      ...captured[0].comment,
      id: "other-file",
      path: "/tmp/other.docx",
    };
    await act(async () => {
      batch.drafts.create("thread1", comment);
      batch.drafts.create("thread2", {
        ...comment,
        id: "other-thread",
        path: "/tmp/current.docx",
      });
    });
    await act(async () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "取消全部批注")!
        .click(),
    );
    expect(batch.drafts.getSnapshot().map((draft) => draft.comment.id)).toEqual(
      ["other-file", "other-thread"],
    );
    expect(batch.submit).toHaveBeenCalledOnce();
  });

  it.each([
    ["zh-CN", "添加批注", "关闭批注"],
    ["zh-TW", "新增註解", "關閉註解"],
    ["en-US", "Add comment", "Close comment"],
    ["ja-JP", "コメントを追加", "コメントを閉じる"],
    ["ko-KR", "주석 추가", "주석 닫기"],
  ] as const)(
    "%s 通过实际工具栏和编辑卡恢复同一文档草稿",
    async (locale, add, close) => {
      await changeLimeLocale(locale);
      const drafts = new ArtifactAnnotationDraftStore();
      drafts.create("thread1", {
        id: "docx-note",
        format: "docx",
        path: "/tmp/current.docx",
        sourceSha256: "a".repeat(64),
        pageNumber: 1,
        pageCount: 2,
        pageSize: { width: 640, height: 800 },
        anchor: { kind: "point", point: { x: 100, y: 200 } },
      });
      drafts.getSnapshot()[0].controller.setText("保留的 DOCX 正文");
      const submission: ArtifactCommentSubmission = {
        scopeKey: "thread1:epoch1",
        draftScopeKey: "thread1",
        drafts,
        submit: vi.fn(),
      };
      await show("/tmp/current.docx", "1", submission);
      expect(button(add)).not.toBeNull();
      await act(async () => button(add).click());
      expect(button(add).getAttribute("aria-pressed")).toBe("true");
      await act(async () =>
        container
          .querySelector<HTMLButtonElement>("button[aria-expanded]")!
          .click(),
      );
      await act(async () =>
        container.querySelector<HTMLButtonElement>("aside button")!.click(),
      );
      expect(container.querySelector("textarea")?.value).toBe(
        "保留的 DOCX 正文",
      );
      await act(async () => button(close).click());
      expect(container.querySelector("textarea")).toBeNull();
      expect(drafts.getSnapshot()[0].controller.getDocument().text).toBe(
        "保留的 DOCX 正文",
      );
      await show("/tmp/current.docx", "1", {
        ...submission,
        scopeKey: "thread2:epoch2",
        draftScopeKey: "thread2",
      });
      expect(container.querySelector("button[aria-expanded]")).toBeNull();
      expect(container.querySelector("textarea")).toBeNull();
    },
  );

  it("分页及缩放不重读文件，修订显示使用显式重读并隔离内容", async () => {
    await show();
    const frame = container.querySelector("iframe")!;
    const originalDocument = frame.contentDocument!;
    const html = frame.srcdoc;
    expect(container.querySelector("section")?.dataset.status).toBe("ready");
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-same-origin allow-popups",
    );
    expect(frame.sandbox?.contains("allow-scripts") ?? false).toBe(false);
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    await act(async () => button("下一页").click());
    expect(container.querySelector("iframe")).toBe(frame);
    expect(frame.contentDocument).toBe(originalDocument);
    expect(container.querySelector("section")?.dataset.status).toBe("ready");
    expect(
      originalDocument.getElementById("docx-preview-view")?.textContent,
    ).toContain('data-docx-page="2"]{display:block!important;zoom:1}');
    await act(async () => button("放大").click());
    expect(container.querySelector("iframe")).toBe(frame);
    expect(frame.srcdoc).toBe(html);
    expect(
      originalDocument.getElementById("docx-preview-view")?.textContent,
    ).toContain("zoom:1.25");
    expect(mocks.load).toHaveBeenCalledTimes(1);
    const changes = container.querySelector<HTMLButtonElement>(
      "button[aria-pressed]",
    )!;
    await act(async () => changes.click());
    expect(container.querySelector("iframe")).not.toBe(frame);
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(mocks.load.mock.calls[1][1]).toBe(true);
  });

  it("文件切换中取消旧请求，迟到成功不能覆盖新文件；卸载也取消", async () => {
    let resolve!: (value: DocxDocumentSnapshot) => void;
    mocks.load.mockReturnValueOnce(
      new Promise<DocxDocumentSnapshot>((done) => {
        resolve = done;
      }),
    );
    await show("/tmp/old.docx");
    const signal = mocks.load.mock.calls[0][2] as AbortSignal;
    await show();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(snapshot("OLD")));
    expect(container.querySelector("iframe")?.srcdoc).toContain("CURRENT");
    expect(container.querySelector("iframe")?.srcdoc).not.toContain("OLD");
    const currentSignal = mocks.load.mock.calls[1][2] as AbortSignal;
    await act(async () => root.render(null));
    expect(currentSignal.aborted).toBe(true);
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
    "%s 失败和重试有真实文案并可恢复",
    async (locale) => {
      await changeLimeLocale(locale);
      mocks.load.mockRejectedValueOnce(new Error("untrusted detail"));
      await show();
      expect(container.querySelector("[role=alert]")?.textContent).toBeTruthy();
      expect(container.textContent).not.toContain("untrusted detail");
      expect(container.textContent).not.toContain("workspace.docxPreview.");
      await act(async () =>
        container.querySelector<HTMLButtonElement>("button")!.click(),
      );
      expect(container.querySelector("iframe")).not.toBeNull();
      expect(container.innerHTML).not.toContain("workspace.docxPreview.");
    },
  );
});
