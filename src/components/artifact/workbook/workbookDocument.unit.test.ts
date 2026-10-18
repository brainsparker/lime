import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importWorkbook, parseDelimitedWorkbook } from "./workbookDocument";
import { cellAddress, parseCellAddress, parseCellRange } from "./workbookRange";

describe("工作表原字节解码与只读投影", () => {
  it("读取独立编写的 XLSX，保留缓存值、格式、合并、尺寸与可见工作表", async () => {
    const bytes = readFileSync(
      "src/components/artifact/workbook/__fixtures__/review.xlsx",
    );
    const sheets = await importWorkbook(bytes, "xlsx");
    expect(sheets.map((sheet) => sheet.name)).toEqual(["预算", "明细"]);
    expect(sheets[0]).toMatchObject({
      rowCount: 1200,
      columnCount: 30,
      rowHeights: { 1: 48, 5: 0 },
      columnWidths: { 1: 173, 2: 131, 4: 0 },
    });
    expect(sheets[0].cells.A1).toMatchObject({
      text: "年度预算",
      style: {
        fontWeight: 700,
        color: "#2563EB",
        backgroundColor: "#FDE68A",
        textAlign: "center",
        whiteSpace: "pre-wrap",
      },
    });
    expect(sheets[0].cells.B2.text).toBe("$1,234.50");
    expect(sheets[0].cells.B4).toMatchObject({
      formula: "SUM(B2:B3)",
      raw: "1484.5",
      text: "$1,484.50",
    });
    expect(sheets[1].cells.B1).toMatchObject({
      formula: "1+1",
      raw: "7",
      text: "7",
    });
    expect(sheets[0].cells.B6.text).toBe("01-01-24");
    expect(sheets[0].cells.AD1200.text).toBe("远端单元格");
    expect(sheets[0].cells.A6.text).toBe("<img src=x onerror=alert(1)>");
    expect(sheets[0].merges).toEqual([
      { start: { row: 1, column: 1 }, end: { row: 1, column: 3 } },
    ]);
    expect(sheets[0].cells.B1).toBeUndefined();
  });

  it("CSV 的引号、换行、空字段、BOM 与公式样文本保持原值", () => {
    const [sheet] = parseDelimitedWorkbook(
      '\uFEFF名称,备注,编号\r\n"a,b","第一行\n第二行",0012\r\n"a""b",=1+1,\r\n',
      ",",
    );
    expect(sheet.cells.A2.text).toBe("a,b");
    expect(sheet.cells.B2.text).toBe("第一行\n第二行");
    expect(sheet.cells.C2.raw).toBe("0012");
    expect(sheet.cells.A3.text).toBe('a"b');
    expect(sheet.cells.B3).toEqual({ text: "=1+1", raw: "=1+1", style: {} });
    expect(sheet.cells.C3).toBeUndefined();
  });

  it("TSV 不把逗号当成列，UTF16 BOM 可以读取", async () => {
    const input = "\uFEFF名\t值\r\n数据,一\t002";
    const bytes = new Uint8Array(input.length * 2);
    for (let i = 0; i < input.length; i++) {
      bytes[i * 2] = input.charCodeAt(i) & 255;
      bytes[i * 2 + 1] = input.charCodeAt(i) >> 8;
    }
    const [sheet] = await importWorkbook(bytes, "tsv");
    expect(sheet.cells.A2.text).toBe("数据,一");
    expect(sheet.cells.B2.text).toBe("002");
  });

  it.each(['"unclosed', 'a"b,c', '"a"x,b'])(
    "损坏的分隔文本拒绝静默截断：%s",
    (input) => {
      expect(() => parseDelimitedWorkbook(input, ",")).toThrow("invalid");
    },
  );

  it("损坏 XLSX、非法编码与超限输入保留明确失败", async () => {
    await expect(
      importWorkbook(new TextEncoder().encode("fake xlsx"), "xlsx"),
    ).rejects.toMatchObject({ reason: "invalid" });
    await expect(
      importWorkbook(Uint8Array.of(0xff, 0xff, 0xff), "csv"),
    ).rejects.toMatchObject({ reason: "invalid" });
    await expect(
      importWorkbook(new Uint8Array(20 * 1024 * 1024 + 1), "xlsx"),
    ).rejects.toMatchObject({ reason: "tooLarge" });
    expect(() => parseDelimitedWorkbook(",".repeat(1024), ",")).toThrow(
      "tooLarge",
    );
  });

  it("A1 定位支持多字母列和绝对引用，拒绝越界与倒置范围", () => {
    expect(parseCellAddress("$AD$1200")).toEqual({ row: 1200, column: 30 });
    expect(cellAddress({ row: 1048576, column: 16384 })).toBe("XFD1048576");
    for (const input of ["A0", "XFE1", "A1048577", "Sheet1!A1", "A1:B2"])
      expect(parseCellAddress(input)).toBeNull();
    expect(parseCellRange("C3:A1")).toBeNull();
  });
});
