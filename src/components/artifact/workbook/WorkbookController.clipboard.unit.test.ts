import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashFileBytes } from "@/lib/artifact/fileRevision";
import { WorkbookController } from "./WorkbookController";
import { importWorkbook } from "./workbookDocument";
import { parseCellRange } from "./workbookRange";

const range = (value: string) => parseCellRange(value)!;
async function setup(format: "csv" | "tsv" | "xlsx" = "csv") {
  let bytes: Uint8Array =
    format === "xlsx"
      ? new Uint8Array(
          readFileSync(
            "src/components/artifact/workbook/__fixtures__/review.xlsx",
          ),
        )
      : new TextEncoder().encode(
          format === "csv"
            ? '"name",value\r\nold,001\r\n'
            : "name\tvalue\r\nold\t001\r\n",
        );
  if (format === "xlsx") {
    const zip = await JSZip.loadAsync(bytes);
    zip.file("customXml/keep.xml", "<unknown>unchanged</unknown>");
    bytes = await zip.generateAsync({ type: "uint8array" });
  }
  const source = new Uint8Array(bytes);
  const document = {
    sourceSha256: await hashFileBytes(bytes),
    sheets: await importWorkbook(bytes, format),
  };
  const read = vi.fn(async () => bytes);
  const write = vi.fn(async (_path: string, next: Uint8Array) => {
    bytes = new Uint8Array(next);
  });
  const controller = new WorkbookController(
    `/tmp/clipboard.${format}`,
    document,
    { read, write },
  );
  const sheetId = document.sheets[0].id;
  const select = (address: string) =>
    controller.setSelectionRect(sheetId, range(address));
  controller.setEditing(true);
  return {
    controller,
    document,
    source,
    read,
    write,
    sheetId,
    select,
    bytes: () => bytes,
  };
}

describe("Workbook Controller 原子范围剪贴板", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));

  it("只读允许 copy；cut 和只读 paste 不改任何状态", async () => {
    const { controller, select, write } = await setup();
    select("A1:B2");
    controller.setEditing(false);
    const before = controller.getSnapshot();
    expect(controller.requestClipboardPayload("copy")).toEqual({
      plainText: "name\tvalue\nold\t001",
    });
    expect(controller.requestClipboardPayload("cut")).toBeNull();
    expect(controller.pasteClipboardData({ plainText: "replace" })).toBe(false);
    expect(controller.getSnapshot()).toBe(before);
    expect(write).not.toHaveBeenCalled();
  });

  it("矩形粘贴仅通知一次，保留别处草稿；一次 flush 只写一次原路径", async () => {
    const { controller, select, sheetId, read, write, bytes } = await setup();
    controller.openCellEditor(sheetId, "A2", "kept draft");
    controller.commitCellEdit();
    select("C3:D8");
    const notified = vi.fn();
    controller.subscribe(notified);
    expect(
      controller.pasteClipboardData({
        plainText: '"繁體\t日本語\n한국어"\t  tail  \n=1+1\t\'001',
      }),
    ).toBe(true);
    expect(notified).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().selections[sheetId]).toEqual(
      range("C3:D4"),
    );
    expect(controller.getSnapshot().edits).toHaveLength(5);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(await controller.flushPublicFile()).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe("/tmp/clipboard.csv");
    const cells = (await importWorkbook(bytes(), "csv"))[0].cells;
    expect([
      cells.A2.raw,
      cells.C3.raw,
      cells.D3.raw,
      cells.C4.raw,
      cells.D4.raw,
    ]).toEqual([
      "kept draft",
      "繁體\t日本語\n한국어",
      "  tail  ",
      "=1+1",
      "'001",
    ]);
    expect(
      new TextDecoder().decode(bytes()).startsWith('"name",value\r\n'),
    ).toBe(true);
  });

  it.each(["csv", "tsv"] as const)(
    "%s 范围值不计算公式或剥单引号",
    async (format) => {
      const { controller, select, bytes } = await setup(format);
      select("C3");
      controller.pasteClipboardData({ plainText: "=1+1\t'001" });
      expect(await controller.flushPublicFile()).toBe(true);
      const cells = (await importWorkbook(bytes(), format))[0].cells;
      expect(cells.C3.raw).toBe("=1+1");
      expect(cells.C3.formula).toBeUndefined();
      expect(cells.D3.raw).toBe("'001");
    },
  );

  it("粘贴覆盖同格草稿，粘回原值结算该格且保留其他格", async () => {
    const { controller, select, sheetId } = await setup();
    for (const address of ["A1", "B2"]) {
      controller.openCellEditor(sheetId, address, "draft");
      controller.commitCellEdit();
    }
    select("A1");
    controller.pasteClipboardData({ plainText: "name" });
    expect(
      controller.getSnapshot().edits.map(({ address }) => address),
    ).toEqual(["B2"]);
    expect(controller.getSnapshot().document.sheets[0].cells.A1.raw).toBe(
      "name",
    );
    select("B2");
    controller.pasteClipboardData({ plainText: "001" });
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, edits: [] });
  });

  it("活跃输入期间不 flush 或篡改输入；拒绝范围保留草稿、文档和选区引用", async () => {
    const { controller, select, sheetId, write } = await setup();
    controller.openCellEditor(sheetId, "A2", "active input");
    const active = controller.getSnapshot();
    expect(controller.requestClipboardPayload("copy")).toBeNull();
    expect(controller.pasteClipboardData({ plainText: "new" })).toBe(false);
    expect(controller.getSnapshot()).toBe(active);
    controller.commitCellEdit();
    select("J30");
    const before = controller.getSnapshot();
    expect(controller.pasteClipboardData({ plainText: "a\tb\nc\td" })).toBe(
      false,
    );
    const after = controller.getSnapshot();
    expect(after).toMatchObject({ failure: "invalidPaste", dirty: true });
    expect(after.document).toBe(before.document);
    expect(after.edits).toBe(before.edits);
    expect(after.selections).toBe(before.selections);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([1, 2])(
    "范围保存第 %d 次 SHA 检查冲突时保稿、选区且零写",
    async (at) => {
      const { controller, select, read, write, bytes } = await setup();
      select("C3");
      controller.pasteClipboardData({ plainText: "a\tb\nc\td" });
      const before = controller.getSnapshot();
      const outside = new TextEncoder().encode("external change");
      if (at === 1) read.mockResolvedValueOnce(outside);
      else read.mockResolvedValueOnce(bytes()).mockResolvedValueOnce(outside);
      expect(await controller.flushPublicFile()).toBe(false);
      expect(write).not.toHaveBeenCalled();
      expect(controller.getSnapshot().edits).toBe(before.edits);
      expect(controller.getSnapshot().selections).toBe(before.selections);
      expect(controller.getSnapshot()).toMatchObject({
        dirty: true,
        failure: "fileChanged",
      });
    },
  );

  it("保存失败保留整个矩形；保存中拒绝新 paste，重试才结算", async () => {
    const { controller, select, read, write, bytes } = await setup();
    select("C3");
    controller.pasteClipboardData({ plainText: "a\tb\nc\td" });
    write.mockRejectedValueOnce(new Error("denied"));
    let release!: (value: Uint8Array) => void;
    read.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const pending = controller.flushPublicFile();
    const saving = controller.getSnapshot();
    expect(controller.pasteClipboardData({ plainText: "lost" })).toBe(false);
    expect(controller.getSnapshot()).toBe(saving);
    expect(controller.flushPublicFile()).toBe(pending);
    release(bytes());
    expect(await pending).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      failure: "saveFailed",
    });
    expect(controller.getSnapshot().edits).toHaveLength(4);
    expect(await controller.flushPublicFile()).toBe(true);
    expect(controller.getSnapshot().edits).toHaveLength(0);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("XLSX 原包范围修改保留其他 payload、样式与 merged，公式缓存失效且不计算", async () => {
    const { controller, select, source, bytes, write, sheetId, document } =
      await setup("xlsx");
    select("B4");
    const cached = document.sheets[0].cells.B4.text;
    expect(controller.requestClipboardPayload("copy")).toEqual({
      plainText: cached,
    });
    select("A1");
    const before = controller.getSnapshot();
    expect(
      controller.pasteClipboardData({ plainText: "merged rejected" }),
    ).toBe(false);
    expect(controller.getSnapshot().document).toBe(before.document);
    select("A2:B3");
    expect(
      controller.pasteClipboardData({
        plainText: "=1+1\t  中文  \n'=literal\t42",
      }),
    ).toBe(true);
    expect(controller.getSnapshot().document.sheets[0].cells.B2.style).toEqual(
      document.sheets[0].cells.B2.style,
    );
    select("B4");
    expect(controller.requestClipboardPayload("copy")).toEqual({
      plainText: '""',
    });
    expect(await controller.flushPublicFile()).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    const sheets = await importWorkbook(bytes(), "xlsx");
    expect(sheets[0].cells.A2).toMatchObject({
      formula: "1+1",
      raw: "",
      text: "",
    });
    expect(sheets[0].cells.A3).toMatchObject({
      raw: "=literal",
      formula: undefined,
    });
    expect(sheets[0].cells.B2.raw).toBe("  中文  ");
    expect(sheets[0].cells.B4).toMatchObject({
      formula: "SUM(B2:B3)",
      raw: "",
    });
    expect(sheets[0].cells.A1).toEqual(document.sheets[0].cells.A1);
    expect(sheets[0].merges).toEqual(document.sheets[0].merges);
    expect(sheets[1].cells.A1).toEqual(document.sheets[1].cells.A1);
    expect(sheets[1].cells.B1).toEqual({
      ...document.sheets[1].cells.B1,
      raw: "",
      text: "",
    });
    const input = await JSZip.loadAsync(source),
      output = await JSZip.loadAsync(bytes());
    for (const [name, entry] of Object.entries(input.files))
      if (
        !entry.dir &&
        ![
          "xl/worksheets/sheet1.xml",
          "xl/worksheets/sheet2.xml",
          "xl/workbook.xml",
        ].includes(name)
      )
        expect(await output.file(name)!.async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
    expect(controller.getSnapshot().activeSheetId).toBe(sheetId);
  });
});
