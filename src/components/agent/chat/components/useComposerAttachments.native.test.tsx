import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import type { PickedFile } from "@/lib/api/filePicker";
import { changeLimeLocale } from "@/i18n/createI18n";
import { useComposerAttachments } from "./useComposerAttachments";

const mocks = vi.hoisted(() => ({
  pick: vi.fn(),
  read: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/lib/api/filePicker", () => ({ pickFilesFromDialog: mocks.pick }));
vi.mock("@/lib/api/fileBrowser", () => ({ readFileBytes: mocks.read }));
vi.mock("sonner", () => ({
  toast: { error: mocks.error, success: mocks.success },
}));

const file = (fsPath: string, directory = false): PickedFile => ({
  fsPath,
  path: fsPath + (directory ? "/" : ""),
  label: fsPath.split("/").at(-1)!,
});
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
let latest: ReturnType<typeof useComposerAttachments>;
let root: Root;
let container: HTMLDivElement;
function Harness({ owner }: { owner: ComposerController }) {
  latest = useComposerAttachments({ controller: owner });
  return <span>{latest.pendingImages.length}</span>;
}
function mount(owner = new ComposerController({ text: "keep my draft" })) {
  act(() => root.render(<Harness owner={owner} />));
  return owner;
}
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  await changeLimeLocale("en-US");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.pick.mockResolvedValue([]);
  mocks.read.mockResolvedValue(new Uint8Array([1, 2, 3]));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("shared native Composer attachments", () => {
  it("routes images, files and folders into the same rich draft without altering text", async () => {
    const owner = mount();
    act(() =>
      owner.insertMention(
        {
          id: "review",
          kind: "skill",
          name: "review",
          path: "/skills/review/SKILL.md",
          label: "/review",
        },
        { start: 0, end: 0 },
      ),
    );
    const before = owner.captureDraft();
    mocks.pick.mockResolvedValue([
      file("/work/photo.png"),
      file("/work/brief.md"),
      file("/work/folder.png", true),
    ]);
    let added;
    await act(async () => {
      added = await latest.openFileDialog();
    });
    expect(added).toBe(true);
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith("/work/photo.png");
    expect(owner.getDocument().attachments).toEqual([
      { data: "AQID", mediaType: "image/png" },
    ]);
    expect(
      owner.getDocument().pathReferences.map((item) => [item.path, item.isDir]),
    ).toEqual([
      ["/work/brief.md", false],
      ["/work/folder.png", true],
    ]);
    expect(owner.getDocument().editorDocument).toEqual(before.editorDocument);
  });
  it("cancellation preserves the exact draft and revision", async () => {
    const owner = mount(),
      before = owner.getSnapshot();
    await act(async () => expect(await latest.openFileDialog()).toBe(false));
    expect(owner.getSnapshot()).toBe(before);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(["success", "failure"])(
    "clear discards late picker %s and permits a new selection",
    async (outcome) => {
      const owner = mount(),
        pending = deferred<PickedFile[]>();
      mocks.pick.mockReturnValueOnce(pending.promise);
      let picking: Promise<boolean>;
      act(() => {
        picking = latest.openFileDialog();
      });
      act(() => owner.clear());
      const before = owner.getSnapshot();
      await act(async () => {
        if (outcome === "success") pending.resolve([file("/old.md")]);
        else pending.reject(new Error("late failure"));
        expect(await picking).toBe(false);
      });
      expect(owner.getSnapshot()).toBe(before);
      expect(mocks.error).not.toHaveBeenCalled();
      mocks.pick.mockResolvedValue([file("/new.md")]);
      await act(async () => expect(await latest.openFileDialog()).toBe(true));
      expect(
        owner.getDocument().pathReferences.map((item) => item.path),
      ).toEqual(["/new.md"]);
    },
  );
  it.each(["switch", "unmount"])(
    "%s discards a late native result and error",
    async (action) => {
      const owner = mount(),
        pending = deferred<PickedFile[]>();
      mocks.pick.mockReturnValueOnce(pending.promise);
      let picking: Promise<boolean>;
      act(() => {
        picking = latest.openFileDialog();
      });
      const next = new ComposerController();
      if (action === "switch") mount(next);
      else act(() => root.render(null));
      await act(async () => {
        pending.resolve([file("/old.md")]);
        expect(await picking).toBe(false);
      });
      expect(owner.getDocument().pathReferences).toEqual([]);
      expect(next.getDocument().pathReferences).toEqual([]);
      expect(mocks.error).not.toHaveBeenCalled();
    },
  );
  it("reset during native image read discards image and accompanying paths", async () => {
    const owner = mount(),
      bytes = deferred<Uint8Array>();
    mocks.read.mockReturnValueOnce(bytes.promise);
    let reading: Promise<void>;
    act(() => {
      reading = latest.addPickedFiles([file("/photo.png"), file("/brief.md")]);
    });
    act(() => owner.restoreDraft({ text: "new draft" }));
    await act(async () => {
      bytes.resolve(new Uint8Array([1]));
      await reading;
    });
    expect(owner.getDocument().text).toBe("new draft");
    expect(owner.getDocument().attachments).toEqual([]);
    expect(owner.getDocument().pathReferences).toEqual([]);
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it("current picker failure is visible and leaves the draft intact", async () => {
    const owner = mount(),
      before = owner.getSnapshot();
    mocks.pick.mockRejectedValueOnce(new Error("native failed"));
    await act(async () => expect(await latest.openFileDialog()).toBe(false));
    expect(owner.getSnapshot()).toBe(before);
    expect(mocks.error).toHaveBeenCalledWith(
      "Unable to attach files or folders",
    );
  });
  it("one unreadable image does not discard other selected files", async () => {
    const owner = mount();
    mocks.read.mockRejectedValueOnce(new Error("read failed"));
    await act(async () =>
      latest.addPickedFiles([file("/photo.png"), file("/brief.md")]),
    );
    expect(owner.getDocument().attachments).toEqual([]);
    expect(owner.getDocument().pathReferences.map((item) => item.path)).toEqual(
      ["/brief.md"],
    );
    expect(mocks.error).toHaveBeenCalledOnce();
  });
  it("deduplicates repeated native file selection in the current owner", async () => {
    const owner = mount();
    await act(async () => {
      await latest.addPickedFiles([file("/brief.md")]);
      await latest.addPickedFiles([file("/brief.md")]);
    });
    expect(owner.getDocument().pathReferences).toHaveLength(1);
  });
});
