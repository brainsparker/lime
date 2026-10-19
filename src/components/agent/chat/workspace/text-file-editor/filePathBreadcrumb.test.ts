import { afterEach, describe, expect, it } from "vitest";
import {
  getFilePathBreadcrumb,
  getSelectedBreadcrumbText,
  joinFileBreadcrumbPath,
} from "./filePathBreadcrumb";

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe("文件路径投影", () => {
  it("POSIX显示工作区名并为目录和文件提供父目录映射", () => {
    expect(
      getFilePathBreadcrumb({
        path: "/work/lime/src/one.ts",
        workspaceRoot: "/work/lime",
      }),
    ).toEqual({
      displayPath: "lime/src/one.ts",
      segments: ["lime", "src", "one.ts"],
      targets: [
        { activePath: null, directoryPath: null },
        { activePath: "src", directoryPath: null },
        { activePath: "src/one.ts", directoryPath: "src" },
      ],
    });
  });
  it("cwd优先显示子目录名，菜单仍映射到workspaceRoot", () => {
    expect(
      getFilePathBreadcrumb({
        path: "/work/lime/src/one.ts",
        cwd: "/work/lime/src",
        workspaceRoot: "/work/lime",
      }),
    ).toEqual({
      displayPath: "src/one.ts",
      segments: ["src", "one.ts"],
      targets: [
        { activePath: "src", directoryPath: null },
        { activePath: "src/one.ts", directoryPath: "src" },
      ],
    });
  });
  it("相对路径保留工作区标签，cwd不匹配时不伪造目录", () => {
    expect(
      getFilePathBreadcrumb({ path: "src/one.ts", workspaceRoot: "/work/lime" })
        .displayPath,
    ).toBe("lime/src/one.ts");
    expect(
      getFilePathBreadcrumb({
        path: "src/one.ts",
        cwd: "/work/other",
        workspaceRoot: "/work/lime",
      }).targets,
    ).toEqual([
      undefined,
      { activePath: "src", directoryPath: null },
      { activePath: "src/one.ts", directoryPath: "src" },
    ]);
  });
  it.each([
    ["C:\\Work\\Lime", "c:\\work\\lime\\Src\\One.ts"],
    ["\\\\server\\share\\Lime", "\\\\SERVER\\share\\lime\\Src\\One.ts"],
    ["C:\\Work\\Lime", "/C:/Work/Lime/Src/One.ts"],
    ["\\\\?\\C:\\Work\\Lime", "\\\\?\\C:\\Work\\Lime\\Src\\One.ts"],
  ])("Windows路径%s与%s比较大小写并保留文件实际路径", (workspaceRoot, path) => {
    const result = getFilePathBreadcrumb({ path, workspaceRoot });
    expect(result.targets?.at(-1)).toEqual({
      activePath: "Src/One.ts",
      directoryPath: "Src",
    });
    expect(
      joinFileBreadcrumbPath(workspaceRoot, result.targets!.at(-1)!.activePath),
    ).toBe(`${workspaceRoot}\\Src\\One.ts`);
  });
  it("WSL Linux后缀大小写不折叠，mnt挂载盘折叠", () => {
    const workspaceRoot = "//wsl.localhost/Ubuntu/home/user/Lime";
    expect(
      getFilePathBreadcrumb({
        workspaceRoot,
        cwd: "//wsl.localhost/Ubuntu/home/user/lime",
        path: "//wsl.localhost/Ubuntu/home/user/lime/Src/One.ts",
      }).targets?.[0],
    ).toBeUndefined();
    expect(
      getFilePathBreadcrumb({
        workspaceRoot: "//wsl$/Ubuntu/mnt/c/Work/Lime",
        cwd: "//wsl$/Ubuntu/mnt/c/work/lime",
        path: "//wsl$/Ubuntu/mnt/c/work/lime/Src/One.ts",
      }).targets?.[0],
    ).toEqual({ activePath: null, directoryPath: null });
  });
  it("跨工作区、前缀碰撞、根路径和空路径不能获得伪目录菜单", () => {
    for (const path of [
      "/other/lime/src/one.ts",
      "/work/lime-copy/src/one.ts",
      "/work/lime",
      "",
    ]) {
      expect(
        getFilePathBreadcrumb({ path, workspaceRoot: "/work/lime" }).targets,
      ).toBeNull();
    }
    expect(
      getFilePathBreadcrumb({ path: "/file.ts", workspaceRoot: "/" }).targets,
    ).toBeNull();
    expect(getFilePathBreadcrumb({ path: "/file.ts" })).toEqual({
      displayPath: "/file.ts",
      segments: ["file.ts"],
      targets: null,
    });
  });
  it("复制整段以/连接，局部文本保持选区，外部选区不劫持", () => {
    const list = document.createElement("ol");
    list.innerHTML = "<li>lime</li><li>src</li><li>file.ts</li>";
    document.body.appendChild(list);
    const range = document.createRange();
    range.selectNodeContents(list);
    const selection = document.getSelection()!;
    selection.addRange(range);
    expect(getSelectedBreadcrumbText(list)).toBe("lime/src/file.ts");
    selection.removeAllRanges();
    range.setStart(list.lastElementChild!.firstChild!, 0);
    range.setEnd(list.lastElementChild!.firstChild!, 4);
    selection.addRange(range);
    expect(getSelectedBreadcrumbText(list)).toBe("file");
    selection.removeAllRanges();
    range.selectNodeContents(document.body);
    selection.addRange(range);
    expect(getSelectedBreadcrumbText(list)).toBeNull();
  });
});
