import { describe, expect, it } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { prepareThreadGoalDraft } from "./threadGoalDraft";

describe("ThreadGoal draft projection", () => {
  it("从唯一文档去除 paste atom；正文同名占位符、代码块和文件 URI 保持原语义", () => {
    const controller = new ComposerController({
      editorDocument: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "/goal [paste] " },
              {
                type: "paste",
                attrs: { id: "p", placeholder: "[paste]", text: "real source" },
              },
              {
                type: "mention",
                attrs: {
                  id: "f",
                  kind: "file",
                  name: "file",
                  label: "@file",
                  path: "/work/file",
                },
              },
            ],
          },
          {
            type: "code_block",
            attrs: { language: "js" },
            content: [{ type: "text", text: "a\nb" }],
          },
        ],
      },
    });
    const before = controller.captureDraft();
    const result = prepareThreadGoalDraft(
      controller.submit("command"),
      "/goal".length,
    );
    expect(result).toEqual({
      objective: "[paste] [@file](/work/file)\n```js\na\nb\n```",
      pastedTextAttachments: [{ text: "real source" }],
      imageAttachments: [],
    });
    expect(controller.captureDraft()).toEqual(before);
  });

  it("plugin/app 资源链接降为 label，file/skill 链接继续保留", () => {
    const controller = new ComposerController();
    controller.insertMention({
      id: "p",
      kind: "plugin",
      name: "plug",
      label: "plug]name",
      path: "plugin://plug",
    });
    const end = controller.getDocument().text.length;
    controller.replaceRange({ start: end, end }, " ");
    controller.insertMention({
      id: "s",
      kind: "skill",
      name: "skill",
      label: "$skill",
      path: "/skills/skill.md",
    });
    expect(prepareThreadGoalDraft(controller.submit("command")).objective).toBe(
      "plug]name [$skill](/skills/skill.md)",
    );
  });

  it("图片沿 byte/data/local/url 身份投影，不依赖 preview URL", () => {
    const controller = new ComposerController({
      attachments: [
        { data: "AQID", mediaType: "image/png", previewUrl: "blob:temporary" },
        { data: "", mediaType: "image/png", sourcePath: "D:\\work\\a.png" },
        {
          data: "",
          mediaType: "image/png",
          sourceUri: "https://example.test/a",
        },
      ],
    });
    expect(
      prepareThreadGoalDraft(controller.submit("command")).imageAttachments,
    ).toEqual([
      { src: "data:image/png;base64,AQID" },
      { src: "D:\\work\\a.png", localPath: "D:\\work\\a.png" },
      { src: "https://example.test/a" },
    ]);
  });

  it("Plugin/App label 只还原参考允许的括号与反斜杠转义", () => {
    const controller = new ComposerController({
      text: "[a\\*b](plugin://p) [app\\]name](app://a)",
    });
    expect(prepareThreadGoalDraft(controller.submit("command")).objective).toBe(
      "a\\*b app]name",
    );
  });
});
