import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  editWorkbookPackage,
  readWorkbookXml,
  workbookNamespace,
} from "./workbookPackage";
import { importWorkbook } from "./workbookDocument";

const original = () =>
  new Uint8Array(
    readFileSync("src/components/artifact/workbook/__fixtures__/review.xlsx"),
  );
const edit = { sheetId: "1", address: "B2", value: "42" };

describe("原 XLSX 包定点修改与 roundtrip", () => {
  it("真实导入重新读取改值、跨表与新单元格，保留样式和非目标包payload", async () => {
    const input = await JSZip.loadAsync(original());
    input.file("xl/media/unknown.bin", new Uint8Array([0, 255, 18, 19]));
    input.file(
      "customXml/item1.xml",
      '<unknown xmlns="urn:test"><value>keep me</value></unknown>',
    );
    const bytes = await input.generateAsync({ type: "uint8array" });
    const result = await editWorkbookPackage(bytes, [
      edit,
      { sheetId: "2", address: "C3", value: '中文 <tag> & "quoted"' },
      { sheetId: "1", address: "AD1200", value: "001" },
    ]);
    const after = await JSZip.loadAsync(result);
    for (const [name, entry] of Object.entries(input.files)) {
      if (
        entry.dir ||
        [
          "xl/worksheets/sheet1.xml",
          "xl/worksheets/sheet2.xml",
          "xl/workbook.xml",
          "xl/_rels/workbook.xml.rels",
          "[Content_Types].xml",
        ].includes(name)
      )
        continue;
      expect(await after.file(name)!.async("uint8array"), name).toEqual(
        await entry.async("uint8array"),
      );
    }
    const sheets = await importWorkbook(result, "xlsx");
    expect(sheets[0].cells.B2.raw).toBe("42");
    expect(sheets[0].cells.A1.style.backgroundColor).toBe("#FDE68A");
    expect(sheets[0].merges).toHaveLength(1);
    expect(sheets[0].cells.AD1200.raw).toBe("001");
    expect(sheets[1].cells.C3.raw).toBe('中文 <tag> & "quoted"');
  });

  it("输入修改后清除所有公式缓存并请求重新计算，不保留过期calcChain", async () => {
    const zip = await JSZip.loadAsync(original());
    const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
    zip.file(
      "xl/_rels/workbook.xml.rels",
      rels.replace(
        "</Relationships>",
        '<Relationship Id="calc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>',
      ),
    );
    zip.file("xl/calcChain.xml", "old chain");
    const output = await editWorkbookPackage(
      await zip.generateAsync({ type: "uint8array" }),
      [edit],
    );
    const after = await JSZip.loadAsync(output);
    expect(after.file("xl/calcChain.xml")).toBeNull();
    const workbook = readWorkbookXml(
      await after.file("xl/workbook.xml")!.async("string"),
    );
    expect(
      workbook
        .getElementsByTagNameNS(workbookNamespace, "calcPr")[0]
        .getAttribute("fullCalcOnLoad"),
    ).toBe("1");
    const xml = readWorkbookXml(
      await after.file("xl/worksheets/sheet1.xml")!.async("string"),
    );
    for (const formula of Array.from(
      xml.getElementsByTagNameNS(workbookNamespace, "f"),
    ))
      expect(
        formula.parentElement!.getElementsByTagNameNS(workbookNamespace, "v"),
      ).toHaveLength(0);
  });

  it.each([
    "TRUE",
    "FALSE",
    "",
    "=SUM(B2:B3)",
    "'=not a formula",
    "  whitespace  ",
    "-1.25e2",
  ])("值 %j 可重新导入且不会执行内容", async (value) => {
    const sheets = await importWorkbook(
      await editWorkbookPackage(original(), [{ ...edit, value }]),
      "xlsx",
    );
    const cell = sheets[0].cells.B2;
    if (value.startsWith("=")) expect(cell.formula).toBe(value.slice(1));
    else if (value === "") expect(cell?.raw ?? "").toBe("");
    else if (value === "-1.25e2") expect(cell.raw).toBe("-125");
    else expect(cell.raw).toBe(value.startsWith("'") ? value.slice(1) : value);
  });

  it("拒绝损坏、外部目标、签名和分组公式，不产生可保存的包", async () => {
    await expect(
      editWorkbookPackage(new Uint8Array([1, 2]), [edit]),
    ).rejects.toThrow();
    for (const kind of ["external", "signed", "grouped"] as const) {
      const zip = await JSZip.loadAsync(original());
      if (kind === "external") {
        const source = await zip
          .file("xl/_rels/workbook.xml.rels")!
          .async("string");
        zip.file(
          "xl/_rels/workbook.xml.rels",
          source.replace(
            'Target="worksheets/sheet1.xml"',
            'Target="https://example.invalid/file.xml" TargetMode="External"',
          ),
        );
      } else if (kind === "signed")
        zip.file("_xmlsignatures/sig1.xml", "signature");
      else {
        const source = await zip
          .file("xl/worksheets/sheet1.xml")!
          .async("string");
        zip.file(
          "xl/worksheets/sheet1.xml",
          source.replace("<f>", '<f t="shared" si="0">'),
        );
      }
      await expect(
        editWorkbookPackage(await zip.generateAsync({ type: "uint8array" }), [
          edit,
        ]),
        kind,
      ).rejects.toThrow();
    }
  });
});
