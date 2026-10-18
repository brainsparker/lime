import { describe, expect, it } from "vitest";
import {
  decodeDelimitedWorkbook,
  editDelimitedWorkbook,
  parseDelimitedRows,
} from "./delimitedWorkbook";

describe("CSV/TSV 原字段保存", () => {
  it("只改目标字段，保留原引号、BOM、CRLF、尾部换行与公式样文本", () => {
    const input = new TextEncoder().encode(
      '\uFEFF"id",value,empty\r\n001,"old",\r\n002,=1+1,\r\n',
    );
    const output = editDelimitedWorkbook(input, ",", [
      { sheetId: "delimited", address: "B2", value: 'new,"quoted"\nline' },
    ]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(output)).toBe(
      '\uFEFF"id",value,empty\r\n001,"new,""quoted""\nline",\r\n002,=1+1,\r\n',
    );
  });
  it.each(["utf-16le", "utf-16be"] as const)(
    "%s保留字节顺序与BOM",
    (encoding) => {
      const text = "名称\t编号\n原值\t002";
      const bytes = new Uint8Array((text.length + 1) * 2),
        view = new DataView(bytes.buffer);
      view.setUint16(0, 0xfeff, encoding === "utf-16le");
      for (let i = 0; i < text.length; i++)
        view.setUint16(
          (i + 1) * 2,
          text.charCodeAt(i),
          encoding === "utf-16le",
        );
      const output = editDelimitedWorkbook(bytes, "\t", [
        { sheetId: "delimited", address: "A2", value: "新值" },
      ]);
      expect(output.slice(0, 2)).toEqual(bytes.slice(0, 2));
      expect(decodeDelimitedWorkbook(output)).toMatchObject({
        text: "名称\t编号\n新值\t002",
        encoding,
      });
    },
  );
  it("新增行列不丢空字段，未修改的公式样CSV只作为字符串", () => {
    const output = editDelimitedWorkbook(
      new TextEncoder().encode("001,=1+1"),
      ",",
      [{ sheetId: "delimited", address: "C3", value: "=HYPERLINK(test)" }],
    );
    expect(new TextDecoder().decode(output)).toBe(
      "001,=1+1\n\n,,=HYPERLINK(test)",
    );
    expect(
      parseDelimitedRows(new TextDecoder().decode(output), ",")[2].fields[2]
        .value,
    ).toBe("=HYPERLINK(test)");
  });
  it("拒绝损坏编码与不闭合引号", () => {
    expect(() => decodeDelimitedWorkbook(new Uint8Array([255]))).toThrow();
    expect(() => parseDelimitedRows('"unclosed', ",")).toThrow();
    expect(() => parseDelimitedRows('"closed"invalid', ",")).toThrow();
  });
});
