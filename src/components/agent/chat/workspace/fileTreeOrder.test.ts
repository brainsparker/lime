import { describe, expect, it } from "vitest";
import { sortFileTreeEntries } from "./fileTreeOrder";

const file = (name: string) => ({ name, isDir: false });
const directory = (name: string) => ({ name, isDir: true });

describe("文件树排序", () => {
  it("目录在前，文件按自然名称排序，不保留Markdown或内容包优先级", () => {
    const input = [
      file("index.md"),
      file("manifest.json"),
      directory("skills"),
      file("Agents.md"),
      directory("assets"),
      file("cover.png"),
      file("chapter.md"),
      directory("z-dir"),
      directory("images"),
    ];
    const original = [...input];
    const result = sortFileTreeEntries(input);
    expect(result.map((entry) => entry.name)).toEqual([
      "assets",
      "images",
      "skills",
      "z-dir",
      "Agents.md",
      "chapter.md",
      "cover.png",
      "index.md",
      "manifest.json",
    ]);
    expect(input).toEqual(original);
    expect(result).not.toBe(input);
    expect(result[0]).toBe(input[4]);
  });
  it("数字片段按数值顺序，数值相同用完整名称确定顺序", () => {
    expect(
      sortFileTreeEntries(
        [
          "file10.ts",
          "file2.ts",
          "file02.ts",
          "file1.ts",
          "file2a10.ts",
          "file2a2.ts",
        ].map(file),
      ).map((entry) => entry.name),
    ).toEqual([
      "file1.ts",
      "file02.ts",
      "file2.ts",
      "file2a2.ts",
      "file2a10.ts",
      "file10.ts",
    ]);
  });
  it("大小写、空名称及Unicode使用稳定代码单元比较", () => {
    expect(
      sortFileTreeEntries(
        ["文档.ts", "b.ts", "中.ts", "a.ts", "A.ts", ".env", ""].map(file),
      ).map((entry) => entry.name),
    ).toEqual(["", ".env", "A.ts", "a.ts", "b.ts", "中.ts", "文档.ts"]);
  });
  it("同名目录在前，同名文件保持身份及原顺序", () => {
    const first = { ...file("same"), id: 1 };
    const second = { ...file("same"), id: 2 };
    const folder = { ...directory("same"), id: 3 };
    expect(sortFileTreeEntries([first, second, folder])).toEqual([
      folder,
      first,
      second,
    ]);
  });
});
