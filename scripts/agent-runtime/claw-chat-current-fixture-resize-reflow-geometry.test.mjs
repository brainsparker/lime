import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readResizeReflowHeaderGeometry } from "./claw-chat-current-fixture-resize-reflow-geometry.mjs";

const PRIVATE = "PRIVATE TITLE https://private.invalid <html>raw</html>";
let nodes;
const viewportDescriptors = ["innerWidth", "innerHeight"].map((key) => [
  key,
  Object.getOwnPropertyDescriptor(window, key),
]);

function setRect(node, { left, top, right, bottom }) {
  const rect = {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue(rect);
  for (const [key, value] of Object.entries({
    clientLeft: 0,
    clientTop: 0,
    clientWidth: rect.width,
    clientHeight: rect.height,
  })) {
    Object.defineProperty(node, key, { configurable: true, value });
  }
}

function read(label = "wide") {
  return readResizeReflowHeaderGeometry({ label });
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 820,
  });
  document.body.innerHTML = `
    <header data-testid="thread-workspace-header">
      <div data-testid="thread-workspace-header-navigation">navigation</div>
      <div data-testid="thread-workspace-header-context">
        <span data-testid="thread-workspace-header-title">${PRIVATE}</span>
        <span data-testid="thread-workspace-header-status">${PRIVATE}</span>
      </div>
      <div data-testid="thread-workspace-header-actions" style="overflow-x:auto;overflow-y:hidden">
        <div data-testid="task-center-utility-toolbar"><button>${PRIVATE}</button></div>
      </div>
    </header>
    <div data-testid="layout-compact-mode-bar" style="display:none"></div>`;
  for (const node of document.querySelectorAll("*")) node.style.opacity = "1";
  const testid = (name) => document.querySelector(`[data-testid="${name}"]`);
  nodes = {
    header: testid("thread-workspace-header"),
    navigation: testid("thread-workspace-header-navigation"),
    context: testid("thread-workspace-header-context"),
    title: testid("thread-workspace-header-title"),
    status: testid("thread-workspace-header-status"),
    actions: testid("thread-workspace-header-actions"),
    toolbar: testid("task-center-utility-toolbar"),
    button: document.querySelector("button"),
    compact: testid("layout-compact-mode-bar"),
  };
  setRect(document.documentElement, {
    left: 0,
    top: 0,
    right: 1280,
    bottom: 820,
  });
  setRect(document.body, { left: 0, top: 0, right: 1280, bottom: 820 });
  setRect(nodes.header, { left: 302, top: 8, right: 1268, bottom: 54 });
  setRect(nodes.navigation, { left: 314, top: 17, right: 402, bottom: 45 });
  setRect(nodes.context, { left: 410, top: 17, right: 804, bottom: 45 });
  setRect(nodes.title, { left: 410, top: 21, right: 506, bottom: 41 });
  setRect(nodes.status, { left: 516, top: 22, right: 567, bottom: 39 });
  setRect(nodes.actions, { left: 804, top: 15, right: 1256, bottom: 47 });
  setRect(nodes.toolbar, { left: 998, top: 15, right: 1224, bottom: 47 });
  setRect(nodes.button, { left: 1000, top: 17, right: 1028, bottom: 45 });
  setRect(nodes.compact, { left: 302, top: 54, right: 1268, bottom: 86 });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, descriptor] of viewportDescriptors) {
    if (descriptor) Object.defineProperty(window, key, descriptor);
    else delete window[key];
  }
  document.body.innerHTML = "";
});

describe("resize/reflow header geometry", () => {
  it("uses the explicit complete title/status context group, preserving safe fields", () => {
    const result = read();
    expect(result.stable).toBe(true);
    expect(result.context.rect).toMatchObject({ left: 410, right: 804 });
    expect(JSON.stringify(result)).not.toContain(PRIVATE);
    expect(JSON.stringify(result)).not.toContain("https://");
  });

  it("fails closed when the explicit context is absent despite navigation/title being present", () => {
    nodes.context.removeAttribute("data-testid");
    const result = read();
    expect(result.context).toEqual({
      exists: false,
      visible: false,
      rect: null,
    });
    expect(result.childrenContained).toBe(false);
    expect(result.stable).toBe(false);
  });

  it("rejects the observed 64px toolbar inside a 46px header after viewport clipping", () => {
    setRect(nodes.actions, { left: 804, top: -1, right: 1256, bottom: 63 });
    setRect(nodes.toolbar, { left: 998, top: -1, right: 1224, bottom: 63 });
    const result = read();
    expect(result.toolbar.visualRect).toMatchObject({ top: 0, bottom: 63 });
    expect(result.childrenContained).toBe(false);
    expect(result.stable).toBe(false);
  });

  it("accepts horizontal scrolling with DOMRects outside the clipped actions pane", () => {
    setRect(nodes.toolbar, { left: 700, top: 15, right: 1400, bottom: 47 });
    setRect(nodes.button, { left: 1370, top: 17, right: 1398, bottom: 45 });
    const result = read();
    expect(result.toolbar.rect).toMatchObject({ left: 700, right: 1400 });
    expect(result.toolbar.visualRect).toMatchObject({ left: 804, right: 1256 });
    expect(result.noContextActionsOverlap).toBe(true);
    expect(result.childrenContained).toBe(true);
    expect(result.stable).toBe(true);
  });

  it("rejects raw vertical overflow even if a real overflow ancestor clips its paint", () => {
    setRect(nodes.toolbar, { left: 998, top: -1, right: 1224, bottom: 63 });
    const result = read();
    expect(result.toolbar.visualRect).toMatchObject({ top: 15, bottom: 47 });
    expect(result.childrenContained).toBe(false);
    expect(result.stable).toBe(false);
  });

  it("rejects actual context/actions paint overlap", () => {
    setRect(nodes.context, { left: 410, top: 17, right: 1100, bottom: 45 });
    expect(read().noContextActionsOverlap).toBe(false);
    expect(read().stable).toBe(false);
  });

  it("retains the full context rect and rejects its overflow although its title stays visible", () => {
    nodes.header.style.overflowX = "hidden";
    setRect(nodes.context, { left: 280, top: 17, right: 804, bottom: 45 });
    expect(read().title.visible).toBe(true);
    expect(read().context.rect.left).toBe(280);
    expect(read().childrenContained).toBe(false);
    expect(read().stable).toBe(false);
  });

  it("intersects nested overflow ancestors per axis and respects padding/client bounds", () => {
    const inner = document.createElement("div");
    inner.style.opacity = "1";
    inner.style.overflowX = "hidden";
    inner.style.overflowY = "visible";
    nodes.actions.insertBefore(inner, nodes.toolbar);
    inner.append(nodes.toolbar);
    setRect(inner, { left: 900, top: 10, right: 1200, bottom: 52 });
    Object.defineProperty(inner, "clientLeft", {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(inner, "clientWidth", {
      configurable: true,
      value: 296,
    });
    setRect(nodes.toolbar, { left: 700, top: 15, right: 1400, bottom: 47 });
    setRect(nodes.button, { left: 700, top: 10, right: 1400, bottom: 52 });
    const result = read();
    expect(result.toolbar.visualRect).toMatchObject({
      left: 902,
      right: 1198,
      top: 15,
      bottom: 47,
    });
    expect(result.stable).toBe(true);
  });

  it("rejects vertically overflowing descendant paint without an ancestor clip", () => {
    nodes.actions.style.overflowX = "visible";
    nodes.actions.style.overflowY = "visible";
    setRect(nodes.button, { left: 1000, top: 0, right: 1028, bottom: 65 });
    const result = read();
    expect(result.toolbar.visualRect).toMatchObject({ top: 0, bottom: 65 });
    expect(result.childrenContained).toBe(false);
    expect(result.stable).toBe(false);
  });

  it("rejects a non-finite clipping ancestor client box", () => {
    Object.defineProperty(nodes.actions, "clientWidth", {
      configurable: true,
      value: NaN,
    });
    const result = read();
    expect(result.toolbar.rect).not.toBeNull();
    expect(result.toolbar.visualRect).toBeNull();
    expect(result.stable).toBe(false);
  });

  it.each([0, NaN, Infinity])("rejects invalid viewport width %s", (width) => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    const result = read();
    expect(result.toolbar.visualRect).toBeNull();
    expect(result.stable).toBe(false);
  });

  it.each(["display:none", "visibility:hidden", "opacity:0"])(
    "rejects invisible ancestor %s",
    (style) => {
      nodes.actions.style.cssText = style;
      const result = read();
      expect(result.toolbar.visible).toBe(false);
      expect(result.toolbar.visualRect).toBeNull();
      expect(result.childrenContained).toBe(false);
      expect(result.stable).toBe(false);
    },
  );

  it("rejects fully clipped toolbar without falling back to the actions rect", () => {
    setRect(nodes.toolbar, { left: 1300, top: 15, right: 1400, bottom: 47 });
    setRect(nodes.button, { left: 1310, top: 17, right: 1338, bottom: 45 });
    const result = read();
    expect(result.actions.visible).toBe(true);
    expect(result.toolbar.visualRect).toBeNull();
    expect(result.childrenContained).toBe(false);
    expect(result.stable).toBe(false);
  });

  it.each(["context", "toolbar", "header"])("rejects a NaN %s rect", (key) => {
    setRect(nodes[key], { left: NaN, top: 15, right: 1224, bottom: 47 });
    const result = read();
    expect(result[key].rect).toBeNull();
    expect(result.childrenContained).toBe(false);
    expect(result.stable).toBe(false);
  });

  it("rejects missing toolbar and retains compact-mode-bar guards", () => {
    nodes.toolbar.remove();
    expect(read().stable).toBe(false);
    nodes.actions.append(nodes.toolbar);
    nodes.compact.style.display = "block";
    expect(read().stable).toBe(false);
    expect(read("compact").stable).toBe(true);
    setRect(nodes.compact, { left: 302, top: 40, right: 1268, bottom: 72 });
    expect(read("compact").noCompactModeBarOverlap).toBe(false);
    expect(read("compact").stable).toBe(false);
  });

  it("runs the same callback after serialization with no module closure", () => {
    const serializedCallback = new Function(
      `return (${readResizeReflowHeaderGeometry.toString()})`,
    )();
    expect(serializedCallback({ label: "wide" })).toEqual(read());
  });
});
