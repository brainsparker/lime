import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";

import type { MessagePathReference } from "../types";
import {
  usePathReferences,
  type PathReferencesController,
} from "./usePathReferences";

function makeRef(
  id: string,
  overrides: Partial<MessagePathReference> = {},
): MessagePathReference {
  return {
    id,
    path: `/tmp/${id}`,
    name: id,
    isDir: false,
    size: null,
    mimeType: null,
    ...overrides,
  };
}

describe("usePathReferences", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: PathReferencesController;

  function Harness({ initial, controller }: { initial?: MessagePathReference[]; controller?: ComposerController }) {
    latest = usePathReferences(initial, controller);
    return null;
  }

  function mount(initial?: MessagePathReference[], controller?: ComposerController) {
    act(() => {
      root.render(<Harness initial={initial} controller={controller} />);
    });
  }

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("默认空列表，可注入初始值", () => {
    mount();
    expect(latest.pathReferences).toEqual([]);

    act(() => root.unmount());
    root = createRoot(container);
    mount([makeRef("file:a")]);
    expect(latest.pathReferences.map((r) => r.id)).toEqual(["file:a"]);
  });

  it("addPathReferences 追加并按 id 去重合并", () => {
    mount();
    act(() => latest.addPathReferences([makeRef("file:a"), makeRef("file:b")]));
    expect(latest.pathReferences.map((r) => r.id)).toEqual(["file:a", "file:b"]);

    // 重复 id：覆盖而非新增
    act(() =>
      latest.addPathReferences([makeRef("file:a", { name: "renamed" })]),
    );
    expect(latest.pathReferences.map((r) => r.id)).toEqual(["file:a", "file:b"]);
    expect(latest.pathReferences.find((r) => r.id === "file:a")?.name).toBe(
      "renamed",
    );
  });

  it("removePathReference 按 id 移除", () => {
    mount([makeRef("file:a"), makeRef("file:b")]);
    act(() => latest.removePathReference("file:a"));
    expect(latest.pathReferences.map((r) => r.id)).toEqual(["file:b"]);
  });

  it("clearPathReferences 清空全部", () => {
    mount([makeRef("file:a"), makeRef("file:b")]);
    act(() => latest.clearPathReferences());
    expect(latest.pathReferences).toEqual([]);
  });

  it("操作函数引用稳定（不随 state 变化重建）", () => {
    mount();
    const add = latest.addPathReferences;
    const remove = latest.removePathReference;
    const clear = latest.clearPathReferences;
    act(() => latest.addPathReferences([makeRef("file:a")]));
    expect(latest.addPathReferences).toBe(add);
    expect(latest.removePathReference).toBe(remove);
    expect(latest.clearPathReferences).toBe(clear);
  });

  it("同batch新增路径立即推进共享revision，迟到receipt不能清新引用", () => {
    const controller = new ComposerController({ text: "待发送草稿" });
    mount(undefined, controller);
    act(() => {
      const receipt = controller.submit("start");
      latest.addPathReferences([makeRef("new-path")]);
      expect(controller.commit(receipt)).toBe(false);
      expect(controller.getDocument().pathReferences).toEqual([makeRef("new-path")]);
    });
    expect(latest.pathReferences).toEqual([makeRef("new-path")]);
  });

  it("merge/remove/clear同步写唯一controller，scope reset立即清投影", () => {
    const controller = new ComposerController({ pathReferences: [makeRef("a")] });
    mount([makeRef("unused-local")], controller);
    expect(latest.pathReferences).toEqual([makeRef("a")]);
    act(() => {
      latest.addPathReferences([makeRef("b")]);
      latest.addPathReferences([makeRef("a", { name: "renamed" })]);
      expect(controller.getDocument().pathReferences).toEqual([makeRef("a", { name: "renamed" }), makeRef("b")]);
      latest.removePathReference("a");
      expect(controller.getDocument().pathReferences).toEqual([makeRef("b")]);
      latest.clearPathReferences();
      expect(controller.getDocument().pathReferences).toEqual([]);
      latest.addPathReferences([makeRef("c")]);
      controller.clear();
    });
    expect(latest.pathReferences).toEqual([]);
  });
});
