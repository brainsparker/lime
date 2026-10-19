import { afterEach, describe, expect, it, vi } from "vitest";
import { FileEditorController } from "./FileEditorController";
import type {
  TextFileSnapshot,
  TextFileStorage,
} from "@/lib/api/textFileStorage";
import { getExternalReview, MAX_EDITABLE_FILE_BYTES } from "./fileDocument";

const controllers: FileEditorController[] = [];
function create(content = "base\r\n") {
  let disk: TextFileSnapshot = {
    content,
    mtimeMs: 1,
    sizeBytes: content.length,
  };
  const read = vi.fn(async () => ({ ...disk }));
  const write = vi.fn<TextFileStorage["write"]>(async (content, mtime) => {
    if (mtime !== disk.mtimeMs) return { outcome: "conflict" };
    disk = { content, mtimeMs: mtime + 1, sizeBytes: content.length };
    return { outcome: "saved", mtimeMs: disk.mtimeMs };
  });
  const controller = new FileEditorController({ read, write });
  controllers.push(controller);
  return {
    controller,
    read,
    write,
    disk: () => disk,
    changeDisk(content: string) {
      disk = { content, mtimeMs: disk.mtimeMs + 1, sizeBytes: content.length };
    },
  };
}
afterEach(() => {
  for (const c of controllers.splice(0)) c.discard();
  vi.useRealTimers();
});

describe("FileEditorController", () => {
  it("恢复未保存草稿时重读磁盘，保留冲突；干净草稿不能覆盖新磁盘版本", async () => {
    const dirty = create("external");
    await dirty.controller.load({
      content: "local",
      document: { kind: "ready", baseContent: "base" },
    });
    expect(dirty.controller.getSnapshot()).toMatchObject({
      content: "local",
      hasUnsavedChanges: true,
      document: {
        kind: "conflict",
        baseContent: "base",
        diskContent: "external",
      },
    });
    expect(await dirty.controller.saveUntilClean()).toBe(false);
    expect(dirty.write).not.toHaveBeenCalled();

    const clean = create("external");
    await clean.controller.load({
      content: "base",
      document: { kind: "ready", baseContent: "base" },
      history: [],
    });
    expect(clean.controller.getSnapshot()).toMatchObject({
      content: "external",
      hasUnsavedChanges: false,
      document: { kind: "ready", baseContent: "external" },
    });
    expect(clean.controller.getDraft()).toBeNull();
  });

  it("草稿回传覆盖失败保存和显式放弃；迟到保存不恢复已放弃草稿", async () => {
    const onDraftChange = vi.fn();
    let finish!: (value: { outcome: "saved"; mtimeMs: number }) => void;
    const write = vi.fn<TextFileStorage["write"]>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const controller = new FileEditorController(
      {
        read: async () => ({ content: "base", mtimeMs: 1, sizeBytes: 4 }),
        write,
      },
      { onDraftChange },
    );
    controllers.push(controller);
    await controller.load();
    controller.edit("local");
    controller.flushDraftSnapshot();
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: "local" }),
    );
    const saving = controller.saveUntilClean();
    controller.discard();
    expect(onDraftChange).toHaveBeenLastCalledWith(null);
    const count = onDraftChange.mock.calls.length;
    finish({ outcome: "saved", mtimeMs: 2 });
    await saving;
    expect(onDraftChange).toHaveBeenCalledTimes(count);
    expect(controller.getDraft()).toBeNull();
  });

  it("500ms草稿与3s自动保存，保留原CRLF", async () => {
    vi.useFakeTimers();
    const view = create();
    await view.controller.load();
    view.controller.edit("edited\nnext\n");
    expect(view.controller.getDraft()).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    expect(view.controller.getDraft()?.content).toBe("edited\r\nnext\r\n");
    expect(view.write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2500);
    expect(view.disk().content).toBe("edited\r\nnext\r\n");
    expect(view.controller.getSnapshot().hasUnsavedChanges).toBe(false);
  });
  it.each(["line\rnext\r", "line\nnext\n", "one\r\ntwo\n"])(
    "未更改的原字节不重写，编辑保持换行：%j",
    async (base) => {
      const view = create(base);
      await view.controller.load();
      expect(view.controller.getContent()).toBe(base);
      expect(await view.controller.saveUntilClean()).toBe(true);
      expect(view.write).not.toHaveBeenCalled();
      view.controller.edit("changed\n");
      await view.controller.saveUntilClean();
      expect(view.disk().content).toBe(
        base.includes("\r\n")
          ? "changed\r\n"
          : base.includes("\r")
            ? "changed\r"
            : "changed\n",
      );
    },
  );
  it("串行保存期间继续输入，saveUntilClean落地最新版本", async () => {
    const view = create("base");
    await view.controller.load();
    let finish!: (value: { outcome: "saved"; mtimeMs: number }) => void;
    view.write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    view.controller.edit("first");
    const saved = view.controller.saveUntilClean();
    view.controller.edit("latest");
    expect(view.write).toHaveBeenCalledTimes(1);
    finish({ outcome: "saved", mtimeMs: 1 });
    expect(await saved).toBe(true);
    expect(view.disk().content).toBe("latest");
    expect(view.write).toHaveBeenCalledTimes(2);
    expect(view.controller.getSnapshot().hasUnsavedChanges).toBe(false);
  });
  it("mtime冲突不覆盖磁盘；accept保留本地，reject采用磁盘", async () => {
    const view = create("base");
    await view.controller.load();
    view.controller.edit("local");
    view.changeDisk("disk");
    expect(await view.controller.saveUntilClean()).toBe(false);
    expect(view.disk().content).toBe("disk");
    expect(
      getExternalReview(view.controller.getSnapshot().document!, "local"),
    ).toEqual({ oldContent: "disk", newContent: "local" });
    view.controller.resolveExternalChange("accept");
    expect(await view.controller.saveUntilClean()).toBe(true);
    expect(view.disk().content).toBe("local");
    view.controller.edit("another");
    view.changeDisk("new-disk");
    await view.controller.syncExternalChange();
    view.controller.resolveExternalChange("reject");
    expect(view.controller.getContent()).toBe("new-disk");
    expect(view.controller.getSnapshot().hasUnsavedChanges).toBe(false);
  });
  it("无本地更改时审阅方向相反；磁盘恢复base清除冲突", async () => {
    const view = create("base");
    await view.controller.load();
    view.changeDisk("external");
    await view.controller.syncExternalChange();
    expect(
      getExternalReview(view.controller.getSnapshot().document!, "base"),
    ).toEqual({ oldContent: "base", newContent: "external" });
    view.changeDisk("base");
    await view.controller.syncExternalChange();
    expect(view.controller.getSnapshot().document?.kind).toBe("ready");
    view.changeDisk("changed");
    await view.controller.syncExternalChange();
    view.controller.resolveExternalChange("accept");
    expect(view.controller.getContent()).toBe("changed");
    expect(view.controller.getSnapshot().hasUnsavedChanges).toBe(false);
  });
  it("迟到读取不能覆盖已保存版本或新外部同步", async () => {
    const view = create("base");
    await view.controller.load();
    let finish!: (snapshot: TextFileSnapshot) => void;
    view.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const sync = view.controller.syncExternalChange();
    view.controller.edit("new");
    await view.controller.saveUntilClean();
    finish({ content: "stale", mtimeMs: 0, sizeBytes: 5 });
    await sync;
    expect(view.controller.getSnapshot().document).toEqual({
      kind: "ready",
      baseContent: "new",
    });
    expect(view.controller.getContent()).toBe("new");
  });
  it("失败保存保留dirty和草稿；重试后清除错误", async () => {
    const view = create("base");
    await view.controller.load();
    view.controller.edit("local");
    view.write.mockRejectedValueOnce(new Error("disk full"));
    expect(await view.controller.saveUntilClean()).toBe(false);
    expect(view.controller.getSnapshot()).toMatchObject({
      hasSaveError: true,
      hasUnsavedChanges: true,
    });
    expect(view.controller.getDraft()?.content).toBe("local");
    expect(await view.controller.saveUntilClean()).toBe(true);
    expect(view.controller.getSnapshot().hasSaveError).toBe(false);
  });
  it("超过10MiB只读，禁止编辑与保存；dispose隔离迟到load", async () => {
    const view = create("large");
    view.read.mockResolvedValueOnce({
      content: "large",
      mtimeMs: 1,
      sizeBytes: MAX_EDITABLE_FILE_BYTES + 1,
    });
    await view.controller.load();
    view.controller.edit("overwrite");
    expect(view.controller.getContent()).toBe("large");
    expect(await view.controller.save()).toBe(false);
    expect(view.write).not.toHaveBeenCalled();
    const next = create();
    let finish!: (s: TextFileSnapshot) => void;
    next.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const loading = next.controller.load();
    next.controller.dispose();
    finish({ content: "late", mtimeMs: 1, sizeBytes: 4 });
    await loading;
    expect(next.controller.getSnapshot().loadState).toBe("loading");
  });
  it("卸载前保存当前草稿，显式discard不写入", async () => {
    const view = create("base");
    await view.controller.load();
    view.controller.edit("local");
    view.controller.dispose();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.disk().content).toBe("local");
    const discard = create("base");
    await discard.controller.load();
    discard.controller.edit("discard");
    discard.controller.discard();
    expect(discard.write).not.toHaveBeenCalled();
    expect(discard.controller.getDraft()).toBeNull();
  });
});
