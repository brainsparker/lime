import { describe, expect, it } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import {
  applyDictationTranscript,
  captureDictationDraft,
} from "./composerDictationDraft";

describe("composer dictation draft", () => {
  it("数字 revision 相同也拒绝来自另一 Controller 的 draft", () => {
    const owner = new ComposerController({ text: "old" });
    const replacement = new ComposerController({ text: "new" });
    const draft = captureDictationDraft(owner);
    const initial = replacement.getSnapshot();
    expect(owner.getSnapshot().revision).toBe(initial.revision);
    expect(applyDictationTranscript(replacement, draft, "迟到结果")).toBe(
      false,
    );
    expect(replacement.getSnapshot()).toBe(initial);
  });

  it("live 与 final 转录连续替换同一区间，保留前后正文", () => {
    const controller = new ComposerController({
      text: "leftOLDright",
      selectionStart: 4,
      selectionEnd: 7,
    });
    const draft = captureDictationDraft(controller);
    expect(applyDictationTranscript(controller, draft, " live ")).toBe(true);
    expect(controller.getDocument().text).toBe("left live right");
    expect(draft).toMatchObject({
      start: 4,
      end: 10,
      before: "left",
      after: "right",
    });

    expect(applyDictationTranscript(controller, draft, "最终😀")).toBe(true);
    expect(controller.getDocument().text).toBe("left 最终😀 right");
    expect(controller.getDocument().selectionEnd).toBe(10);
    expect(draft.revision).toBe(controller.getSnapshot().revision);
    expect(controller.getDocument().text).not.toContain("live");
  });

  it("中英与 emoji 前缀按 UTF-16 选择范围写入，不拆分码点", () => {
    const controller = new ComposerController({
      text: "中😀 EN old 尾",
      selectionStart: 7,
      selectionEnd: 10,
    });
    const draft = captureDictationDraft(controller);
    expect(applyDictationTranscript(controller, draft, "新😀")).toBe(true);
    expect(controller.getDocument().text).toBe("中😀 EN 新😀 尾");
    expect(controller.getDocument().selectionEnd).toBe(10);
  });

  it("转录不拍平周围 atom，也不丢附件、路径或 paste 原文", () => {
    const attachments = [{ data: "image", mediaType: "image/png" }];
    const pathReferences = [
      { id: "file", name: "brief", path: "/tmp/brief.md", isDir: false },
    ];
    const controller = new ComposerController({
      attachments,
      pathReferences,
      editorDocument: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "mention",
                attrs: {
                  id: "file",
                  kind: "file",
                  name: "brief",
                  path: "/tmp/brief.md",
                  label: "@brief",
                },
              },
              { type: "text", text: " replace " },
              {
                type: "mention",
                attrs: {
                  id: "skill",
                  kind: "skill",
                  name: "review",
                  path: "/skills/review/SKILL.md",
                  label: "/review",
                },
              },
              {
                type: "paste",
                attrs: {
                  id: "paste",
                  placeholder: "[paste]",
                  text: "中文😀\nlong payload",
                },
              },
            ],
          },
        ],
      },
      selectionStart: 7,
      selectionEnd: 14,
    });
    const initial = controller.captureDraft();
    const atoms = initial.editorDocument.content[0].content?.filter(
      (node) => node.type !== "text",
    );
    const draft = captureDictationDraft(controller);
    expect(applyDictationTranscript(controller, draft, "实时中文")).toBe(true);
    expect(applyDictationTranscript(controller, draft, "final 😀")).toBe(true);
    const restored = controller.captureDraft();
    expect(restored.text).toBe("@brief final 😀 /review[paste]");
    expect(
      restored.editorDocument.content[0].content?.filter(
        (node) => node.type !== "text",
      ),
    ).toEqual(atoms);
    expect(restored.attachments).toEqual(attachments);
    expect(restored.pathReferences).toEqual(pathReferences);
    expect(restored.pendingPastes).toEqual(initial.pendingPastes);
    expect(controller.submit("start").submission.inputMentions).toEqual([
      { type: "mention", name: "brief", path: "/tmp/brief.md" },
      { type: "skill", name: "review", path: "/skills/review/SKILL.md" },
    ]);
  });

  it.each([
    {
      name: "用户改写",
      change: (controller: ComposerController) =>
        controller.setText("用户的新输入😀"),
    },
    {
      name: "新附件",
      change: (controller: ComposerController) =>
        controller.setAttachments([
          { data: "new-image", mediaType: "image/png" },
        ]),
    },
    {
      name: "新路径",
      change: (controller: ComposerController) =>
        controller.setPathReferences([
          { id: "new", name: "new", path: "/tmp/new.md", isDir: false },
        ]),
    },
    {
      name: "同文恢复",
      change: (controller: ComposerController) =>
        controller.restoreDraft(controller.captureDraft()),
    },
    {
      name: "清空草稿",
      change: (controller: ComposerController) => controller.clear(),
    },
  ])("$name 改变 revision 后拒绝迟到转录，完整新草稿保持不变", ({ change }) => {
    const controller = new ComposerController({
      text: "原草稿",
      selectionStart: 3,
    });
    const draft = captureDictationDraft(controller);
    expect(applyDictationTranscript(controller, draft, "live")).toBe(true);
    change(controller);
    const current = controller.getSnapshot();
    expect(applyDictationTranscript(controller, draft, "迟到 final😀")).toBe(
      false,
    );
    expect(controller.getSnapshot()).toBe(current);
  });

  it("空转录不修改文档或消耗草稿 revision，后续结果仍可应用", () => {
    const controller = new ComposerController({ text: "已有 " });
    const draft = captureDictationDraft(controller);
    const initial = controller.getSnapshot();
    expect(applyDictationTranscript(controller, draft, " \n ")).toBe(false);
    expect(controller.getSnapshot()).toBe(initial);
    expect(applyDictationTranscript(controller, draft, "结果😀")).toBe(true);
    expect(controller.getDocument().text).toBe("已有 结果😀");
  });
});
