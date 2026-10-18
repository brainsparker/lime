import { webcrypto } from "node:crypto";
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { PresentationController } from "./PresentationController";
import { PresentationTableStyleControls } from "./PresentationTableStyleControls";
import { importPresentationDocument } from "./presentationDocument";
import { formatFixture } from "./presentationTableFormatPackage.testFixtures";
import { tableFixture } from "./presentationTablePackage.testFixtures";

describe("真实表格样式继承的边框与表头控件", () => {
  let root: Root, host: HTMLDivElement, controller: PresentationController;
  let disk: Uint8Array;
  let write: ReturnType<typeof vi.fn>;
  function Harness() {
    const state = useSyncExternalStore(
      controller.subscribe,
      controller.getSnapshot,
    );
    return (
      <PresentationTableStyleControls
        controller={controller}
        state={controller.tableEditing.getSnapshot()!}
        disabled={state.saving || state.projecting}
      />
    );
  }
  const button = (label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (node) => node.getAttribute("aria-label") === label,
    )!;
  const input = (label: string) =>
    [...host.querySelectorAll<HTMLInputElement>("input")].find(
      (node) => node.getAttribute("aria-label") === label,
    )!;
  const settle = async () =>
    act(async () => {
      expect(await controller.flushEdits()).toBe(true);
    });
  const save = async () =>
    act(async () => {
      expect(await controller.flushPublicFile()).toBe(true);
    });
  async function setup(bytes = formatFixture()) {
    disk = await bytes;
    write = vi.fn(async (_path: string, value: Uint8Array) => {
      disk = value.slice();
    });
    controller = new PresentationController(
      "/workspace/styles.pptx",
      await importPresentationDocument(disk, new AbortController().signal),
      { read: async () => disk, write },
    );
    controller.setEditingEnabled(true);
    controller.setSelectedElementId("7");
    controller.tableEditing.interact({ type: "select-all", tableId: "7" });
    await act(async () => root.render(<Harness />));
  }
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("crypto", webcrypto);
    await changeLimeLocale("zh-CN");
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("读取真实custom样式并切换preset/线宽，跨保存undo和原包重开仍保持投影", async () => {
    await setup();
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      borderAvailable: true,
      style: { borderEdges: "all", borderWidth: 2, borderColor: "#336699" },
    });
    await act(async () => button("无边框").click());
    await settle();
    expect(button("无边框").getAttribute("aria-pressed")).toBe("true");
    expect(input("边框粗细")).toBeUndefined();
    await save();
    await act(async () => button("所有边框").click());
    await settle();
    await act(async () => {
      input("边框粗细").value = "3.25";
      input("边框粗细").dispatchEvent(
        new FocusEvent("focusout", { bubbles: true }),
      );
    });
    await settle();
    await save();
    expect(
      Math.abs(
        controller.tableEditing.getSnapshot()!.style.borderWidth! - 3.25,
      ),
    ).toBeLessThanOrEqual(0.5 / 9525);
    await act(async () =>
      input("边框粗细").dispatchEvent(
        new FocusEvent("focusout", { bubbles: true }),
      ),
    );
    await act(async () => controller.undo());
    await settle();
    await save();
    expect(controller.tableEditing.getSnapshot()?.style.borderWidth).toBe(1);
    const reopened = new PresentationController(
      "/workspace/styles.pptx",
      await importPresentationDocument(disk, new AbortController().signal),
    );
    reopened.setEditingEnabled(true);
    reopened.setSelectedElementId("7");
    reopened.tableEditing.interact({ type: "select-all", tableId: "7" });
    expect(reopened.tableEditing.getSnapshot()?.style).toMatchObject({
      borderEdges: "all",
      borderWidth: 1,
    });
    expect(write.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("false可以关闭标题行，标题列独立启用，撤销恢复同一已保存选项", async () => {
    await setup();
    expect(input("标题行").checked).toBe(false);
    await act(async () => input("标题行").click());
    await settle();
    expect(input("标题行").checked).toBe(true);
    await act(async () => input("标题行").click());
    await settle();
    expect(input("标题行").checked).toBe(false);
    await act(async () => input("标题列").click());
    await settle();
    await save();
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      headerRow: false,
      headerColumn: true,
    });
    await act(async () => controller.undo());
    await settle();
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      headerRow: false,
      headerColumn: false,
    });
  });

  it("未解析的孤立样式禁用边框，表头选项仍可编辑，不回退假样式", async () => {
    await setup(tableFixture());
    expect(controller.tableEditing.getSnapshot()?.borderAvailable).toBe(false);
    expect(button("所有边框").matches(":disabled")).toBe(true);
    expect(input("标题行").matches(":disabled")).toBe(false);
    expect(controller.getSnapshot().dirty).toBe(false);
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
    "%s所有样式控件具有翻译后的名称",
    async (locale) => {
      await changeLimeLocale(locale);
      await setup();
      expect(host.textContent).not.toContain("workspace.");
      for (const element of host.querySelectorAll("[aria-label]")) {
        expect(element.getAttribute("aria-label")).toBeTruthy();
        expect(element.getAttribute("aria-label")).not.toContain("workspace.");
      }
      expect(controller.getSnapshot().dirty).toBe(false);
    },
  );
});
