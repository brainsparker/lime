import { describe, expect, it } from "vitest";
import { resolveInputCapabilityDispatchContext } from "./inputCapabilityRouting";
import type { ComposerSubmission } from "@/components/input-kit/types";
import { remapComposerSubmission } from "../utils/composerSubmission";

describe("inputCapabilityRouting", () => {
  it("Skill 路由保留完整发送正文与 UTF8 原子范围，展示文案只用于回放", () => {
    const text = "**中文😀** [链接](https://example.invalid)\n隐藏粘贴正文";
    const prefix = "**中文😀** [链接](https://example.invalid)\n";
    const submission: ComposerSubmission = {
      text,
      textElements: [
        {
          byteRange: {
            start: new TextEncoder().encode(prefix).length,
            end: new TextEncoder().encode(text).length,
          },
          placeholder: "[粘贴内容]",
        },
      ],
      inputMentions: [
        { type: "skill", name: "writer", path: "/skills/writer/SKILL.md" },
      ],
      attachments: [{ data: "durable-image", mediaType: "image/png" }],
      pathReferences: [
        { id: "file-1", path: "/tmp/ref.md", name: "ref.md", isDir: false },
      ],
    };
    const displayContent = "中文😀 链接 [粘贴内容]";
    const routed = resolveInputCapabilityDispatchContext({
      sourceText: submission.text,
      displayContent,
      capabilityRoute: {
        kind: "installed_skill",
        skillKey: "writer",
        skillName: "writer",
      },
    });
    const sent = remapComposerSubmission(submission, routed.sourceText);
    expect(sent.text).toBe(`/writer ${text}`);
    expect(sent.textElements[0].byteRange).toEqual({
      start: submission.textElements[0].byteRange.start + 8,
      end: submission.textElements[0].byteRange.end + 8,
    });
    expect(sent.attachments).toEqual(submission.attachments);
    expect(sent.pathReferences).toEqual(submission.pathReferences);
    expect(sent.inputMentions).toEqual(submission.inputMentions);
    expect(routed.completedSlashUsage?.replayText).toBe(displayContent);
    expect(submission.text).toBe(text);
  });

  it("已带 @配图 前缀的 builtin command route 不应重复拼接命令", () => {
    const context = resolveInputCapabilityDispatchContext({
      sourceText: "@配图 生成 一张春日咖啡馆插画",
      displayContent: "@配图 生成 一张春日咖啡馆插画",
      capabilityRoute: {
        kind: "builtin_command",
        commandKey: "image_generate",
        commandPrefix: "@配图",
      },
    });

    expect(context.sourceText).toBe("@配图 生成 一张春日咖啡馆插画");
    expect(context.capabilityRoute).toMatchObject({
      kind: "builtin_command",
      commandKey: "image_generate",
      commandPrefix: "@配图",
    });
    expect(context.completedSlashUsage).toBeNull();
  });

  it("本地 installed skill route 不应生成 /local:* slash 命令", () => {
    const context = resolveInputCapabilityDispatchContext({
      sourceText: "帮我写一篇关于三国的故事",
      displayContent: "帮我写一篇关于三国的故事",
      capabilityRoute: {
        kind: "installed_skill",
        skillKey: "local:brand-product-knowledge-builder",
        skillName: "brand-product-knowledge-builder",
      },
    });

    expect(context.sourceText).toBe(
      "/brand-product-knowledge-builder 帮我写一篇关于三国的故事",
    );
    expect(context.capabilityRoute).toMatchObject({
      kind: "installed_skill",
      skillKey: "brand-product-knowledge-builder",
      skillName: "brand-product-knowledge-builder",
    });
    expect(context.completedSlashUsage).toMatchObject({
      kind: "skill",
      entryId: "brand-product-knowledge-builder",
      replayText: "帮我写一篇关于三国的故事",
    });
  });
});
