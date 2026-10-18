import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarResizeHandle } from "./SidebarResizeHandle";
import { useSidebarWidth } from "./useSidebarWidth";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let dispose = () => {};

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Harness() {
    const { width, setWidth } = useSidebarWidth();
    return <SidebarResizeHandle width={width} onWidthChange={setWidth} />;
  }
  act(() => root.render(<Harness />));
  dispose = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host.querySelector<HTMLElement>('[role="separator"]')!;
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", {
    value: 1200,
    configurable: true,
  });
});
afterEach(() => {
  dispose();
  localStorage.clear();
});

describe("SidebarResizeHandle", () => {
  it("键盘调整受可用空间约束，保存后重新挂载恢复", () => {
    const handle = mount();
    act(() =>
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true }),
      ),
    );
    expect(handle.getAttribute("aria-valuenow")).toBe("520");
    expect(localStorage.getItem("sidebar-width")).toBe("520");
    dispose();
    const restored = mount();
    expect(restored.getAttribute("aria-valuenow")).toBe("520");
    Object.defineProperty(window, "innerWidth", {
      value: 720,
      configurable: true,
    });
    act(() =>
      restored.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(restored.getAttribute("aria-valuenow")).toBe("400");
  });

  it("拖动取消恢复原宽度，不覆盖已保存偏好", () => {
    localStorage.setItem("sidebar-width", "300");
    const handle = mount();
    handle.setPointerCapture = vi.fn();
    handle.hasPointerCapture = () => false;
    const pointer = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX });
      Object.defineProperty(event, "pointerId", { value: 1 });
      act(() => handle.dispatchEvent(event));
    };
    pointer("pointerdown", 300);
    pointer("pointermove", 450);
    expect(handle.getAttribute("aria-valuenow")).toBe("450");
    pointer("pointercancel", 450);
    expect(handle.getAttribute("aria-valuenow")).toBe("300");
    expect(localStorage.getItem("sidebar-width")).toBe("300");
    pointer("pointerdown", 300);
    pointer("pointermove", 420);
    pointer("pointerup", 420);
    expect(localStorage.getItem("sidebar-width")).toBe("420");
  });
});
