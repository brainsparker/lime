import { describe, expect, it } from "vitest";
import type { ProjectFileSearchResult } from "@/lib/api/fuzzyFileSearch";
import {
  createSearchFileTree,
  getDirectoryTreeRows,
  getSearchFileTreeRows,
} from "./fileTreeRows";

const hit = (path: string, root = "/work"): ProjectFileSearchResult => ({
  root,
  path,
  file_name: path.split(/[\\/]/).at(-1)!,
  match_type: "file",
  score: 1,
});

describe("FileTree 视图行投影", () => {
  it("目录保留同一缓存的层级、排序、loading/error/empty，不修改输入", () => {
    const directoryCache = {
      "/work": {
        path: "/work",
        parentPath: null,
        error: null,
        entries: [
          {
            name: "file10.ts",
            path: "/work/file10.ts",
            isDir: false,
            size: 0,
            modifiedAt: 0,
          },
          {
            name: "src",
            path: "/work/src",
            isDir: true,
            size: 0,
            modifiedAt: 0,
          },
          {
            name: "empty",
            path: "/work/empty",
            isDir: true,
            size: 0,
            modifiedAt: 0,
          },
          {
            name: "file2.ts",
            path: "/work/file2.ts",
            isDir: false,
            size: 0,
            modifiedAt: 0,
          },
          {
            name: "pending",
            path: "/work/pending",
            isDir: true,
            size: 0,
            modifiedAt: 0,
          },
        ],
      },
      "/work/src": {
        path: "/work/src",
        parentPath: "/work",
        error: "denied",
        entries: [],
      },
      "/work/empty": {
        path: "/work/empty",
        parentPath: "/work",
        error: null,
        entries: [],
      },
    };
    const before = JSON.stringify(directoryCache);
    const rows = getDirectoryTreeRows(
      "/work",
      directoryCache,
      { "/work/pending": true },
      {
        "/work/src": true,
        "/work/empty": true,
        "/work/pending": true,
      },
    );
    expect(
      rows.map((row) => (row.kind === "entry" ? row.entry.name : row.kind)),
    ).toEqual([
      "empty",
      "empty",
      "pending",
      "loading",
      "src",
      "error",
      "file2.ts",
      "file10.ts",
    ]);
    expect(
      rows.find((row) => row.kind === "entry" && row.entry.name === "pending"),
    ).toMatchObject({ loading: true, depth: 0, position: 1, setSize: 5 });
    expect(JSON.stringify(directoryCache)).toBe(before);
  });

  it("命中去重，目录祖先初始展开，只合并单目录链并沿同一自然排序", () => {
    const tree = createSearchFileTree("/work", [
      hit("src/components/file10.ts"),
      hit("src/components/file2.ts"),
      hit("src/components/file2.ts"),
      hit("z.ts"),
    ]);
    const rows = getSearchFileTreeRows(tree, tree.expandedDirectories);
    expect(rows.map((row) => row.kind === "entry" && row.entry.name)).toEqual([
      "src/components",
      "file2.ts",
      "file10.ts",
      "z.ts",
    ]);
    expect(rows[0]).toMatchObject({
      entry: { path: "/work/src/components", isDir: true },
      depth: 0,
      setSize: 2,
    });
    expect(rows[1]).toMatchObject({
      parentPath: "/work/src/components",
      depth: 1,
      position: 0,
      setSize: 2,
    });
    expect(getSearchFileTreeRows(tree, {})).toHaveLength(2);
  });

  it("分叉目录与包含文件的父目录不被错误合并，同名叶子保持不同身份", () => {
    const tree = createSearchFileTree("/work", [
      hit("src/a/index.ts"),
      hit("src/b/index.ts"),
      hit("src/root.ts"),
    ]);
    const rows = getSearchFileTreeRows(tree, tree.expandedDirectories);
    expect(rows.map((row) => row.kind === "entry" && row.entry.name)).toEqual([
      "src",
      "a",
      "index.ts",
      "b",
      "index.ts",
      "root.ts",
    ]);
    const leaves = rows.filter(
      (row) => row.kind === "entry" && row.entry.name === "index.ts",
    );
    expect(leaves.map((row) => row.kind === "entry" && row.entry.path)).toEqual(
      ["/work/src/a/index.ts", "/work/src/b/index.ts"],
    );
  });

  it("绝对路径不再次拼 root，Windows/UNC 操作路径保持原值", () => {
    const paths = ["C:\\work\\src\\one.ts", "\\\\server\\share\\src\\two.ts"];
    const tree = createSearchFileTree("C:\\work", [
      hit(paths[0], "C:\\work"),
      hit(paths[1], "\\\\server\\share"),
    ]);
    const leaves = getSearchFileTreeRows(tree, tree.expandedDirectories).filter(
      (row) => row.kind === "entry" && !row.entry.isDir,
    );
    expect(leaves.map((row) => row.kind === "entry" && row.entry.path)).toEqual(
      paths,
    );
  });

  it("空命中不制造目录、文件或网络读取结果", () => {
    const tree = createSearchFileTree("/work", []);
    expect(tree.children.size).toBe(0);
    expect(tree.expandedDirectories).toEqual({});
    expect(getSearchFileTreeRows(tree, {})).toEqual([]);
  });

  it("POSIX 根工作区的临时祖先保留绝对路径，不生成相对目录身份", () => {
    const tree = createSearchFileTree("/", [
      hit("/src/one.ts", "/"),
      hit("src/two.ts", "/"),
    ]);
    expect(getSearchFileTreeRows(tree, tree.expandedDirectories)).toMatchObject(
      [
        { entry: { name: "src", path: "/src" }, parentPath: "/", depth: 0 },
        {
          entry: { name: "one.ts", path: "/src/one.ts" },
          parentPath: "/src",
          depth: 1,
        },
        {
          entry: { name: "two.ts", path: "/src/two.ts" },
          parentPath: "/src",
          depth: 1,
        },
      ],
    );
  });
});
