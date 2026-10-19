import { describe, expect, it, vi } from "vitest";
import { readFilePreview } from "@/lib/api/fileBrowser";
import {
  buildKnowledgeImportDraft,
  readKnowledgeTextSourceFromPath,
} from "./knowledgeSourceImport";

vi.mock("@/lib/api/fileBrowser", () => ({
  readFilePreview: vi.fn(),
}));

describe("knowledgeSourceImport", () => {
  it("文件读取失败必须保留错误，不按路径生成模拟资料", async () => {
    vi.mocked(readFilePreview).mockRejectedValueOnce(
      new Error("No such file or directory"),
    );

    await expect(
      readKnowledgeTextSourceFromPath({
        name: "brief.md",
        path: "/Users/mock/brief.md",
        isDir: false,
        mimeType: "text/markdown",
      }),
    ).rejects.toThrow("No such file or directory");
  });

  it("读取结果中的错误也不能生成模拟资料", async () => {
    vi.mocked(readFilePreview).mockResolvedValueOnce({
      path: "/Users/mock/brief.md",
      size: 0,
      error: "Read denied",
      content: "",
      isBinary: false,
    });
    await expect(
      readKnowledgeTextSourceFromPath({
        name: "brief.md",
        path: "/Users/mock/brief.md",
        isDir: false,
        mimeType: "text/markdown",
      }),
    ).rejects.toThrow("Read denied");
  });

  it("成功时只返回实际读取的内容", async () => {
    vi.mocked(readFilePreview).mockResolvedValueOnce({
      path: "/workspace/brief.md",
      size: new TextEncoder().encode("# 实际资料").length,
      content: "# 实际资料",
      isBinary: false,
      error: null,
    });
    await expect(
      readKnowledgeTextSourceFromPath({
        name: "brief.md",
        path: "/workspace/brief.md",
        isDir: false,
        mimeType: "text/markdown",
      }),
    ).resolves.toEqual({ sourceName: "brief.md", sourceText: "# 实际资料" });
  });

  it("应识别运营类资料类型", () => {
    expect(
      buildKnowledgeImportDraft({
        sourceName: "内容日历.md",
        sourceText: "公众号和短视频选题节奏，每周复盘一次。",
      }).packType,
    ).toBe("content-operations");
    expect(
      buildKnowledgeImportDraft({
        sourceName: "私域SOP.md",
        sourceText: "会员群触达、私聊转化和社群运营话术。",
      }).packType,
    ).toBe("private-domain-operations");
    expect(
      buildKnowledgeImportDraft({
        sourceName: "直播排期.md",
        sourceText: "主播开场、场控提醒和带货复盘指标。",
      }).packType,
    ).toBe("live-commerce-operations");
    expect(
      buildKnowledgeImportDraft({
        sourceName: "活动方案.md",
        sourceText: "沙龙活动节奏、物料清单和会务风险预案。",
      }).packType,
    ).toBe("campaign-operations");
  });
});
