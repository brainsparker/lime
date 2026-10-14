import { describe, expect, it } from "vitest";
import {
  buildInputbarPluginMention,
  isCompleteInputbarPluginTriggerQuery,
  normalizeInputbarPluginTrigger,
  resolveInputbarPluginDisplayName,
} from "./pluginInputCapability";

describe("pluginInputCapability", () => {
  it("应从 canonical Plugin config name 构造结构化 mention", () => {
    expect(
      buildInputbarPluginMention({
        pluginId: "browser@openai-bundled",
        displayName: "Browser",
      }),
    ).toEqual({
      type: "mention",
      name: "Browser",
      path: "plugin://browser@openai-bundled",
    });
  });

  it("展示名称为空时应回退显示插件 id", () => {
    expect(
      resolveInputbarPluginDisplayName({
        pluginId: "content-workbench",
        displayName: " ",
      }),
    ).toBe("content-workbench");
  });

  it("应优先使用展示名称生成显式触发前缀", () => {
    expect(
      normalizeInputbarPluginTrigger({
        pluginId: "content-workbench",
        displayName: "内容工厂",
      }),
    ).toBe("@内容工厂");
  });

  it("选择插件技能时应生成 @插件:技能 触发前缀", () => {
    expect(
      normalizeInputbarPluginTrigger(
        {
          pluginId: "content-workbench",
          displayName: "内容工厂",
        },
        {
          skillId: "article-writer",
          title: "文章写作",
        },
      ),
    ).toBe("@内容工厂:文章写作");
  });

  it("插件技能声明显式触发词时应优先使用技能触发词", () => {
    expect(
      normalizeInputbarPluginTrigger(
        {
          pluginId: "content-factory-app",
          displayName: "内容工厂",
        },
        {
          skillId: "content_article_generate",
          title: "写文章",
          trigger: "@写文章",
        },
      ),
    ).toBe("@写文章");
  });

  it("插件声明显式触发词时应优先使用该触发词", () => {
    expect(
      normalizeInputbarPluginTrigger({
        pluginId: "content-factory-app",
        displayName: "写文章",
        trigger: "@写文章",
      }),
    ).toBe("@写文章");
  });

  it("应识别完整插件触发查询", () => {
    expect(
      isCompleteInputbarPluginTriggerQuery({
        query: "写文章",
        plugins: [
          {
            pluginId: "content-factory-app",
            displayName: "写文章",
            trigger: "@写文章",
          },
        ],
      }),
    ).toBe(true);
  });

  it("应识别完整插件技能触发查询", () => {
    expect(
      isCompleteInputbarPluginTriggerQuery({
        query: "内容工厂:文章写作",
        plugins: [
          {
            pluginId: "content-workbench",
            displayName: "内容工厂",
            skills: [
              {
                skillId: "article-writer",
                title: "文章写作",
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it("部分触发查询不应被当成完整插件触发词", () => {
    expect(
      isCompleteInputbarPluginTriggerQuery({
        query: "写",
        plugins: [
          {
            pluginId: "content-factory-app",
            displayName: "写文章",
            trigger: "@写文章",
          },
        ],
      }),
    ).toBe(false);
  });

  it("展示名称为空时应回退到插件 id", () => {
    expect(
      normalizeInputbarPluginTrigger({
        pluginId: "content-workbench",
        displayName: " ",
      }),
    ).toBe("@content-workbench");
  });
});
