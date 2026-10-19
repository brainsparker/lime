import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerController } from "./ComposerController";
import {
  useComposerController,
  type UseComposerControllerOptions,
} from "./useComposerController";

const mounted: { root: Root; container: HTMLElement }[] = [];

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function mount(options: UseComposerControllerOptions) {
  let result: ReturnType<typeof useComposerController> | undefined;
  function Harness(props: UseComposerControllerOptions) {
    result = useComposerController(props);
    return <span>{result.snapshot.document.text}</span>;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  const render = (next: UseComposerControllerOptions) =>
    act(() => root.render(<Harness {...next} />));
  render(options);
  return {
    read: () => {
      if (!result) throw new Error("Controller hook is missing");
      return result;
    },
    rerender: render,
    unmount: () => {
      act(() => root.unmount());
      mounted.splice(
        mounted.findIndex((entry) => entry.root === root),
        1,
      );
      container.remove();
    },
    container,
  };
}

function createRichController() {
  const controller = new ComposerController({
    editorDocument: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: {
                id: "skill",
                kind: "skill",
                name: "审阅",
                path: "/skills/review/SKILL.md",
                label: "/review",
              },
            },
            { type: "text", text: " 中😀" },
            {
              type: "paste",
              attrs: {
                id: "paste",
                placeholder: "[paste]",
                text: "长文😀\n第二行",
              },
            },
          ],
        },
      ],
    },
    attachments: [{ data: "image", mediaType: "image/png" }],
    pathReferences: [
      { id: "path", path: "/tmp/brief.md", name: "brief.md", isDir: false },
    ],
    inputCapabilityRoute: {
      kind: "builtin_command",
      commandKey: "review",
      commandPrefix: "@inspect",
    },
  });
  controller.setSelection(8);
  return controller;
}

describe("useComposerController external owner", () => {
  it("注入时完全保留共享 JSON、资源与 revision，不读取本地初始化文档", () => {
    const controller = createRichController();
    const initial = controller.getSnapshot();
    const harness = mount({
      controller,
      initialDocument: {
        get text(): string {
          throw new Error("Injected owner must not create a local Controller");
        },
      },
    });
    expect(harness.read().controller).toBe(controller);
    expect(harness.read().snapshot).toBe(initial);
    expect(controller.getSnapshot()).toBe(initial);
    expect(harness.container.textContent).toBe("/review 中😀[paste]");
  });

  it("同一 owner 跨并行 hook 和卸载重挂保留草稿，解除旧订阅", () => {
    const controller = createRichController();
    const firstChange = vi.fn();
    const secondChange = vi.fn();
    const first = mount({ controller, onDocumentChange: firstChange });
    const second = mount({
      controller,
      initialDocument: { text: "旧 surface 文本" },
      onDocumentChange: secondChange,
    });
    act(() => first.read().replaceRange({ start: 8, end: 8 }, "new "));
    expect(second.read().snapshot).toBe(controller.getSnapshot());
    expect(second.container.textContent).toBe("/review new 中😀[paste]");
    const beforeUnmount = controller.getSnapshot();
    first.unmount();
    expect(controller.getSnapshot()).toBe(beforeUnmount);
    firstChange.mockClear();

    const remounted = mount({
      controller,
      initialDocument: { text: "不可拍平" },
    });
    expect(remounted.read().snapshot).toBe(beforeUnmount);
    expect(remounted.read().snapshot.document.attachments).toHaveLength(1);
    expect(remounted.read().snapshot.document.pathReferences).toHaveLength(1);
    expect(remounted.read().snapshot.document.mentionBindings).toHaveLength(1);
    expect(remounted.read().snapshot.document.pendingPastes).toEqual([
      { placeholder: "[paste]", text: "长文😀\n第二行" },
    ]);
    act(() => remounted.read().setSelection(0));
    expect(firstChange).not.toHaveBeenCalled();
    expect(secondChange).toHaveBeenCalledTimes(2);
    expect(second.read().snapshot).toBe(remounted.read().snapshot);
  });

  it("切换 external owner 时所有操作与订阅切到新实例", () => {
    const oldController = createRichController();
    const newController = new ComposerController({ text: "新工作区" });
    const onDocumentChange = vi.fn();
    const harness = mount({ controller: oldController, onDocumentChange });
    harness.rerender({ controller: newController, onDocumentChange });
    expect(harness.read().controller).toBe(newController);
    oldController.clear();
    expect(onDocumentChange).not.toHaveBeenCalled();
    expect(harness.container.textContent).toBe("新工作区");
    act(() => harness.read().setText("新工作区编辑😀"));
    expect(newController.getDocument().text).toBe("新工作区编辑😀");
    expect(onDocumentChange).toHaveBeenCalledOnce();
  });

  it("explicit externalDocument 仍显式替换共享 owner", () => {
    const controller = createRichController();
    const externalDocument = {
      text: "明确替换",
      attachments: [{ data: "next", mediaType: "image/png" }],
    };
    const harness = mount({
      controller,
      initialDocument: { text: "不初始化" },
      externalDocument,
    });
    expect(harness.read().controller).toBe(controller);
    expect(controller.getDocument()).toMatchObject(externalDocument);
  });

  it("无注入的本地 owner 仅初始化一次，显式外部文档继续生效", () => {
    const harness = mount({ initialDocument: { text: "本地初始" } });
    const controller = harness.read().controller;
    act(() => harness.read().setText("本地编辑😀"));
    harness.rerender({ initialDocument: { text: "不可重新初始化" } });
    expect(harness.read().controller).toBe(controller);
    expect(controller.getDocument().text).toBe("本地编辑😀");
    harness.rerender({ externalDocument: { text: "显式更新" } });
    expect(harness.read().controller).toBe(controller);
    expect(controller.getDocument().text).toBe("显式更新");
  });
});
