import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TextFileEditorTabContent } from "./TextFileEditorTabContent";
import type { FileTabDrafts } from "./fileTabDraftContext";
import type { FileEditorDraft } from "./FileEditorController";
import type { ThreadSidePanelTab } from "../right-surface/threadSidePanelTabs";

const storage = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@/lib/api/textFileStorage", () => ({
  createTextFileStorage: () => storage,
}));
vi.mock("@/lib/api/fileSystemWatch", () => ({
  startFileSystemWatch: async () => async () => undefined,
}));
vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
vi.mock("./CodeMirrorFileEditor", () => ({
  CodeMirrorFileEditor: ({
    controller,
    focusRequest,
  }: {
    controller: import("./FileEditorController").FileEditorController;
    focusRequest?: number;
  }) => (
    <div data-testid="mock-file-editor" data-focus-request={focusRequest}>
      <input
        data-testid="mock-file-content"
        readOnly
        value={controller.getContent()}
      />
      <button
        data-testid="mock-file-save"
        onClick={() => void controller.saveUntilClean()}
      />
    </div>
  ),
}));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  storage.read.mockResolvedValue({ content: "base", mtimeMs: 1, sizeBytes: 4 });
  storage.write.mockRejectedValue(new Error("disk full"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.resetAllMocks();
});

describe("文件标签草稿接线", () => {
  it.each(["edit", "accept", "reject"] as const)(
    "冲突审阅%s使用同一控制器并保持原编辑器实例",
    async (action) => {
      storage.read.mockResolvedValue({
        content: "disk",
        mtimeMs: 2,
        sizeBytes: 4,
      });
      storage.write.mockResolvedValue({ outcome: "saved", mtimeMs: 3 });
      const tab: ThreadSidePanelTab = {
        tabId: "file:/work/notes.txt",
        kind: "files",
      };
      await act(async () =>
        root.render(
          <TextFileEditorTabContent
            path="/work/notes.txt"
            tab={tab}
            initialDraft={{
              content: "local",
              document: { kind: "ready", baseContent: "base" },
            }}
          />,
        ),
      );
      const editor = host.querySelector('[data-testid="mock-file-editor"]')!;
      const retained = editor.closest("[inert]");
      expect(retained?.hasAttribute("hidden")).toBe(true);
      expect(
        host.querySelector('[data-testid="file-editor-conflict"]'),
      ).not.toBeNull();
      expect(storage.write).not.toHaveBeenCalled();
      await act(async () =>
        host
          .querySelector<HTMLButtonElement>(
            `[data-testid="file-editor-conflict-${action}"]`,
          )!
          .click(),
      );
      expect(
        host.querySelector('[data-testid="file-editor-conflict"]'),
      ).toBeNull();
      expect(host.querySelector('[data-testid="mock-file-editor"]')).toBe(
        editor,
      );
      expect(editor.closest("[inert]")).toBeNull();
      expect(
        host.querySelector<HTMLInputElement>(
          '[data-testid="mock-file-content"]',
        )?.value,
      ).toBe(action === "reject" ? "disk" : "local");
      if (action === "edit")
        expect(editor.getAttribute("data-focus-request")).toBe("1");
      await act(async () =>
        host
          .querySelector<HTMLButtonElement>('[data-testid="mock-file-save"]')!
          .click(),
      );
      if (action === "reject") expect(storage.write).not.toHaveBeenCalled();
      else
        expect(storage.write).toHaveBeenCalledWith(
          "local",
          2,
          expect.any(AbortSignal),
        );
    },
  );

  it("卸载前快照最新草稿，旧实例迟到保存不能回写标签检查点", async () => {
    let finish!: (value: { outcome: "saved"; mtimeMs: number }) => void;
    storage.write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onDraftChange = vi.fn();
    const tab: ThreadSidePanelTab = {
      tabId: "file:/work/notes.txt",
      kind: "files",
    };
    await act(async () =>
      root.render(
        <TextFileEditorTabContent
          path="/work/notes.txt"
          tab={tab}
          initialDraft={{
            content: "local",
            document: { kind: "ready", baseContent: "base" },
          }}
          onDraftChange={onDraftChange}
        />,
      ),
    );
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('[data-testid="mock-file-save"]')!
        .click(),
    );
    await act(async () => root.render(null));
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: "local" }),
    );
    const count = onDraftChange.mock.calls.length;
    await act(async () => finish({ outcome: "saved", mtimeMs: 2 }));
    expect(onDraftChange).toHaveBeenCalledTimes(count);
  });

  it("controller加载使用同一tab的初稿，保存失败后回传草稿并可重建恢复", async () => {
    const tab: ThreadSidePanelTab = {
      tabId: "file:/work/notes.txt",
      kind: "files",
      filePath: "/work/notes.txt",
    };
    let checkpoint: FileEditorDraft | null = {
      content: "local",
      document: { kind: "ready", baseContent: "base" },
    };
    const drafts: FileTabDrafts = {
      getFileDraft: vi.fn((current) => (current === tab ? checkpoint : null)),
      setFileDraft: vi.fn((current, draft) => {
        expect(current).toBe(tab);
        checkpoint = draft;
      }),
    };
    const render = () =>
      root.render(
        <TextFileEditorTabContent
          path="/work/notes.txt"
          tab={tab}
          initialDraft={drafts.getFileDraft(tab)}
          onDraftChange={(draft) => drafts.setFileDraft(tab, draft)}
        />,
      );
    await act(async () => render());
    expect(
      host
        .querySelector('[data-testid="text-file-editor"]')
        ?.getAttribute("data-dirty"),
    ).toBe("true");
    const save = host.querySelector<HTMLButtonElement>(
      '[data-testid="mock-file-save"]',
    )!;
    await act(async () => save.click());
    expect(storage.write).toHaveBeenCalledWith(
      "local",
      1,
      expect.any(AbortSignal),
    );
    expect(drafts.setFileDraft).toHaveBeenLastCalledWith(
      tab,
      expect.objectContaining({ content: "local" }),
    );
    await act(async () => root.render(null));
    await act(async () => render());
    expect(drafts.getFileDraft).toHaveBeenCalledTimes(2);
    expect(
      host
        .querySelector('[data-testid="text-file-editor"]')
        ?.getAttribute("data-dirty"),
    ).toBe("true");
    expect(checkpoint?.content).toBe("local");
  });
});
