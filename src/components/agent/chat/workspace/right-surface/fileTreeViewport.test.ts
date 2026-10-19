import { describe, expect, it } from "vitest";
import {
  getFileTreeFocusScrollTop,
  getFileTreeViewport,
  indexFileTreeRows,
} from "./fileTreeViewport";

const file = (path: string, depth = 0) => ({ path, depth, isDirectory: false });
const directory = (path: string, depth = 0) => ({
  path,
  depth,
  isDirectory: true,
});

describe("目录树窗口投影", () => {
  it("大目录只投影可见行及前后10行，保持固定总高度", () => {
    const index = indexFileTreeRows(
      Array.from({ length: 10000 }, (_, i) => file(String(i))),
    );
    expect(getFileTreeViewport(index, 28000, 280, false)).toEqual({
      start: 990,
      end: 1019,
      scrollTop: 28000,
      totalHeight: 280000,
      stickyHeight: 0,
      stickyRows: [],
    });
    const bottom = getFileTreeViewport(index, 999999, 280, false);
    expect([bottom.start, bottom.end, bottom.scrollTop]).toEqual([
      9980, 9999, 279720,
    ]);
    expect(getFileTreeViewport(index, 0, 0, false).end).toBe(-1);
  });

  it("sticky父目录在子树末端被推出，切换到下一组且不覆盖无关行", () => {
    const index = indexFileTreeRows([
      directory("src"),
      directory("src/nested", 1),
      ...Array.from({ length: 8 }, (_, i) => file(`src/nested/${i}`, 2)),
      directory("tests"),
      ...Array.from({ length: 8 }, (_, i) => file(`tests/${i}`, 1)),
    ]);
    expect(index.parents.slice(0, 4)).toEqual([-1, 0, 1, 1]);
    expect(index.subtreeEnds.slice(0, 2)).toEqual([9, 9]);
    const middle = getFileTreeViewport(index, 112, 140, true);
    expect(middle.stickyRows).toEqual([
      { index: 0, top: 0 },
      { index: 1, top: 28 },
    ]);
    expect([middle.start, middle.stickyHeight]).toEqual([6, 56]);
    const boundary = getFileTreeViewport(index, 260, 140, true);
    expect(boundary.stickyRows).toEqual([
      { index: 0, top: -8 },
      { index: 1, top: -8 },
    ]);
    expect(getFileTreeViewport(index, 280, 140, true).stickyRows).toEqual([
      { index: 10, top: 0 },
    ]);
  });

  it("末尾目录可以保持sticky，空树不产生虚构行", () => {
    const index = indexFileTreeRows([
      directory("src"),
      ...Array.from({ length: 30 }, (_, i) => file(`src/${i}`, 1)),
    ]);
    expect(getFileTreeViewport(index, 100, 280, true).stickyRows).toEqual([
      { index: 0, top: 0 },
    ]);
    expect(
      getFileTreeViewport(indexFileTreeRows([]), 100, 280, true),
    ).toMatchObject({ start: 0, end: -1, totalHeight: 0, stickyRows: [] });
  });

  it("导航只在焦点超出可见区时滚动，并避开sticky遮挡和底部越界", () => {
    expect(getFileTreeFocusScrollTop(5, 112, 140, 2800, 28)).toBeNull();
    expect(getFileTreeFocusScrollTop(4, 112, 140, 2800, 28)).toBe(84);
    expect(getFileTreeFocusScrollTop(99, 0, 140, 2800, 28)).toBe(2660);
    expect(getFileTreeFocusScrollTop(-1, 0, 140, 0, 0)).toBeNull();
  });
});
