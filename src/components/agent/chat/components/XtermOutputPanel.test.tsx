import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { XtermOutputPanel } from "./XtermOutputPanel";
import { LIME_THEME_CHANGED_EVENT } from "@/lib/appearance/themeMode";

vi.mock("@/lib/api/externalUrl", () => ({
  openExternalUrlWithSystemBrowser: vi.fn(),
}));
const terminals: Terminal[] = [];
class Terminal {
  options: Record<string, unknown>;
  rows = 24;
  buffer = { active: { baseY: 100, viewportY: 100 } };
  write = vi.fn((_value: string, done?: () => void) => done?.());
  reset = vi.fn();
  scrollToBottom = vi.fn();
  refresh = vi.fn();
  dispose = vi.fn();
  loadAddon() {}
  open() {}
  attachCustomKeyEventHandler() {}
  constructor(options: Record<string, unknown>) {
    this.options = options;
    terminals.push(this);
  }
}
vi.mock("@xterm/xterm", () => ({ Terminal }));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
  },
}));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: class {} }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("XtermOutputPanel canonical output snapshots", () => {
  let root: Root;
  let container: HTMLDivElement;
  const render = async (output: string) => {
    await act(async () => {
      root.render(<XtermOutputPanel output={output} />);
    });
    await vi.waitFor(() => expect(terminals.length).toBe(1));
  };
  beforeEach(() => {
    terminals.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  it("appends only new output, preserves manual scrolling and resets replaced snapshots", async () => {
    await render("first\r\n");
    const terminal = terminals[0];
    expect(terminal.options.disableStdin).toBe(true);
    expect(terminal.write.mock.calls.map(([value]) => value)).toEqual([
      "first\r\n",
    ]);
    await render("first\r\nsecond\r\n");
    expect(terminal.write.mock.calls.at(-1)?.[0]).toBe("second\r\n");
    const followed = terminal.scrollToBottom.mock.calls.length;
    terminal.buffer.active.viewportY = 0;
    await render("first\r\nsecond\r\nthird");
    expect(terminal.scrollToBottom.mock.calls.length).toBe(followed);
    await render("replacement");
    expect(terminal.reset).toHaveBeenCalledOnce();
    expect(terminal.write.mock.calls.at(-1)?.[0]).toBe("replacement");
    await render("");
    expect(terminal.reset).toHaveBeenCalledTimes(2);
  });
  it("updates the current theme without recreating the view and disposes on close", async () => {
    await render("output");
    const terminal = terminals[0];
    const host = container.querySelector(
      '[data-testid="xterm-output-panel"] > div > div',
    ) as HTMLElement;
    // JSDOM不继承自定义属性；在实际读取的节点设置相同token。
    host.style.setProperty("--lime-surface", "#123456");
    act(() => window.dispatchEvent(new CustomEvent(LIME_THEME_CHANGED_EVENT)));
    expect(terminal.options.theme).toMatchObject({ background: "#123456" });
    expect(terminal.refresh).toHaveBeenCalledWith(0, 23);
    expect(terminals).toHaveLength(1);
    await act(async () => root.render(null));
    expect(terminal.dispose).toHaveBeenCalledOnce();
  });
});
