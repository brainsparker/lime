import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactPreviewHeader } from "./ArtifactPreviewHeader";

const boundary = vi.hoisted(() => ({
  reveal: vi.fn(),
  save: vi.fn(),
  copy: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/api/fileSystem", () => ({ revealPathInFinder: boundary.reveal }));
vi.mock("@/lib/desktop-host/dialog", () => ({ save: boundary.save }));
vi.mock("@/lib/api/fileBrowser", () => ({ copyFile: boundary.copy }));
vi.mock("sonner", () => ({ toast: { error: boundary.error } }));
vi.mock("./presentation/PresentationController", async () => {
  const { atom } = await import("jotai");
  return { presentationControllersAtom: atom(new Map()) };
});
vi.mock("./workbook/WorkbookController", async () => {
  const { atom } = await import("jotai");
  return { workbookControllersAtom: atom(new Map()) };
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.resetAllMocks();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const prefix = "workspace.artifactPreviewHeader.";
const button = (name: string) =>
  host.querySelector<HTMLButtonElement>(`button[aria-label="${prefix + name}"]`)!;
async function render(path = "/work/notes.txt") {
  await act(async () => root.render(<ArtifactPreviewHeader path={path} />));
}
async function openMenu() {
  await act(async () => {
    button("openOptions").dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

describe("本地文件 viewer 工具栏", () => {
  it("没有首选目标时主动作打开文件管理器，菜单保持参考顺序", async () => {
    await render();
    await act(async () => button("open").click());
    expect(boundary.reveal).toHaveBeenCalledExactlyOnceWith("/work/notes.txt");
    const items = await openMenu();
    expect(items.map((item) => item.textContent)).toEqual([
      prefix + "openInFolder",
      prefix + "saveAs",
    ]);
    expect(document.activeElement).toBe(items[0]);
    await act(async () =>
      items[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(boundary.reveal).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("另存为走原生对话框和复制；等待时阻止重复动作", async () => {
    let resolve!: (path: string) => void;
    boundary.save.mockReturnValue(new Promise<string>((r) => (resolve = r)));
    await render();
    const items = await openMenu();
    await act(async () => items[1].click());
    expect(boundary.save).toHaveBeenCalledOnce();
    expect(button("open").disabled).toBe(true);
    expect(button("openOptions").disabled).toBe(true);
    await act(async () => button("open").click());
    expect(boundary.reveal).not.toHaveBeenCalled();
    await act(async () => resolve("/exports/copy.txt"));
    expect(boundary.copy).toHaveBeenCalledExactlyOnceWith(
      "/work/notes.txt",
      "/exports/copy.txt",
    );
    expect(button("open").disabled).toBe(false);
  });

  it.each(["change-path", "unmount"])(
    "%s使旧对话框结果失效，保留原文件",
    async (action) => {
      let resolve!: (path: string) => void;
      boundary.save.mockReturnValue(new Promise<string>((r) => (resolve = r)));
      await render();
      const items = await openMenu();
      await act(async () => items[1].click());
      if (action === "change-path") await render("/work/other.txt");
      else await act(async () => root.render(null));
      await act(async () => resolve("/exports/copy.txt"));
      expect(boundary.copy).not.toHaveBeenCalled();
      expect(boundary.error).not.toHaveBeenCalled();
    },
  );

  it("文件动作失败可重试，并由既有公共动作反馈错误", async () => {
    boundary.reveal.mockRejectedValueOnce(new Error("missing file"));
    await render();
    await act(async () => button("open").click());
    expect(boundary.error).toHaveBeenCalledExactlyOnceWith(
      "workspace.fileActions.actionFailed",
    );
    expect(button("open").disabled).toBe(false);
    await act(async () => button("open").click());
    expect(boundary.reveal).toHaveBeenCalledTimes(2);
  });
});
