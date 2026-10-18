import { describe, expect, it } from "vitest";
import { resolveThreadTitle } from "./threadTitle";

describe("thread title", () => {
  it("保留有效标题，过滤错误投影并还原附件显示名", () => {
    expect(resolveThreadTitle("  修复导航  ", "未命名")).toBe("修复导航");
    expect(resolveThreadTitle("Ran into this erro...", "未命名")).toBe("未命名");
    expect(resolveThreadTitle("[Image #4]", "未命名")).toBe("图片任务 4");
    expect(resolveThreadTitle("", "路由标题")).toBe("路由标题");
  });
});
