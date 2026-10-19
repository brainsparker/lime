import { describe, expect, it } from "vitest";
import { loadNamespaceResource } from "../loadNamespace";

describe("文件预览动作五语言", () => {
  it.each([
    ["zh-CN", "打开", "打开选项", "在文件夹中打开", "另存为…"],
    ["zh-TW", "開啟", "開啟選項", "在資料夾中開啟", "另存新檔…"],
    ["en-US", "Open", "Open options", "Open in folder", "Save as…"],
    ["ja-JP", "開く", "開くオプション", "フォルダーで開く", "名前を付けて保存…"],
    ["ko-KR", "열기", "열기 옵션", "폴더에서 열기", "다른 이름으로 저장…"],
  ])("%s覆盖当前工具栏及菜单", (locale, ...labels) => {
    const resource = loadNamespaceResource(locale, "workspace");
    expect(
      ["open", "openOptions", "openInFolder", "saveAs"].map(
        (key) => resource[`workspace.artifactPreviewHeader.${key}`],
      ),
    ).toEqual(labels);
  });
});
