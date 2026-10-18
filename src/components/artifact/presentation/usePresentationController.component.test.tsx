import { webcrypto } from "node:crypto";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PresentationController,
  presentationControllersAtom,
} from "./PresentationController";
import { usePresentationController } from "./usePresentationController";
import { importPresentationDocument } from "./presentationDocument";
import {
  presentationElements,
  presentationElementText,
} from "./presentationElements";
import { original } from "./presentationSlidesPackage.testFixtures";

const path = "/workspace/autosave.pptx";
function Preview() {
  usePresentationController(path);
  return null;
}

describe("Presentation 自动保存委托同一Controller", () => {
  let root: Root;
  let container: HTMLDivElement;
  let controller: PresentationController;
  let files: {
    read: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };
  let elementId: string;
  let store: ReturnType<typeof createStore>;
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("crypto", webcrypto);
    let disk = original();
    const document = await importPresentationDocument(
      disk,
      new AbortController().signal,
    );
    files = {
      read: vi.fn(async () => disk.slice()),
      write: vi.fn(async (_path: string, bytes: Uint8Array) => {
        disk = bytes.slice();
      }),
    };
    controller = new PresentationController(path, document, files);
    controller.setEditingEnabled(true);
    elementId = presentationElements(document, document.slideIds[0]).find(
      (node) => presentationElementText(node) !== undefined,
    )!.id;
    store = createStore();
    store.get(presentationControllersAtom).set(path, controller);
    container = window.document.createElement("div");
    root = createRoot(container);
    await act(async () =>
      root.render(
        <Provider store={store}>
          <Preview />
        </Provider>,
      ),
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const edit = async (text: string, commit = true) => {
    await act(async () => {
      expect(controller.textActivateBlockEnd(elementId)).toBe(true);
      controller.textHandleInput(text);
      if (commit) expect(await controller.flushEdits()).toBe(true);
    });
  };
  const tick = (milliseconds: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(milliseconds);
    });
  const saved = async () => {
    // flushPublicFile 返回已在途的同一 Promise，不发起第二次保存。
    expect(await controller.flushPublicFile()).toBe(true);
  };

  it("已提交修改空闲500ms后保存，连续修改重置延迟，不重复写盘", async () => {
    await edit("FIRST");
    await tick(499);
    expect(files.write).not.toHaveBeenCalled();
    await edit("LATEST");
    await tick(499);
    expect(files.write).not.toHaveBeenCalled();
    await tick(1);
    expect(controller.getSnapshot().saving).toBe(true);
    await act(saved);
    expect(files.write).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().dirty).toBe(false);
    await tick(1000);
    expect(files.write).toHaveBeenCalledTimes(1);
  });

  it("文字与IME输入尚未提交时不落盘；卸载取消定时器且重挂继续保稿保存", async () => {
    await edit("COMPOSING_DRAFT", false);
    await tick(1500);
    expect(files.write).not.toHaveBeenCalled();
    await act(async () => {
      expect(await controller.flushEdits()).toBe(true);
    });
    await act(async () => root.render(null));
    await tick(1000);
    expect(files.write).not.toHaveBeenCalled();
    expect(controller.getSnapshot().dirty).toBe(true);
    await act(async () =>
      root.render(
        <Provider store={store}>
          <Preview />
        </Provider>,
      ),
    );
    await tick(500);
    await act(saved);
    expect(files.write).toHaveBeenCalledTimes(1);
  });

  it("外部冲突自动保存失败后停止重试并保稿，显式重试仍检查原文件", async () => {
    await edit("CONFLICT_DRAFT");
    files.read.mockResolvedValue(new Uint8Array([1, 2, 3]));
    await tick(500);
    await act(async () => {
      expect(await controller.flushPublicFile()).toBe(false);
    });
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      failure: "fileChanged",
    });
    const reads = files.read.mock.calls.length;
    await tick(2000);
    expect(files.read).toHaveBeenCalledTimes(reads);
    expect(files.write).not.toHaveBeenCalled();
  });

  it("对象预览暂停已排队的自动保存，取消恢复旧稿保存，提交后才保存新frame", async () => {
    await edit("BEFORE_DRAG");
    await act(async () => {
      expect(
        controller.beginElementInteraction({
          elementId,
          point: { x: 0, y: 0 },
          mode: "move",
        }),
      ).toBe(true);
      controller.updateElementInteraction({ nextPoint: { x: 20, y: 30 } });
    });
    await tick(1500);
    expect(files.write).not.toHaveBeenCalled();
    expect(await controller.flushPublicFile()).toBe(false);
    await act(async () => {
      controller.endElementInteraction({ commit: false });
    });
    await tick(500);
    await act(saved);
    expect(files.write).toHaveBeenCalledTimes(1);
    await act(async () => {
      controller.beginElementInteraction({
        elementId,
        point: { x: 0, y: 0 },
        mode: "move",
      });
      controller.updateElementInteraction({ nextPoint: { x: 20, y: 30 } });
    });
    await tick(1000);
    expect(files.write).toHaveBeenCalledTimes(1);
    await act(async () => {
      expect(controller.endElementInteraction({ commit: true })).toBe(true);
      expect(await controller.flushEdits()).toBe(true);
    });
    await tick(500);
    await act(saved);
    expect(files.write).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      elementInteraction: null,
    });
  });
});
