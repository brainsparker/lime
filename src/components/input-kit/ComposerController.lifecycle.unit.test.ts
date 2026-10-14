import { describe, expect, it, vi } from "vitest";
import { ComposerController } from "./ComposerController";

function createRichController() {
  const controller = new ComposerController({
    text: "中😀 ",
    attachments: [{ data: "image", mediaType: "image/png", metadata: { name: "截图" } }],
    pathReferences: [{ id: "brief", path: "/tmp/brief.md", name: "brief.md", isDir: false }],
    inputCapabilityRoute: { kind: "plugin", id: "search" },
  });
  controller.insertMention({ id: "review", kind: "skill", name: "review", path: "/skills/review/SKILL.md", label: "/review" });
  controller.ingestPaste("长文😀".repeat(300));
  controller.setSelection(0);
  return controller;
}

describe("ComposerController 草稿生命周期", () => {
  it("每次清空空草稿都重建编辑生命周期并推进 revision，旧空发送回执失效", () => {
    const controller = new ComposerController();
    const receipt = controller.submit("start", { allowEmpty: true });
    if (receipt.kind !== "accepted") throw new Error("expected accepted receipt");
    const listener = vi.fn();
    controller.subscribe(listener);

    for (let index = 0; index < 3; index += 1) {
      const previousState = controller.getEditorState();
      const previousSnapshot = controller.getSnapshot();
      controller.clear();
      expect(controller.getEditorState()).not.toBe(previousState);
      expect(controller.getEditorState().plugins).not.toBe(previousState.plugins);
      expect(controller.getSnapshot().revision).toBe(previousSnapshot.revision + 1);
      expect(controller.getSnapshot().lastIntent).toBe("clear");
      expect(controller.getDocument()).toMatchObject({
        text: "", attachments: [], pathReferences: [], pendingPastes: [], mentionBindings: [],
      });
      expect(controller.commit(receipt)).toBe(false);
    }
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("连续恢复同一 rich 草稿每次重建生命周期，完整 JSON 与资源不丢失", () => {
    const controller = createRichController();
    const draft = controller.captureDraft();
    const receipt = controller.submit("queue");
    if (receipt.kind !== "accepted") throw new Error("expected accepted receipt");
    const listener = vi.fn();
    controller.subscribe(listener);

    for (let index = 0; index < 3; index += 1) {
      const previousState = controller.getEditorState();
      const previousSnapshot = controller.getSnapshot();
      controller.restoreDraft(draft);
      expect(controller.getEditorState()).not.toBe(previousState);
      expect(controller.getEditorState().plugins).not.toBe(previousState.plugins);
      expect(controller.getSnapshot().revision).toBe(previousSnapshot.revision + 1);
      expect(controller.getSnapshot().lastIntent).toBe("edit");
      expect(controller.captureDraft()).toEqual(draft);
      expect(controller.getSnapshot().document.attachments).not.toBe(draft.attachments);
      expect(controller.commit(receipt)).toBe(false);
    }
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it.each(["setText", "replaceDocument"] as const)(
    "同值 %s 保持 state、revision 和 atom，不使有效发送回执失效",
    (operation) => {
      const controller = createRichController();
      const receipt = controller.submit("start");
      if (receipt.kind !== "accepted") throw new Error("expected accepted receipt");
      const previousSnapshot = controller.getSnapshot();
      const previousState = controller.getEditorState();
      const listener = vi.fn();
      controller.subscribe(listener);

      if (operation === "setText") controller.setText(previousSnapshot.document.text);
      else controller.replaceDocument(controller.captureDraft());

      expect(controller.getSnapshot()).toBe(previousSnapshot);
      expect(controller.getEditorState()).toBe(previousState);
      expect(controller.captureDraft()).toEqual(receipt.draft);
      expect(controller.getDocument().mentionBindings).toHaveLength(1);
      expect(controller.getDocument().pendingPastes).toHaveLength(1);
      expect(listener).not.toHaveBeenCalled();
      expect(controller.commit(receipt)).toBe(true);
    },
  );
});
