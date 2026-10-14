import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeSurfaceToastCopy } from "../home/homeSurfaceCopy";
import type { MessagePathReference } from "../types";
import { PATH_REFERENCE_DRAG_MIME } from "../utils/pathReferences";
import { useEmptyStateAttachments } from "./useEmptyStateAttachments";
import { ComposerController } from "@/components/input-kit/ComposerController";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const originalFileReader = globalThis.FileReader;
const deferredReaders: DeferredFileReader[] = [];
const mountedRoots: { container: HTMLDivElement; root: Root }[] = [];
const restoredImage = { data: "cmVzdG9yZWQ=", mediaType: "image/png" };
const pathReference: MessagePathReference = {
  id: "file:/workspace/readme.md",
  path: "/workspace/readme.md",
  name: "readme.md",
  isDir: false,
  size: null,
  mimeType: null,
};
const toastCopy: HomeSurfaceToastCopy = {
  unnamedImage: "未命名图片",
  imageReadFailed: (name) => `读取失败：${name}`,
  imagePasted: "已粘贴图片",
  imageAdded: "已添加图片",
  systemPathDropUnsupported: "不支持路径拖入",
};

class DeferredFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror: (() => void) | null = null;
  error: Error | null = null;
  private file: File | null = null;

  readAsDataURL(file: File) {
    this.file = file;
    deferredReaders.push(this);
  }

  resolve() {
    this.onload?.({
      target: {
        result: `data:${this.file?.type};base64,ZmFrZS1pbWFnZQ==`,
      },
    });
  }

  reject() {
    this.error = new Error("delayed_read_failed");
    this.onerror?.();
  }
}

function Harness({
  onAddPathReferences,
  controller,
}: {
  controller?: ComposerController;
  onAddPathReferences?: (references: MessagePathReference[]) => void;
}) {
  const {
    pendingImages,
    handlePaste,
    handleFileSelect,
    handleDrop,
    handleRemoveImage,
    clearPendingImages,
    replacePendingImages,
  } = useEmptyStateAttachments({ toastCopy, onAddPathReferences, controller });
  return (
    <div>
      <button
        type="button"
        data-testid="paste-image"
        onClick={() =>
          handlePaste({
            preventDefault: vi.fn(),
            clipboardData: {
              items: [],
              files: [
                new File(["image"], "clipboard.png", { type: "image/png" }),
              ],
            },
          } as never)
        }
      >
        粘贴图片
      </button>
      <button
        type="button"
        data-testid="select-image"
        onClick={() =>
          handleFileSelect({
            target: {
              files: [
                new File(["image"], "selected.png", { type: "image/png" }),
              ],
              value: "selected.png",
            },
          } as never)
        }
      >
        选择图片
      </button>
      <button
        type="button"
        data-testid="drop-path"
        onClick={() =>
          handleDrop({
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            dataTransfer: {
              getData: (format: string) =>
                format === PATH_REFERENCE_DRAG_MIME
                  ? JSON.stringify([pathReference])
                  : "",
              files: [],
              items: [],
            },
          } as never)
        }
      >
        拖入路径
      </button>
      <button
        type="button"
        data-testid="remove-image"
        onClick={() => handleRemoveImage(0)}
      >
        删除图片
      </button>
      <button
        type="button"
        data-testid="clear-images"
        onClick={clearPendingImages}
      >
        清空图片
      </button>
      <button
        type="button"
        data-testid="replace-images"
        onClick={() => replacePendingImages([restoredImage])}
      >
        恢复图片
      </button>
      <div data-testid="images">{JSON.stringify(pendingImages)}</div>
    </div>
  );
}

function renderHarness(
  onAddPathReferences?: (references: MessagePathReference[]) => void,
  controller?: ComposerController,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Harness onAddPathReferences={onAddPathReferences} controller={controller} />));
  mountedRoots.push({ container, root });
  return container;
}

function click(container: HTMLDivElement, action: string) {
  const button = container.querySelector<HTMLButtonElement>(
    `[data-testid="${action}"]`,
  );
  expect(button).not.toBeNull();
  act(() => button?.click());
}

function images(container: HTMLDivElement) {
  return JSON.parse(
    container.querySelector('[data-testid="images"]')?.textContent ?? "[]",
  );
}

async function finish(index: number, outcome: "resolve" | "reject") {
  expect(deferredReaders[index]).toBeDefined();
  await act(async () => {
    deferredReaders[index][outcome]();
    await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.FileReader = DeferredFileReader as never;
  deferredReaders.length = 0;
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) break;
    act(() => mounted.root.unmount());
    mounted.container.remove();
  }
  globalThis.FileReader = originalFileReader;
  vi.clearAllMocks();
});

describe("useEmptyStateAttachments 读取生命周期", () => {
  function createRichController() {
    const controller = new ComposerController({
      text: "首页😀",
      attachments: [restoredImage],
      pathReferences: [pathReference],
    });
    controller.insertMention({ id: "review", kind: "skill", name: "review", path: "/skills/review/SKILL.md", label: "/review" }, { start: 0, end: 0 });
    controller.setSelection(controller.getDocument().text.length);
    controller.ingestPaste("首页长文😀".repeat(300));
    return controller;
  }

  it("注入 owner 挂载保留 rich draft，删除图片只写同一 owner", () => {
    const controller = createRichController();
    const beforeMount = controller.getSnapshot();
    const container = renderHarness(undefined, controller);
    expect(images(container)).toEqual([restoredImage]);
    expect(controller.getSnapshot()).toBe(beforeMount);
    click(container, "remove-image");
    expect(images(container)).toEqual([]);
    expect(controller.getDocument().attachments).toEqual([]);
    expect(controller.getDocument().editorDocument).toEqual(beforeMount.document.editorDocument);
    expect(controller.getDocument().pathReferences).toEqual(beforeMount.document.pathReferences);
    expect(controller.getDocument().pendingPastes).toEqual(beforeMount.document.pendingPastes);
  });

  it.each(["clear", "restore", "replaceText", "replaceImages"])(
    "外部 %s 后旧成功/失败不回流，新读仍追加 canonical attachments",
    async (action) => {
      const controller = createRichController();
      const container = renderHarness(undefined, controller);
      click(container, "paste-image");
      click(container, "paste-image");
      act(() => {
        if (action === "clear") controller.clear();
        else if (action === "restore") controller.restoreDraft(controller.captureDraft());
        else if (action === "replaceText") controller.setText("切换后的首页输入");
        else controller.setAttachments([{ data: "external", mediaType: "image/png" }]);
      });
      const afterReset = controller.captureDraft();
      await finish(0, "resolve");
      await finish(1, "reject");
      expect(controller.captureDraft()).toEqual(afterReset);
      expect(images(container)).toEqual(afterReset.attachments);
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
      click(container, "paste-image");
      await finish(2, "resolve");
      expect(controller.getDocument().attachments).toEqual([...afterReset.attachments, { data: "ZmFrZS1pbWFnZQ==", mediaType: "image/png" }]);
      expect(toastMock.success).toHaveBeenCalledOnce();
    },
  );

  it.each(["clear", "restore"])(
    "重复 %s 之间的读取在第二次 reset 后隔离旧成功与失败",
    async (action) => {
      const controller = createRichController();
      const container = renderHarness(undefined, controller);
      const draft = controller.captureDraft();
      const reset = () => action === "clear" ? controller.clear() : controller.restoreDraft(draft);
      act(reset);
      click(container, "paste-image");
      click(container, "select-image");
      const beforeSecondReset = controller.getSnapshot();
      act(reset);
      const afterSecondReset = controller.captureDraft();
      expect(controller.getSnapshot().revision).toBe(beforeSecondReset.revision + 1);

      await finish(0, "resolve");
      await finish(1, "reject");
      expect(controller.captureDraft()).toEqual(afterSecondReset);
      expect(images(container)).toEqual(afterSecondReset.attachments);
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();

      click(container, "paste-image");
      await finish(2, "resolve");
      expect(controller.getDocument().attachments).toEqual([...afterSecondReset.attachments, { data: "ZmFrZS1pbWFnZQ==", mediaType: "image/png" }]);
      expect(toastMock.success).toHaveBeenCalledOnce();
    },
  );

  it("普通 PM 编辑与同代多图读取保留 atom、路径和所有完成图片", async () => {
    const controller = createRichController();
    const container = renderHarness(undefined, controller);
    click(container, "paste-image");
    click(container, "select-image");
    act(() => {
      const state = controller.getEditorState();
      controller.applyTransaction(state.tr.insertText("继续编辑", state.selection.to));
    });
    const beforeReads = controller.captureDraft();
    await finish(0, "resolve");
    await finish(1, "resolve");
    expect(controller.getDocument().attachments).toHaveLength(3);
    expect(images(container)).toEqual(controller.getDocument().attachments);
    expect(controller.getDocument().editorDocument).toEqual(beforeReads.editorDocument);
    expect(controller.getDocument().pathReferences).toEqual(beforeReads.pathReferences);
    expect(toastMock.success).toHaveBeenCalledOnce();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("切换 owner 后旧读取不写入旧或新 controller", async () => {
    const oldController = createRichController();
    const container = renderHarness(undefined, oldController);
    click(container, "paste-image");
    const nextController = new ComposerController({ attachments: [{ data: "next", mediaType: "image/png" }] });
    const mounted = mountedRoots.find((entry) => entry.container === container);
    act(() => mounted?.root.render(<Harness controller={nextController} />));
    await finish(0, "resolve");
    expect(oldController.getDocument().attachments).toEqual([restoredImage]);
    expect(nextController.getDocument().attachments).toEqual([{ data: "next", mediaType: "image/png" }]);
    expect(images(container)).toEqual(nextController.getDocument().attachments);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it.each(["clear-images", "replace-images"])(
    "%s 后迟到成功不回流，新读取仍能接收",
    async (action) => {
      const container = renderHarness();
      click(container, "paste-image");
      await finish(0, "resolve");
      expect(images(container)).toHaveLength(1);
      toastMock.success.mockClear();

      click(container, "paste-image");
      click(container, action);
      click(container, "paste-image");
      const expected = action === "replace-images" ? [restoredImage] : [];

      await finish(1, "resolve");
      expect(images(container)).toEqual(expected);
      expect(toastMock.success).not.toHaveBeenCalled();

      await finish(2, "resolve");
      expect(images(container)).toEqual([
        ...expected,
        { data: "ZmFrZS1pbWFnZQ==", mediaType: "image/png" },
      ]);
      expect(toastMock.success).toHaveBeenCalledWith(toastCopy.imagePasted);
      expect(toastMock.success).toHaveBeenCalledOnce();
      expect(toastMock.error).not.toHaveBeenCalled();
    },
  );

  it.each(["clear-images", "replace-images"])(
    "%s 后迟到失败不显示旧错误",
    async (action) => {
      const container = renderHarness();
      click(container, "paste-image");
      click(container, action);
      await finish(0, "reject");

      expect(images(container)).toEqual(
        action === "replace-images" ? [restoredImage] : [],
      );
      expect(toastMock.error).not.toHaveBeenCalled();
      expect(toastMock.success).not.toHaveBeenCalled();
    },
  );

  it.each(["resolve", "reject"] as const)(
    "卸载后迟到 %s 不显示旧提示",
    async (outcome) => {
      const container = renderHarness();
      click(container, "paste-image");
      const mounted = mountedRoots.pop();
      expect(mounted).toBeDefined();
      act(() => mounted?.root.unmount());
      mounted?.container.remove();
      await finish(0, outcome);

      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
    },
  );

  it("同代读取失败仍显示错误并保留已有草稿", async () => {
    const container = renderHarness();
    click(container, "replace-images");
    click(container, "paste-image");
    await finish(0, "reject");

    expect(images(container)).toEqual([restoredImage]);
    expect(toastMock.error).toHaveBeenCalledWith(
      toastCopy.imageReadFailed("clipboard.png"),
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("文件选择读取仍保留图片且不增加粘贴提示", async () => {
    const container = renderHarness();
    click(container, "select-image");
    await finish(0, "resolve");

    expect(images(container)).toEqual([
      { data: "ZmFrZS1pbWFnZQ==", mediaType: "image/png" },
    ]);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("路径拖入继续交给路径 owner，不启动图片读取", () => {
    const onAddPathReferences = vi.fn();
    const container = renderHarness(onAddPathReferences);
    click(container, "drop-path");

    expect(onAddPathReferences).toHaveBeenCalledWith([
      expect.objectContaining(pathReference),
    ]);
    expect(images(container)).toEqual([]);
    expect(deferredReaders).toHaveLength(0);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});
