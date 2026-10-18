import { describe, expect, it, vi } from "vitest";
import { ArtifactAnnotationDraftStore } from "./ArtifactAnnotationDraftStore";

const comment = (id = "note1") => ({
  format: "pdf" as const,
  id,
  path: "/workspace/report.pdf",
  sourceSha256: "a".repeat(64),
  pageNumber: 2,
  pageCount: 12,
  pageSize: { width: 600, height: 800 },
  anchor: { kind: "point" as const, point: { x: 100, y: 200 } },
});

describe("文档未提交批注 owner", () => {
  it("批次原子开始，缺失/重复/空稿/在途成员均不留下部分 pending", () => {
    const store = new ArtifactAnnotationDraftStore();
    store.create("session1", comment());
    store.create("session1", { ...comment("note2"), format: "docx" });
    store.getSnapshot()[0].controller.setText("第一条");
    expect(store.beginBatch(["note1", "missing"])).toBe(false);
    expect(store.beginBatch(["note1", "note1"])).toBe(false);
    expect(store.beginBatch(["note1", "note2"])).toBe(false);
    expect(store.getSnapshot().every((draft) => !draft.pending)).toBe(true);
    store.getSnapshot()[1].controller.setText("第二条");
    expect(store.beginBatch(["note1", "note2"])).toBe(true);
    expect(store.getSnapshot().every((draft) => draft.pending)).toBe(true);
    expect(store.beginBatch(["note1", "note2"])).toBe(false);
  });
  it("关闭视图保留 Controller、正文与坐标，同路径不同会话有独立草稿", () => {
    const store = new ArtifactAnnotationDraftStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.create("session1", comment());
    const first = store.getSnapshot()[0];
    first.controller.setText("保留正文");
    const before = store.getSnapshot();
    store.create("session2", comment("note2"));
    expect(
      store.getSnapshot().find((entry) => entry.scopeKey === "session1")
        ?.controller,
    ).toBe(first.controller);
    expect(first.controller.getDocument().text).toBe("保留正文");
    expect(first.comment.anchor).toEqual(comment().anchor);
    expect(before).toHaveLength(1);
    expect(store.getSnapshot()).toHaveLength(2);
    unsubscribe();
    const calls = listener.mock.calls.length;
    first.controller.setText("新的正文");
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it("失败保稿和错误，接受只移除已清空的那个 revision", () => {
    const store = new ArtifactAnnotationDraftStore();
    store.create("session1", comment());
    const controller = store.getSnapshot()[0].controller;
    expect(store.begin("note1")).toBe(false);
    controller.setText("正文");
    expect(store.begin("note1")).toBe(true);
    expect(store.begin("note1")).toBe(false);
    expect(store.remove("note1")).toBe(false);
    store.finish("note1", "file-changed");
    expect(store.getSnapshot()[0].failure).toBe("fileChanged");
    expect(controller.getDocument().text).toBe("正文");
    expect(store.begin("note1")).toBe(true);
    controller.setText("发送期间的新稿");
    expect(store.finish("note1", "accepted")).toBe(false);
    expect(controller.getDocument().text).toBe("发送期间的新稿");
    controller.setText("");
    expect(store.finish("note1", "accepted")).toBe(true);
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it("只有明确重新定位才更新版本和截图，保留正文并拒绝在途重定位", () => {
    const store = new ArtifactAnnotationDraftStore();
    store.create("session1", comment());
    const controller = store.getSnapshot()[0].controller;
    controller.setText("保留正文");
    const target = {
      ...comment(),
      sourceSha256: "b".repeat(64),
      pageNumber: 3,
      screenshot: {
        data: "iVBORw0KGgo=",
        mediaType: "image/png" as const,
        width: 100,
        height: 100,
      },
    };
    store.begin("note1");
    expect(store.reanchor("note1", target)).toBe(false);
    store.finish("note1", "file-changed");
    expect(store.reanchor("note1", target)).toBe(true);
    expect(store.getSnapshot()[0]).toMatchObject({
      failure: null,
      comment: {
        id: "note1",
        sourceSha256: target.sourceSha256,
        pageNumber: 3,
      },
    });
    expect(controller.getDocument().text).toBe("保留正文");
    expect(controller.getDocument().attachments).toEqual([target.screenshot]);
  });
});
