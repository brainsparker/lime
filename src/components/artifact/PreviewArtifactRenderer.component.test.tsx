import { act } from "react";
import { Provider, createStore } from "jotai";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewArtifactRenderer } from "./PreviewArtifactRenderer";
import { createPreviewArtifactFromFile } from "@/lib/artifact/previewArtifact";
import { mergeArtifacts } from "@/components/agent/chat/utils/messageArtifacts";
import type { Artifact } from "@/lib/artifact/types";
import { changeLimeLocale } from "@/i18n/createI18n";
import "./workbook/WorkbookPanel";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./workbook/loadWorkbookDocument", () => ({
  loadWorkbookDocument: mocks.load,
}));
vi.mock("@tanstack/react-virtual", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-virtual")>();
  return {
    ...actual,
    useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) =>
      actual.useVirtualizer({
        ...options,
        initialRect: { width: 600, height: 300 },
        observeElementRect: (_instance, callback) =>
          callback({ width: 600, height: 300 }),
        scrollToFn: () => {},
      }),
  };
});

describe("专业预览重载边界", () => {
  let root: Root;
  let container: HTMLDivElement;
  let store: ReturnType<typeof createStore>;
  const show = async (artifact: Artifact) => {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <PreviewArtifactRenderer
            artifact={artifact}
            view="workbook"
            tone="light"
          />
        </Provider>,
      );
    });
    await vi.waitFor(async () => {
      await act(async () => {
        await Promise.resolve();
      });
      expect(container.querySelector("section")?.dataset.status).toBe("ready");
    });
  };
  const preview = () =>
    createPreviewArtifactFromFile({ filePath: "/tmp/budget.xlsx", now: 1 })
      .artifact;
  const select = async () => {
    const input = container.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "B2:C3");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    return input;
  };
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    await changeLimeLocale("zh-CN");
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mocks.load.mockReset().mockImplementation(() => ({
      promise: Promise.resolve({
        sourceSha256: "a".repeat(64),
        sheets: [
          {
            id: "1",
            name: "Budget",
            rowCount: 10,
            columnCount: 5,
            rowHeights: {},
            columnWidths: {},
            cells: {},
            merges: [],
          },
        ],
      }),
      destroy: vi.fn(),
    }));
    container = document.createElement("div");
    store = createStore();
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    vi.unstubAllGlobals();
  });

  it("同路径消息状态更新不重读原文件或丢失用户选区", async () => {
    const artifact = preview();
    await show(artifact);
    const input = await select();
    expect(input.value).toBe("B2:C3");
    const messageArtifact: Artifact = {
      ...artifact,
      id: "canonical-write",
      updatedAt: 20,
      meta: { filePath: "/tmp/budget.xlsx" },
    };
    const merged = mergeArtifacts([messageArtifact, artifact]);
    expect(merged).toHaveLength(1);
    expect(merged[0].updatedAt).toBe(20);
    await show(merged[0]);
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(container.querySelector("input")).toBe(input);
    expect(input.value).toBe("B2:C3");
    expect(
      container
        .querySelector('[role="grid"]')
        ?.getAttribute("aria-activedescendant"),
    ).toBe("workbook-1-C3");
  });

  it("明确的新预览请求重读同一路径并清理旧导入，保留文件编辑选区", async () => {
    const artifact = preview();
    await show(artifact);
    const input = await select();
    const destroy = mocks.load.mock.results[0].value.destroy;
    await show({
      ...artifact,
      meta: { ...artifact.meta, previewRequestKey: "explicit-reopen" },
    });
    expect(destroy).toHaveBeenCalledOnce();
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(container.querySelector("input")).not.toBe(input);
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe(
      "B2:C3",
    );
    expect(
      container
        .querySelector('[role="grid"]')
        ?.getAttribute("aria-activedescendant"),
    ).toBe("workbook-1-C3");
  });
});
