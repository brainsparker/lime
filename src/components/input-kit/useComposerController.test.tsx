import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComposerController, type UseComposerControllerOptions } from "./useComposerController";

const mounted: { root: Root; container: HTMLElement }[] = [];

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function mount(options: UseComposerControllerOptions) {
  let result: ReturnType<typeof useComposerController> | undefined;
  const Harness = (props: UseComposerControllerOptions) => {
    result = useComposerController(props);
    return <span>{result.snapshot.document.text}</span>;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => root.render(<Harness {...options} />));
  return {
    read: () => {
      if (!result) throw new Error("missing controller hook");
      return result;
    },
    rerender: (next: UseComposerControllerOptions) => act(() => root.render(<Harness {...next} />)),
    root, container,
  };
}

describe("useComposerController", () => {
  it("直接 PM 事务与完整 restore 都通知消费者，不仅通知 hook setters", () => {
    const onDocumentChange = vi.fn();
    const harness = mount({ initialDocument: { text: "a" }, onDocumentChange });
    const controller = harness.read().controller;
    act(() => controller.applyTransaction(controller.getEditorState().tr.insertText("中😀", 2)));
    expect(harness.container.textContent).toBe("a中😀");
    expect(onDocumentChange).toHaveBeenCalledTimes(1);
    expect(onDocumentChange.mock.calls[0][0].text).toBe("a中😀");
    act(() => harness.read().restoreDraft({ text: "restored", attachments: [{ data: "x", mediaType: "image/png" }] }));
    expect(onDocumentChange).toHaveBeenCalledTimes(2);
    expect(onDocumentChange.mock.calls[1][0].attachments).toHaveLength(1);
  });

  it("外部文档与最新 callback 进入同一 Controller，卸载后解除 callback", () => {
    const initial = vi.fn();
    const latest = vi.fn();
    const harness = mount({ externalDocument: { text: "first" }, onDocumentChange: initial });
    expect(initial).toHaveBeenCalledTimes(1);
    const controller = harness.read().controller;
    harness.rerender({ externalDocument: { text: "second" }, onDocumentChange: latest });
    expect(harness.read().controller).toBe(controller);
    expect(latest).toHaveBeenCalledTimes(1);
    expect(harness.container.textContent).toBe("second");
    act(() => harness.root.unmount());
    mounted.splice(mounted.findIndex((entry) => entry.root === harness.root), 1);
    controller.setText("late");
    expect(latest).toHaveBeenCalledTimes(1);
    harness.container.remove();
  });
});
