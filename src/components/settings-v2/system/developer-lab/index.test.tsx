import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";

const { mockDeveloperSettings, mockExperimentalSettings } = vi.hoisted(() => ({
  mockDeveloperSettings: vi.fn(),
  mockExperimentalSettings: vi.fn(),
}));

vi.mock("../developer", () => ({
  DeveloperSettings: (props: unknown) => {
    mockDeveloperSettings(props);
    return <div>Developer panel placeholder</div>;
  },
}));

vi.mock("../experimental", () => ({
  ExperimentalSettings: (props: unknown) => {
    mockExperimentalSettings(props);
    return (
      <div>
        Experimental panel placeholder
        <input data-testid="experimental-draft" />
      </div>
    );
  },
}));

import { DeveloperLabSettings } from ".";

interface Mounted {
  container: HTMLDivElement;
  root: Root;
}

const mounted: Mounted[] = [];

function renderComponent(
  initialTab?: "developer" | "experimental",
): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<DeveloperLabSettings initialTab={initialTab} />);
  });

  mounted.push({ container, root });
  return container;
}

beforeEach(async () => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  mockDeveloperSettings.mockReset();
  mockExperimentalSettings.mockReset();
  await changeLimeLocale("en-US");
});

afterEach(async () => {
  while (mounted.length > 0) {
    const current = mounted.pop();
    if (!current) {
      break;
    }

    act(() => {
      current.root.unmount();
    });
    current.container.remove();
  }

  await changeLimeLocale("zh-CN");
});

describe("DeveloperLabSettings", () => {
  it("应默认在合并页展示开发者工具 tab", () => {
    const container = renderComponent();
    const text = container.textContent ?? "";

    expect(text).toContain("Developer & Labs");
    expect(text).toContain("Developer Tools");
    expect(text).toContain("Experimental Features");
    expect(text).toContain("Developer panel placeholder");
    expect(text).not.toContain("Experimental panel placeholder");
    expect(text).not.toContain("开发者与实验功能");
    expect(text).not.toContain("settings.developerLab");
    expect(mockDeveloperSettings).toHaveBeenCalledWith({ embedded: true });
    expect(mockExperimentalSettings).not.toHaveBeenCalled();
  });

  it("旧实验功能入口进入合并页时应默认选中实验功能 tab", () => {
    const container = renderComponent("experimental");
    const text = container.textContent ?? "";

    expect(text).toContain("Experimental panel placeholder");
    expect(text).not.toContain("Developer panel placeholder");
    expect(mockExperimentalSettings).toHaveBeenCalledWith({ embedded: true });
  });

  it("切换实验功能 tab 后应只挂载实验功能内容", () => {
    const container = renderComponent();
    const experimentalTab = container.querySelector<HTMLButtonElement>(
      '[data-testid="developer-lab-tab-experimental"]',
    );

    act(() => {
      experimentalTab?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Experimental panel placeholder");
    expect(text).not.toContain("Developer panel placeholder");
    expect(mockExperimentalSettings).toHaveBeenCalledWith({ embedded: true });
  });

  it("initialTab 变化时保留唯一实验页实例，并移走隐藏字段焦点", () => {
    const container = renderComponent("experimental");
    const original = container.querySelector<HTMLInputElement>(
      '[data-testid="experimental-draft"]',
    )!;
    original.value = "retained draft";
    original.focus();
    const current = mounted[mounted.length - 1];
    act(() =>
      current.root.render(<DeveloperLabSettings initialTab="developer" />),
    );
    expect(container.querySelector('[data-testid="experimental-draft"]')).toBe(
      original,
    );
    expect(original.closest("[hidden]")).not.toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="developer-lab-tab-developer"]'),
    );
    act(() =>
      current.root.render(<DeveloperLabSettings initialTab="experimental" />),
    );
    expect(container.querySelector('[data-testid="experimental-draft"]')).toBe(
      original,
    );
    expect(original.value).toBe("retained draft");
    expect(original.closest("[hidden]")).toBeNull();
    expect(
      container.querySelectorAll('[data-testid="experimental-draft"]'),
    ).toHaveLength(1);
  });
});
