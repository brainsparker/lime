import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactPreviewHeader } from "./ArtifactPreviewHeader";
import type { OpenInTarget } from "@/lib/api/openInTypes";

const boundary = vi.hoisted(() => ({
  reveal: vi.fn(),
  save: vi.fn(),
  copy: vi.fn(),
  error: vi.fn(),
  native: vi.fn(),
  query: vi.fn(),
  open: vi.fn(),
}));
vi.mock("@/lib/desktop-runtime", () => ({
  hasDesktopHostInvokeCapability: boundary.native,
}));
vi.mock("@/lib/openInTargets", () => ({
  useTargetApps: boundary.query,
  openTarget: boundary.open,
}));
vi.mock("@/lib/api/fileSystem", () => ({
  revealPathInFinder: boundary.reveal,
}));
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
  useTranslation: () => ({
    t: (key: string, options?: { app: string }) =>
      options ? `${key}:${options.app}` : key,
  }),
}));

let root: Root;
let host: HTMLDivElement;
let apps: {
  primaryTarget: OpenInTarget | null;
  visibleTargets: OpenInTarget[];
  isPending: boolean;
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.resetAllMocks();
  apps = { primaryTarget: null, visibleTargets: [], isPending: false };
  boundary.query.mockImplementation(() => apps);
  boundary.native.mockReturnValue(false);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const prefix = "workspace.artifactPreviewHeader.";
const button = (name: string) =>
  host.querySelector<HTMLButtonElement>(
    `button[aria-label="${prefix + name}"]`,
  )!;
async function render(
  path = "/work/notes.txt",
  props: Omit<Parameters<typeof ArtifactPreviewHeader>[0], "path"> = {},
) {
  await act(async () =>
    root.render(<ArtifactPreviewHeader path={path} {...props} />),
  );
}
async function openMenu() {
  await act(async () => {
    button("openOptions").dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
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

  it("原生首选应用驱动主动作和图标，菜单不重复文件管理器或写入偏好", async () => {
    const editor: OpenInTarget = {
      id: "app:/Applications/Editor.app",
      target: "systemDefault",
      kind: "native",
      appPath: "/Applications/Editor.app",
      label: "Editor",
      available: true,
      icon: "data:image/png;base64,AA==",
    };
    apps.primaryTarget = editor;
    apps.visibleTargets = [
      editor,
      {
        id: "fileManager",
        target: "fileManager",
        kind: "builtin",
        label: "File Manager",
        available: true,
        icon: null,
      },
    ];
    boundary.native.mockReturnValue(true);
    await render(undefined, { cwd: "/work", hostId: "local" });
    expect(boundary.query).toHaveBeenLastCalledWith(
      { cwd: "/work", hostId: "local", path: "/work/notes.txt" },
      true,
    );
    const primary = host.querySelector<HTMLButtonElement>(
      'button[aria-label="workspace.fileActions.openIn:Editor"]',
    )!;
    expect(primary.querySelector("img")?.getAttribute("src")).toBe(editor.icon);
    await act(async () => primary.click());
    const request = {
      cwd: "/work",
      hostId: "local",
      path: "/work/notes.txt",
      target: "systemDefault",
      appPath: editor.appPath,
      openMode: "file",
    };
    expect(boundary.open).toHaveBeenCalledExactlyOnceWith(request);
    const items = await openMenu();
    expect(items.map((item) => item.textContent)).toEqual([
      "Editor",
      prefix + "openInFolder",
      prefix + "saveAs",
    ]);
    expect(document.activeElement).toBe(items[0]);
    await act(async () => items[0].click());
    expect(boundary.open).toHaveBeenLastCalledWith(request);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(boundary.reveal).not.toHaveBeenCalled();
  });

  it("目标未就绪时展示等待状态，主动作仍走真实文件管理器", async () => {
    boundary.native.mockReturnValue(true);
    apps.isPending = true;
    await render();
    const items = await openMenu();
    expect(items.map((item) => item.textContent)).toEqual([
      prefix + "openInFolder",
      prefix + "saveAs",
    ]);
    expect(document.querySelector('[role="status"]')?.textContent).toBe(
      prefix + "loadingAvailableApps",
    );
    await act(async () => items[0].click());
    expect(boundary.open).toHaveBeenCalledExactlyOnceWith({
      path: "/work/notes.txt",
      cwd: undefined,
      hostId: undefined,
      target: "fileManager",
      openMode: "file",
    });
  });

  it("缺少原生Host时不启用应用发现", async () => {
    await render();
    expect(boundary.query).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "/work/notes.txt" }),
      false,
    );
  });

  it.each(["open", "saveAs"])(
    "保存被阻止时%s不读取旧磁盘文件",
    async (action) => {
      const before = vi.fn().mockResolvedValue(false);
      await render(undefined, { onBeforeFileAction: before });
      if (action === "open") await act(async () => button("open").click());
      else {
        const items = await openMenu();
        await act(async () => items.at(-1)!.click());
      }
      expect(before).toHaveBeenCalledOnce();
      expect(boundary.reveal).not.toHaveBeenCalled();
      expect(boundary.save).not.toHaveBeenCalled();
      expect(button("open").disabled).toBe(false);
    },
  );

  it.each(["change-path", "change-cwd", "unmount"])(
    "保存等待中%s使迟到外部打开失效",
    async (action) => {
      let finish!: (saved: boolean) => void;
      const before = vi.fn(() => new Promise<boolean>((r) => (finish = r)));
      await render(undefined, { cwd: "/work", onBeforeFileAction: before });
      await act(async () => button("open").click());
      expect(button("open").disabled).toBe(true);
      if (action === "unmount") await act(async () => root.render(null));
      else
        await render(action === "change-path" ? "/work/other.txt" : undefined, {
          cwd: action === "change-cwd" ? "/other" : "/work",
          onBeforeFileAction: before,
        });
      await act(async () => finish(true));
      expect(boundary.reveal).not.toHaveBeenCalled();
      expect(boundary.open).not.toHaveBeenCalled();
      expect(boundary.error).not.toHaveBeenCalled();
    },
  );
});
