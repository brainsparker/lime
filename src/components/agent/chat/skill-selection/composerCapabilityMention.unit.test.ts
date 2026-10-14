import { describe, expect, it } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import type { Skill } from "@/lib/api/skills";
import { insertComposerPlugin, insertComposerSkill } from "./composerCapabilityMention";

const reviewSkill: Skill = {
  key: "review",
  name: "审阅",
  description: "审阅项目变更",
  directory: "review",
  installed: true,
  sourceKind: "other",
};

describe("composer capability mentions", () => {
  it.each([
    { prefix: "EN", offset: 2, from: 3, byteStart: 3 },
    { prefix: "中", offset: 1, from: 2, byteStart: 4 },
    { prefix: "😀", offset: 2, from: 3, byteStart: 5 },
  ])("在 $prefix 后插入技能，提交 UTF-8 范围与编辑 UTF-16 范围一致", ({ prefix, offset, from, byteStart }) => {
    const controller = new ComposerController({ text: `${prefix}尾` });
    insertComposerSkill(controller, reviewSkill, { start: offset, end: offset });

    expect(controller.getDocument()).toMatchObject({
      text: `${prefix} /review 尾`,
      mentionBindings: [{ id: "review", kind: "skill", from, to: from + 7 }],
      textElements: [{ byteRange: { start: byteStart, end: byteStart + 7 }, placeholder: "/review" }],
    });
    const receipt = controller.submit("start");
    expect(receipt.kind).toBe("accepted");
    expect(receipt.submission.inputMentions).toEqual([{ type: "skill", name: "审阅", path: "review/SKILL.md" }]);
    expect(receipt.submission.textElements).toEqual(controller.getDocument().textElements);
  });

  it.each([
    { directory: "review/", expected: "review/SKILL.md" },
    { directory: "/skills/审阅/SKILL.md", expected: "/skills/审阅/SKILL.md" },
    { directory: "C:\\skills\\review\\SKILL.md", expected: "C:\\skills\\review\\SKILL.md" },
  ])("技能路径 $directory 只指向一份 SKILL.md", ({ directory, expected }) => {
    const controller = new ComposerController();
    insertComposerSkill(controller, { ...reviewSkill, directory });
    expect(controller.submit("start").submission.inputMentions).toEqual([{ type: "skill", name: "审阅", path: expected }]);
  });

  it("优先使用本地安装路径，并防止重复选择同一技能", () => {
    const controller = new ComposerController({ text: "中文😀" });
    const skill = { ...reviewSkill, localDirectoryPath: "/local/审阅/" };
    insertComposerSkill(controller, skill);
    const selected = controller.getSnapshot();
    insertComposerSkill(controller, skill, { start: 0, end: 0 });
    expect(controller.getSnapshot()).toBe(selected);
    expect(controller.getDocument().mentionBindings).toHaveLength(1);
    expect(controller.submit("start").submission.inputMentions).toEqual([{ type: "skill", name: "审阅", path: "/local/审阅/SKILL.md" }]);
  });

  it("插件重复选择和技能 alias 不重复插入 atom 或 typed mention", () => {
    const controller = new ComposerController({ text: "中😀 report" });
    const plugin = { pluginId: "search", displayName: "检索", trigger: "@检索" };
    insertComposerPlugin(controller, plugin, undefined, { start: 0, end: 0 });
    const selected = controller.captureDraft();
    insertComposerPlugin(controller, plugin, { skillId: "lookup", title: "查询", trigger: "@查询" });
    expect(controller.captureDraft()).toEqual(selected);
    expect(selected.text).toBe("@检索 中😀 report");
    expect(selected.textElements).toEqual([{ byteRange: { start: 0, end: 7 }, placeholder: "@检索" }]);
    expect(controller.submit("start").submission.inputMentions).toEqual([{ type: "mention", name: "检索", path: "plugin://search" }]);
  });

  it("在文件与长 paste 周围插入技能时保留原 atom 及其 payload", () => {
    const controller = new ComposerController({ editorDocument: {
      type: "doc",
      content: [{ type: "paragraph", content: [
        { type: "mention", attrs: { id: "file", kind: "file", name: "brief", path: "/tmp/brief.md", label: "@brief" } },
        { type: "text", text: " 中" },
        { type: "paste", attrs: { id: "paste", placeholder: "[paste]", text: "原文😀\n下一行" } },
        { type: "text", text: "😀end" },
      ] }],
    } });
    const originalAtoms = controller.getDocument().editorDocument.content[0].content?.filter((node) => node.type !== "text");
    insertComposerSkill(controller, reviewSkill, { start: 8, end: 8 });
    const draft = controller.getDocument();
    expect(draft.text).toBe("@brief 中 /review [paste]😀end");
    expect(draft.editorDocument.content[0].content?.filter((node) => node.type === "paste" || (node.type === "mention" && node.attrs.kind === "file"))).toEqual(originalAtoms);
    expect(draft.pendingPastes).toEqual([{ placeholder: "[paste]", text: "原文😀\n下一行" }]);
    expect(controller.submit("start").submission).toMatchObject({
      text: "@brief 中 /review 原文😀\n下一行😀end",
      inputMentions: [
        { type: "mention", name: "brief", path: "/tmp/brief.md" },
        { type: "skill", name: "审阅", path: "review/SKILL.md" },
      ],
    });
  });
});
