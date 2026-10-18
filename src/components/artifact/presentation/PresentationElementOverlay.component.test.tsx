import { webcrypto } from "node:crypto";
import { act, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { PresentationController } from "./PresentationController";
import { usePresentationEditingOverlay } from "./usePresentationEditingOverlay";
import {
  importPresentationDocument,
  renderPresentationSlide,
  sanitizePresentationSlide,
} from "./presentationDocument";
import {
  presentationElementFrame,
  presentationElements,
} from "./presentationElements";
import { elementFixture } from "./presentationElements.testFixtures";

describe("对象集合原生覆盖层与真实投影", () => {
  let root: Root,
    host: HTMLDivElement,
    frame: HTMLIFrameElement,
    slide: HTMLElement;
  let controller: PresentationController,
    disk: Uint8Array,
    writes: ReturnType<typeof vi.fn>;
  function Harness() {
    const state = useSyncExternalStore(
      controller.subscribe,
      controller.getSnapshot,
    );
    const [mount, setMount] = useState<HTMLElement | null>(null);
    useLayoutEffect(() => {
      let alive = true;
      const rendered = renderPresentationSlide(state.document, 0);
      void rendered.ready.then(() => {
        if (!alive) return;
        sanitizePresentationSlide(rendered.element);
        slide = rendered.element;
        slide.getBoundingClientRect = () => ({
          x: 100,
          y: 200,
          left: 100,
          top: 200,
          right: 580,
          bottom: 470,
          width: 480,
          height: 270,
          toJSON: () => ({}),
        });
        frame.contentDocument!.body.replaceChildren(slide);
        setMount(slide);
      });
      return () => {
        alive = false;
        rendered.dispose();
      };
    }, [state.document]);
    usePresentationEditingOverlay(mount, 0.5, controller, state);
    return null;
  }
  const element = (id = "2") =>
    slide.querySelector<HTMLButtonElement>(
      `[data-presentation-element-id="${id}"]`,
    )!;
  const handle = (name: string) =>
    slide.querySelector<HTMLButtonElement>(
      `[data-presentation-resize="${name}"]`,
    )!;
  const nodes = () =>
    presentationElements(controller.getSnapshot().document, "512");
  const frames = () => nodes().map(presentationElementFrame);
  const key = (
    target: EventTarget,
    value: string,
    extra: ConstructorParameters<typeof KeyboardEvent>[1] = {},
  ) =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: value,
        ...extra,
      }),
    );
  const pointer = (
    target: EventTarget,
    type: string,
    x: number,
    y: number,
    extra: Record<string, unknown> = {},
  ) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(
      event,
      Object.fromEntries(
        Object.entries({
          button: 0,
          pointerId: 11,
          clientX: 100 + x / 2,
          clientY: 200 + y / 2,
          screenX: 800 + x / 2,
          screenY: 900 + y / 2,
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          ...extra,
        }).map(([name, value]) => [name, { value }]),
      ),
    );
    target.dispatchEvent(event);
  };
  const settle = () =>
    act(async () => {
      expect(await controller.flushEdits()).toBe(true);
    });
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("crypto", webcrypto);
    await changeLimeLocale("zh-CN");
    disk = await elementFixture();
    writes = vi.fn(async (_path: string, bytes: Uint8Array) => {
      disk = bytes.slice();
    });
    controller = new PresentationController(
      "/workspace/elements.pptx",
      await importPresentationDocument(disk, new AbortController().signal),
      { read: vi.fn(async () => disk.slice()), write: writes },
    );
    controller.setEditingEnabled(true);
    host = document.createElement("div");
    frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-same-origin");
    document.body.append(host, frame);
    root = createRoot(host);
    await act(async () => root.render(<Harness />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    frame.remove();
    vi.unstubAllGlobals();
  });

  it("Ctrl/Shift直接变更集合，Ctrl+A选择对象且table内部选区不会同时存在", async () => {
    await act(async () => element().click());
    await act(async () =>
      element("7").dispatchEvent(
        new MouseEvent("click", { bubbles: true, ctrlKey: true }),
      ),
    );
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2", "7"]);
    expect(element().getAttribute("aria-pressed")).toBe("true");
    expect(element("7").getAttribute("aria-pressed")).toBe("true");
    expect(slide.querySelector("[data-presentation-cell]")).toBeNull();
    await act(async () =>
      element().dispatchEvent(
        new MouseEvent("click", { bubbles: true, shiftKey: true }),
      ),
    );
    expect(controller.getSnapshot().selectedElementIds).toEqual(["7"]);
    expect(slide.querySelector("[data-presentation-cell]")).not.toBeNull();
    await act(async () => key(element("7"), "a", { metaKey: true }));
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2", "7"]);
    expect(slide.querySelector("[data-presentation-cell]")).toBeNull();
  });

  it("move预览实际renderer对象，cancel恢复原画面；pointerup批量提交一次且保持焦点", async () => {
    await act(async () => controller.selectAllSlideElements());
    const original = frames(),
      source = controller.getSnapshot().document;
    await act(async () => pointer(element(), "pointerdown", 10, 10));
    await act(async () => pointer(slide.ownerDocument, "pointermove", 30, 20));
    expect(controller.getSnapshot().document).toBe(source);
    const artwork = Array.from(
      slide.querySelectorAll<HTMLElement>("[data-presentation-preview]"),
    );
    expect(artwork).toHaveLength(2);
    expect(
      artwork.map((node) => [
        parseFloat(node.style.left),
        parseFloat(node.style.top),
      ]),
    ).toEqual([
      [20, 10],
      [120, 60],
    ]);
    expect(frames()).toEqual(original);
    await act(async () =>
      pointer(slide.ownerDocument, "pointercancel", 30, 20),
    );
    expect(slide.querySelector("[data-presentation-preview]")).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      canUndo: false,
      elementInteraction: null,
    });
    await act(async () => pointer(element(), "pointerdown", 10, 10));
    await act(async () => pointer(slide.ownerDocument, "pointerup", 30, 20));
    await settle();
    expect(frames()).toEqual(
      original.map((value) => ({ ...value, x: value.x + 20, y: value.y + 10 })),
    );
    expect(frame.contentDocument!.activeElement).toBe(element("7"));
    await act(async () => key(element("7"), "z", { ctrlKey: true }));
    await settle();
    expect(frames()).toEqual(original);
    expect(controller.getSnapshot().canUndo).toBe(false);
    expect(frame.contentDocument!.activeElement).toBe(element("7"));
    expect(writes).not.toHaveBeenCalled();
  });

  it("组合resize把table格网与原包框同步，rotate经真实handle预览并在up提交", async () => {
    await act(async () => controller.selectAllSlideElements());
    await act(async () => pointer(handle("se"), "pointerdown", 160, 90));
    await act(async () =>
      pointer(slide.ownerDocument, "pointermove", 320, 180),
    );
    expect(handle("se").parentElement!.style.width).toBe("320px");
    expect(nodes()[0].size.w).toBe(40);
    await act(async () => pointer(slide.ownerDocument, "pointerup", 320, 180));
    await settle();
    expect(nodes()[0].size.w).toBe(80);
    const table = nodes()[1];
    if (table.nodeType !== "table") throw new Error("fixture table missing");
    expect(table.columns).toEqual([40, 40, 40]);
    await act(async () => controller.undo());
    await settle();
    const rotate = slide.querySelector<HTMLButtonElement>(
      "[data-presentation-rotate]",
    )!;
    await act(async () => pointer(rotate, "pointerdown", 80, -48));
    await act(async () => pointer(slide.ownerDocument, "pointermove", 173, 45));
    expect(
      slide.querySelector<HTMLElement>("[data-presentation-selection]")!.style
        .transform,
    ).toBe("rotate(90deg)");
    expect(nodes()[0].rotation).toBe(0);
    await act(async () => pointer(slide.ownerDocument, "pointerup", 173, 45));
    await settle();
    expect(nodes().map((node) => node.rotation)).toEqual([90, 90]);
    await act(async () =>
      expect(await controller.flushPublicFile()).toBe(true),
    );
    expect(frame.contentDocument!.activeElement).toBe(element("7"));
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it("空白反向框选、additive与Escape恢复，空白点击清选并保持零历史", async () => {
    await act(async () => pointer(slide, "pointerdown", 50, 30));
    await act(async () => pointer(slide.ownerDocument, "pointermove", -1, -1));
    expect(
      slide.querySelector<HTMLElement>("[data-presentation-marquee]")!.hidden,
    ).toBe(false);
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2"]);
    await act(async () => pointer(slide.ownerDocument, "pointerup", -1, -1));
    await act(async () =>
      pointer(slide, "pointerdown", 170, 100, { ctrlKey: true }),
    );
    await act(async () => pointer(slide.ownerDocument, "pointermove", 90, 40));
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2", "7"]);
    await act(async () => key(slide, "Escape"));
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2"]);
    expect(controller.getSnapshot().selectionMarquee).toBeNull();
    await act(async () => pointer(slide, "pointerdown", 200, 200));
    await act(async () => pointer(slide.ownerDocument, "pointerup", 200, 200));
    expect(controller.getSnapshot()).toMatchObject({
      selectedElementIds: [],
      primarySelectedElementId: null,
      dirty: false,
      canUndo: false,
    });
  });

  it("选中对象后iframe移动只改变client坐标时不形成假拖动，保存锁保留焦点", async () => {
    await act(async () => pointer(element(), "pointerdown", 10, 10));
    await act(async () =>
      pointer(slide.ownerDocument, "pointerup", 10, 10, { clientY: -1000 }),
    );
    expect(controller.getSnapshot().dirty).toBe(false);
    await act(async () => {
      element().focus();
      key(element(), "ArrowRight");
    });
    await settle();
    await act(async () =>
      expect(await controller.flushPublicFile()).toBe(true),
    );
    expect(frame.contentDocument!.activeElement).toBe(element());
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2"]);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it("用户在投影和保存期间已聚焦外部控件时不抢回iframe焦点", async () => {
    const outside = document.createElement("button");
    host.append(outside);
    await act(async () => {
      element().click();
      element().focus();
      key(element(), "ArrowRight");
      outside.focus();
    });
    await settle();
    expect(document.activeElement).toBe(outside);
    expect(frames()[0].x).toBe(1);
    await act(async () =>
      expect(await controller.flushPublicFile()).toBe(true),
    );
    expect(document.activeElement).toBe(outside);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
    "%s 集合canvas、8个resize与rotate均有翻译的可访问名称",
    async (locale) => {
      await act(async () => {
        controller.selectAllSlideElements();
        await changeLimeLocale(locale);
      });
      const controls = [
        slide,
        ...slide.querySelectorAll<HTMLElement>(
          "[data-presentation-resize],[data-presentation-rotate]",
        ),
      ];
      expect(controls).toHaveLength(10);
      for (const control of controls) {
        expect(control.getAttribute("aria-label")).toBeTruthy();
        expect(control.getAttribute("aria-label")).not.toContain("workspace.");
      }
      expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
      expect(slide.querySelector("script")).toBeNull();
    },
  );
});
