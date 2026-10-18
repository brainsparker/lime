import { presentationEditorText } from "./presentationTextEditor";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { createPreviewArtifactFromFile } from "@/lib/artifact/previewArtifact";
import { PreviewArtifactRenderer } from "../PreviewArtifactRenderer";
import { resolvePreviewArtifactView } from "../previewArtifactView";
import {
  ArtifactCommentSubmissionContext,
  type ArtifactCommentSubmission,
} from "../ArtifactCommentSubmissionContext";
import { ArtifactAnnotationDraftStore } from "../annotations/ArtifactAnnotationDraftStore";
import { presentationFrameHtml } from "./presentationDocument";

const mocks = vi.hoisted(() => ({ readBytes: vi.fn(), writeBytes: vi.fn() }));
vi.mock("@/lib/api/fileBrowser", () => ({
  readFileBytes: mocks.readBytes,
  writeFileBytes: mocks.writeBytes,
}));
const bytes = new Uint8Array(
  fs.readFileSync(
    "src/components/artifact/presentation/__fixtures__/review.pptx",
  ),
);

describe("真实PPTX artifact 分发、导航与共享批注", () => {
  let root: Root;
  let container: HTMLDivElement;
  let submission: ArtifactCommentSubmission;
  let store: ReturnType<typeof createStore>;
  const render = async (path = "/workspace/review.pptx") => {
    const { artifact } = createPreviewArtifactFromFile({
      filePath: path,
      content: "历史抽取文本不得代替版式",
      isBinary: true,
    });
    const view = resolvePreviewArtifactView(artifact)!;
    await act(async () =>
      root.render(
        <Provider store={store}>
          <ArtifactCommentSubmissionContext.Provider value={submission}>
            <PreviewArtifactRenderer
              artifact={artifact}
              view={view}
              tone="light"
            />
          </ArtifactCommentSubmissionContext.Provider>
        </Provider>,
      ),
    );
  };
  const frame = () => container.querySelector<HTMLIFrameElement>("iframe")!;
  const waitFor = async (assertion: () => void) => {
    const deadline = Date.now() + 1000;
    let failure: unknown;
    do {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      try {
        assertion();
        return;
      } catch (error) {
        failure = error;
      }
    } while (Date.now() < deadline);
    throw failure;
  };
  const settle = async () => {
    await waitFor(() => expect(frame()).not.toBeNull());
    // jsdom 不加载 srcdoc；仅补齐浏览器的文档加载，不注入业务状态或模型。
    await act(async () => {
      const document = frame().contentDocument!;
      document.open();
      document.write(presentationFrameHtml);
      document.close();
      frame().dispatchEvent(new Event("load"));
    });
    await waitFor(() =>
      expect(container.querySelector("section")?.dataset.status).toBe("ready"),
    );
  };
  const button = (name: string) =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) =>
        button.getAttribute("aria-label") === name ||
        button.textContent === name,
    )!;
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    mocks.readBytes.mockReset().mockResolvedValue(bytes);
    mocks.writeBytes.mockReset().mockResolvedValue(undefined);
    store = createStore();
    await changeLimeLocale("zh-CN");
    await import("./PresentationPanel");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    submission = {
      scopeKey: "s1:t1:epoch1",
      draftScopeKey: "s1:t1",
      drafts: new ArtifactAnnotationDraftStore(),
      submit: vi.fn().mockResolvedValue("rejected"),
    };
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("从原字节显示三张幻灯片，分页不重读文件并使用原slideId创建批注", async () => {
    await render();
    await settle();
    expect(frame().contentDocument?.body.textContent).toContain(
      "SLIDE_PREVIEW_01",
    );
    expect(container.textContent).not.toContain("历史抽取文本不得代替版式");
    expect(frame().getAttribute("sandbox")).toBe("allow-same-origin");
    await act(async () => button("下一张").click());
    await waitFor(() =>
      expect(frame().contentDocument?.body.textContent).toContain(
        "SLIDE_PREVIEW_02",
      ),
    );
    await act(async () => button("要求修改").click());
    expect(submission.drafts.getSnapshot()[0]).toMatchObject({
      scopeKey: "s1:t1",
      comment: {
        format: "presentation",
        sourceFormat: "pptx",
        target: { slideId: "900" },
        slideNumber: 2,
        slideCount: 3,
      },
    });
    expect(container.textContent).toContain("第 2 张幻灯片");
    expect(mocks.readBytes).toHaveBeenCalledExactlyOnceWith(
      "/workspace/review.pptx",
    );
  });

  it("受限iframe中输入法确认不提交；取消保原文，显式提交和保存写回原PPTX", async () => {
    let disk = bytes.slice();
    mocks.readBytes.mockImplementation(async () => disk);
    mocks.writeBytes.mockImplementation(
      async (_path: string, value: Uint8Array) => {
        disk = value.slice();
      },
    );
    await render();
    await settle();
    await act(async () => button("编辑").click());
    await act(async () =>
      frame()
        .contentDocument!.querySelector<HTMLButtonElement>(
          "[data-presentation-element-id]",
        )!
        .click(),
    );
    await act(async () => button("编辑文字").click());
    const editor = () =>
      frame().contentDocument!.querySelector<HTMLElement>(
        "[data-presentation-text-editor]",
      )!;
    await act(async () => {
      editor().dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      editor().textContent = "中文确认\n<&>";
      editor().dispatchEvent(new Event("input", { bubbles: true }));
      editor().dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Enter",
          ctrlKey: true,
          isComposing: true,
        }),
      );
    });
    expect(editor()).not.toBeNull();
    expect(mocks.writeBytes).not.toHaveBeenCalled();
    await act(async () => {
      editor().dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      );
      editor().dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });
    expect(frame().contentDocument!.body.textContent).toContain(
      "SLIDE_PREVIEW_01",
    );
    await act(async () => button("编辑文字").click());
    await act(async () => {
      editor().textContent = "PPTX_SAVED_中文\n<&>";
      editor().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(button("撤销").disabled).toBe(false);
    await act(async () => button("撤销").click());
    expect(editor()).not.toBeNull();
    expect(presentationEditorText(editor())).toBe("SLIDE_PREVIEW_01");
    expect(button("重做").disabled).toBe(false);
    await act(async () => button("重做").click());
    expect(presentationEditorText(editor())).toBe("PPTX_SAVED_中文\n<&>");
    expect(mocks.writeBytes).not.toHaveBeenCalled();
    await act(async () => {
      editor().dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Enter",
          ctrlKey: true,
        }),
      );
    });
    await waitFor(() =>
      expect(frame().contentDocument!.body.textContent).toContain(
        "PPTX_SAVED_中文",
      ),
    );
    expect(mocks.writeBytes).not.toHaveBeenCalled();
    await act(async () => button("保存").click());
    await waitFor(() => expect(mocks.writeBytes).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        container
          .querySelector('[data-testid="presentation-editing-controls"]')
          ?.getAttribute("data-dirty"),
      ).toBe("false"),
    );
    expect(frame().getAttribute("sandbox")).toBe("allow-same-origin");
    expect(frame().contentDocument!.body.textContent).toContain(
      "PPTX_SAVED_中文",
    );
  });

  it("方向键连续移动后保留同一对象焦点，文字编辑采用原字号与粗体", async () => {
    await render();
    await settle();
    await act(async () => button("编辑").click());
    const target = () =>
      frame().contentDocument!.querySelector<HTMLButtonElement>(
        '[data-presentation-element-id="2"]',
      )!;
    await act(async () => {
      target().focus();
      target().click();
    });
    const left = Number.parseFloat(target().style.left);
    for (let offset = 1; offset <= 2; offset++) {
      await act(async () =>
        target().dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            key: "ArrowRight",
          }),
        ),
      );
      await waitFor(() => {
        expect(Number.parseFloat(target().style.left)).toBe(left + offset);
        expect(frame().contentDocument!.activeElement).toBe(target());
      });
    }
    await act(async () => button("加粗").click());
    await waitFor(() =>
      expect(button("加粗").getAttribute("aria-pressed")).toBe("true"),
    );
    await act(async () => button("编辑文字").click());
    const input = frame().contentDocument!.querySelector<HTMLElement>(
      "[data-presentation-text-editor]",
    )!;
    expect(Number.parseFloat(input.style.fontSize)).toBeCloseTo(2800 / 75);
    expect(input.style.fontWeight).toBe("bold");
    expect(mocks.writeBytes).not.toHaveBeenCalled();
  });

  it("真实组件卸载后重挂载仍保留编辑稿；独立应用scope不泄露", async () => {
    await render();
    await settle();
    await act(async () => button("编辑").click());
    await act(async () =>
      frame()
        .contentDocument!.querySelector<HTMLButtonElement>(
          "[data-presentation-element-id]",
        )!
        .click(),
    );
    await act(async () => button("编辑文字").click());
    await act(async () => {
      const input = frame().contentDocument!.querySelector<HTMLElement>(
        "[data-presentation-text-editor]",
      )!;
      input.textContent = "UNMOUNT_DRAFT";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const old = frame();
    await act(async () => root.render(null));
    expect(old.isConnected).toBe(false);
    await render();
    await settle();
    expect(
      presentationEditorText(
        frame().contentDocument!.querySelector<HTMLElement>(
          "[data-presentation-text-editor]",
        )!,
      ),
    ).toBe("UNMOUNT_DRAFT");
    store = createStore();
    await act(async () => root.render(null));
    await render();
    await settle();
    expect(
      frame().contentDocument!.querySelector<HTMLElement>(
        "[data-presentation-text-editor]",
      ),
    ).toBeNull();
    expect(frame().contentDocument!.body.textContent).toContain(
      "SLIDE_PREVIEW_01",
    );
  });

  it("选中展开工具栏移动iframe时不产生假拖动，真实屏幕位移才更新对象", async () => {
    await render();
    await settle();
    await act(async () => button("编辑").click());
    const target = () =>
      frame().contentDocument!.querySelector<HTMLButtonElement>(
        '[data-presentation-element-id="2"]',
      )!;
    const pointer = (type: string, clientY: number, screenY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        button: { value: 0 },
        pointerId: { value: 1 },
        clientX: { value: 50 },
        clientY: { value: clientY },
        screenX: { value: 500 },
        screenY: { value: screenY },
      });
      return event;
    };
    const top = Number.parseFloat(target().style.top);
    await act(async () =>
      target().dispatchEvent(pointer("pointerdown", 100, 500)),
    );
    await act(async () =>
      target().dispatchEvent(pointer("pointerup", -100, 500)),
    );
    expect(Number.parseFloat(target().style.top)).toBe(top);
    expect(
      container
        .querySelector('[data-testid="presentation-editing-controls"]')
        ?.getAttribute("data-dirty"),
    ).toBe("false");
    await act(async () =>
      target().dispatchEvent(pointer("pointerdown", 100, 500)),
    );
    await act(async () =>
      target().dispatchEvent(pointer("pointerup", 110, 510)),
    );
    await waitFor(() =>
      expect(Number.parseFloat(target().style.top)).toBeGreaterThan(top),
    );
    expect(mocks.writeBytes).not.toHaveBeenCalled();
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
    "%s 损坏文件有明确错误和可重试终态",
    async (locale) => {
      await changeLimeLocale(locale);
      mocks.readBytes.mockResolvedValueOnce(new Uint8Array([0, 1, 2]));
      await render();
      await waitFor(() =>
        expect(container.querySelector('[role="alert"]')).not.toBeNull(),
      );
      expect(container.textContent).not.toContain(
        "workspace.presentationPreview.",
      );
      const retry = container.querySelector<HTMLButtonElement>("button")!;
      await act(async () => retry.click());
      await settle();
      expect(frame().contentDocument?.body.textContent).toContain(
        "SLIDE_PREVIEW_01",
      );
    },
  );
});
