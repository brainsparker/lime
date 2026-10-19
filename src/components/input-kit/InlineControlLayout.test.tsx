import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdaptiveFooter } from "@/components/agent/chat/components/Inputbar/components/ComposerLayout";
import { ComposerController } from "./ComposerController";
import { ComposerEditor } from "./ComposerEditor";
import { ModelSelectorTrigger } from "./ModelSelectorTrigger";

let root: Root;
let container: HTMLDivElement;
let availableWidth: number;
const resizeCallbacks = new Set<() => void>();

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  availableWidth = 200;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        this.callback = callback;
      }
      private callback: () => void;
      observe() {
        resizeCallbacks.add(this.callback);
      }
      unobserve() {}
      disconnect() {
        resizeCallbacks.delete(this.callback);
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function () {
      const width = this.hasAttribute("data-inline-control-available")
        ? availableWidth
        : this.hasAttribute("data-inline-control")
          ? this.closest("[hidden]")
            ? 0
            : this.dataset.inlineControlLabel === "hidden"
              ? 32
              : 140
          : 0;
      return new DOMRect(0, 0, width, 32);
    },
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resizeCallbacks.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function resize(width: number) {
  availableWidth = width;
  await act(async () => {
    for (const callback of [...resizeCallbacks]) callback();
  });
}

async function renderFooter() {
  const controller = new ComposerController({ text: "同一个草稿 😀" });
  const onOpen = vi.fn();
  await act(async () =>
    root.render(
      <AdaptiveFooter
        input={<ComposerEditor controller={controller} />}
        leadingControls={<button>添加</button>}
        modelControl={
          <ModelSelectorTrigger
            compact
            open={false}
            providerType="openai"
            providerLabel="OpenAI"
            selectedProviderLabel="OpenAI"
            modelLabel="fixture-model"
            onClick={onOpen}
          />
        }
        trailingControls={<button>发送</button>}
      />,
    ),
  );
  return { controller, onOpen };
}

describe("inline control width adaptation", () => {
  it("模型异步加载、控件替换及更名后都会重新测量", async () => {
    availableWidth = 40;
    const render = (
      ready: boolean,
      key = "original",
      modelLabel = "fixture-model",
    ) =>
      root.render(
        <AdaptiveFooter
          input={<div>草稿</div>}
          leadingControls={<button>添加</button>}
          modelControl={
            ready ? (
              <ModelSelectorTrigger
                key={key}
                compact
                open={false}
                providerType="openai"
                providerLabel="OpenAI"
                selectedProviderLabel="OpenAI"
                modelLabel={modelLabel}
              />
            ) : (
              <span>加载模型</span>
            )
          }
          trailingControls={<button>发送</button>}
        />,
      );
    await act(async () => render(false));
    await act(async () => render(true));
    const trigger = container.querySelector<HTMLElement>(
      '[data-testid="model-selector"]',
    )!;
    expect(trigger.dataset.inlineControlLabel).toBe("hidden");
    expect(trigger.closest("[hidden]")).toBeNull();
    await resize(20);
    expect(trigger.closest("[hidden]")).not.toBeNull();
    await act(async () => render(true, "replacement"));
    const replacement = container.querySelector<HTMLElement>(
      '[data-testid="model-selector"]',
    )!;
    expect(replacement).not.toBe(trigger);
    expect(replacement.closest("[hidden]")).not.toBeNull();
    await resize(40);
    await act(async () => render(true, "replacement", "updated-model"));
    expect(replacement.getAttribute("aria-label")).toBe(
      "OpenAI / updated-model",
    );
    expect(replacement.dataset.inlineControlLabel).toBe("hidden");
    expect(replacement.closest("[hidden]")).toBeNull();
  });

  it("先收标签再隐藏控件，放大窗口后恢复，保留同一EditorView、选择区和焦点", async () => {
    const { controller, onOpen } = await renderFooter();
    const editor = container.querySelector<HTMLElement>(
      '[data-testid="composer-editor"]',
    )!;
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="model-selector"]',
    )!;
    await act(async () => {
      editor.focus();
      controller.setSelection(2, 5);
    });
    const before = controller.captureDraft();
    await resize(60);
    expect(trigger.dataset.inlineControlLabel).toBe("hidden");
    expect(trigger.closest("[hidden]")).toBeNull();
    expect(trigger.getAttribute("aria-label")).toBe("OpenAI / fixture-model");
    await act(async () => trigger.click());
    expect(onOpen).toHaveBeenCalledOnce();
    await resize(20);
    expect(trigger.closest("[hidden]")).not.toBeNull();
    await resize(60);
    expect(trigger.closest("[hidden]")).toBeNull();
    expect(trigger.dataset.inlineControlLabel).toBe("hidden");
    await resize(200);
    expect(trigger.dataset.inlineControlLabel).toBe("visible");
    expect(trigger.textContent).toContain("fixture-model");
    expect(container.querySelector('[data-testid="composer-editor"]')).toBe(
      editor,
    );
    expect(controller.captureDraft()).toEqual(before);
    expect(document.activeElement).toBe(editor);
  });

  it("首次窄布局实测紧凑宽度后仍可显示模型入口", async () => {
    availableWidth = 40;
    await renderFooter();
    const trigger = container.querySelector<HTMLElement>(
      '[data-testid="model-selector"]',
    )!;
    expect(trigger.dataset.inlineControlLabel).toBe("hidden");
    expect(trigger.closest("[hidden]")).toBeNull();
    await resize(140);
    expect(trigger.dataset.inlineControlLabel).toBe("visible");
  });
});
