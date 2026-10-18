import { describe, expect, it } from "vitest";
import { copyWorkbookRange, pasteWorkbookRange } from "./workbookClipboard";
import { parseCellRange } from "./workbookRange";
import type { WorkbookSnapshot } from "./workbookSnapshot";

const range = (value: string) => parseCellRange(value)!;
function document(): WorkbookSnapshot {
  return {
    sourceSha256: "a".repeat(64),
    sheets: [
      {
        id: "1",
        name: "Clipboard",
        rowCount: 30,
        columnCount: 10,
        rowHeights: { 2: 0 },
        columnWidths: { 2: 0 },
        merges: [],
        cells: {
          A1: { text: '  中文\t"引号"\r\n日本語  ', raw: "raw", style: {} },
          B1: { text: "7", raw: "7", formula: "1+1", style: {} },
          C1: { text: "", raw: "", formula: "2+2", style: {} },
          A2: { text: "繁體 한국어 ", raw: "raw", style: {} },
          B2: { text: "=literal", raw: "raw", style: {} },
        },
      },
    ],
  };
}

describe("Workbook 矩形纯文本剪贴板", () => {
  it("显示缓存、隐藏格、多语言、引号换行和尾空字段无损往返，不求值公式", () => {
    const source = document();
    const payload = copyWorkbookRange(source.sheets[0], range("A1:C2"));
    expect(payload).toEqual({
      plainText:
        '"  中文\t""引号""\r\n日本語  "\t7\t""\n繁體 한국어 \t=literal\t""',
    });
    const result = pasteWorkbookRange(source, "1", range("D5:E7"), payload!);
    expect(result?.range).toEqual(range("D5:F6"));
    expect(result?.edits.map(({ address, value }) => [address, value])).toEqual(
      [
        ["D5", '  中文\t"引号"\r\n日本語  '],
        ["E5", "7"],
        ["F5", ""],
        ["D6", "繁體 한국어 "],
        ["E6", "=literal"],
        ["F6", ""],
      ],
    );
    expect(source.sheets[0].cells.B1.formula).toBe("1+1");
  });

  it("全空末行、单空格及清除单格保持尺寸；不平铺到原选区", () => {
    const source = document();
    const payload = copyWorkbookRange(source.sheets[0], range("I29:J30"))!;
    expect(payload.plainText).toBe('""\t""\n""\t""');
    expect(
      pasteWorkbookRange(source, "1", range("A3"), payload)?.edits,
    ).toHaveLength(4);
    expect(
      pasteWorkbookRange(source, "1", range("A3:C8"), { plainText: "" }),
    ).toEqual({
      range: range("A3"),
      edits: [{ sheetId: "1", address: "A3", value: "" }],
    });
    expect(
      pasteWorkbookRange(source, "1", range("A3"), {
        plainText: " \t  \r\n",
      })?.edits.map((edit) => edit.value),
    ).toEqual([" ", "  "]);
  });

  it("首 BOM 是剪贴板文本字符，不作为文件编码标记消费", () => {
    expect(
      pasteWorkbookRange(document(), "1", range("A3"), {
        plainText: "\uFEFFvalue\t=x",
      })?.edits.map((edit) => edit.value),
    ).toEqual(["\uFEFFvalue", "=x"]);
    expect(
      pasteWorkbookRange(document(), "1", range("A3"), { plainText: "\uFEFF" })
        ?.edits[0].value,
    ).toBe("\uFEFF");
  });

  it.each([
    "a\tb\nc",
    '"unterminated',
    '"closed"tail',
    "valid\tbad\u0000",
    "a".repeat(32768),
    "a\t".repeat(1024),
  ])("整批拒绝非法矩形或值（样本 %#）", (plainText) => {
    const source = document();
    expect(
      pasteWorkbookRange(source, "1", range("A3"), { plainText }),
    ).toBeNull();
    expect(Object.keys(source.sheets[0].cells)).toHaveLength(5);
  });

  it("按 UTF-8 字节拒绝大剪贴板，copy 同样受预算限制", () => {
    const source = document();
    expect(
      pasteWorkbookRange(source, "1", range("A3"), {
        plainText: "中".repeat(7 * 1024 * 1024),
      }),
    ).toBeNull();
    source.sheets[0].cells.A1.text = "x".repeat(20 * 1024 * 1024 + 1);
    expect(copyWorkbookRange(source.sheets[0], range("A1"))).toBeNull();
  });

  it.each(["J30", "A30", "J3"])("目标 %s 越界时零编辑", (address) => {
    expect(
      pasteWorkbookRange(document(), "1", range(address), {
        plainText: "a\tb\nc\td",
      }),
    ).toBeNull();
  });

  it("copy 和 paste 拒绝与任意 merged 相交的范围，非相交范围正常", () => {
    const source = document();
    source.sheets[0].merges = [range("B4:C5")];
    for (const value of ["B4", "A3:B4", "C5:D6"]) {
      expect(copyWorkbookRange(source.sheets[0], range(value))).toBeNull();
      expect(
        pasteWorkbookRange(source, "1", range(value), { plainText: "a" }),
      ).toBeNull();
    }
    expect(
      pasteWorkbookRange(source, "1", range("A4"), { plainText: "a\tb" }),
    ).toBeNull();
    expect(
      pasteWorkbookRange(source, "1", range("D4"), { plainText: "a\tb" }),
    ).not.toBeNull();
  });

  it("拒绝错误坐标及超过全工作簿 cell 预算的新地址；允许预算内覆盖", () => {
    const source = document();
    const invalid = {
      start: { row: 1.5, column: 1 },
      end: { row: 2, column: 1 },
    };
    expect(copyWorkbookRange(source.sheets[0], invalid)).toBeNull();
    expect(
      pasteWorkbookRange(source, "missing", range("A1"), { plainText: "a" }),
    ).toBeNull();
    source.sheets.push({
      ...source.sheets[0],
      id: "2",
      cells: Object.fromEntries(
        Array.from({ length: 99995 }, (_, i) => [
          `A${i + 1}`,
          { text: "x", raw: "x", style: {} },
        ]),
      ),
    });
    expect(
      pasteWorkbookRange(source, "1", range("D3"), { plainText: "a" }),
    ).toBeNull();
    expect(
      pasteWorkbookRange(source, "1", range("A1"), { plainText: "a" }),
    ).not.toBeNull();
  });
});
