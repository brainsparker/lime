import { webcrypto } from "node:crypto";
import { createStore } from "jotai/vanilla";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashFileBytes } from "@/lib/artifact/fileRevision";
import { importWorkbook } from "./workbookDocument";
import {
  WorkbookController,
  workbookControllersAtom,
} from "./WorkbookController";

async function setup() {
  let bytes = new TextEncoder().encode('"name",value\r\nold,001\r\n');
  const document = {
    sourceSha256: await hashFileBytes(bytes),
    sheets: await importWorkbook(bytes, "csv"),
  };
  const read = vi.fn(async () => bytes);
  const write = vi.fn(async (_path: string, next: Uint8Array) => {
    bytes = new Uint8Array(next);
  });
  const controller = new WorkbookController("/tmp/data.csv", document, {
    read,
    write,
  });
  controller.setEditing(true);
  const edit = (value: string) => {
    expect(controller.openCellEditor("delimited", "A2")).toBe(true);
    controller.updateFormulaInput(value);
    controller.commitCellEdit();
  };
  return { controller, document, read, write, edit, bytes: () => bytes };
}

describe("工作表编辑、保存与源版本", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  it("保存前flush活跃编辑，真实字节可重新导入且仅原路径写一次", async () => {
    const { controller, read, write, bytes } = await setup();
    controller.openCellEditor("delimited", "A2");
    controller.updateFormulaInput("new value");
    await expect(controller.flushPublicFile()).resolves.toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe("/tmp/data.csv");
    expect((await importWorkbook(bytes(), "csv"))[0].cells.A2.raw).toBe(
      "new value",
    );
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      editor: null,
      saving: false,
      edits: [],
      failure: null,
    });
    expect(controller.getSnapshot().document.sourceSha256).toBe(
      await hashFileBytes(bytes()),
    );
  });
  it("Esc取消活跃输入，不清除之前已提交的本地编辑", async () => {
    const { controller, edit } = await setup();
    edit("first");
    controller.openCellEditor("delimited", "A2");
    controller.updateFormulaInput("canceled");
    controller.cancelCellEdit();
    expect(controller.getSnapshot().document.sheets[0].cells.A2.raw).toBe(
      "first",
    );
    expect(controller.getSnapshot().dirty).toBe(true);
  });
  it("CSV的公式样字段与单引号保留字面值，不做XLSX类型推断", async () => {
    const { controller, edit, bytes } = await setup();
    for (const value of ["=1+1", "'001"]) {
      edit(value);
      expect(
        controller.getSnapshot().document.sheets[0].cells.A2,
      ).toMatchObject({ raw: value, formula: undefined });
      expect(await controller.flushPublicFile()).toBe(true);
      expect((await importWorkbook(bytes(), "csv"))[0].cells.A2.raw).toBe(
        value,
      );
    }
  });
  it.each([1, 2])("第%d次源检查发现外部变更则零覆盖并保留更改", async (at) => {
    const { controller, edit, read, write, bytes } = await setup();
    edit("local");
    const outside = new TextEncoder().encode("external edit");
    if (at === 1) read.mockResolvedValueOnce(outside);
    else read.mockResolvedValueOnce(bytes()).mockResolvedValueOnce(outside);
    expect(await controller.flushPublicFile()).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      failure: "fileChanged",
    });
    expect(controller.getSnapshot().document.sheets[0].cells.A2.raw).toBe(
      "local",
    );
  });
  it("写入拒绝后保稿，重试成功后才结算", async () => {
    const { controller, edit, write } = await setup();
    edit("kept");
    write.mockRejectedValueOnce(new Error("read only file"));
    expect(await controller.flushPublicFile()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      saving: false,
      failure: "saveFailed",
    });
    expect(await controller.flushPublicFile()).toBe(true);
    expect(controller.getSnapshot().dirty).toBe(false);
  });
  it("重复保存共享同一in-flight任务；保存期间不能改写捕获输入或放弃草稿", async () => {
    const { controller, edit, read, bytes, write } = await setup();
    edit("captured");
    let resolve!: (value: Uint8Array) => void;
    read.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const first = controller.flushPublicFile(),
      second = controller.flushPublicFile();
    expect(first).toBe(second);
    expect(controller.openCellEditor("delimited", "A2", "new")).toBe(false);
    controller.discardEdits();
    expect(controller.getSnapshot().dirty).toBe(true);
    resolve(bytes());
    expect(await first).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("重新读取冲突版本不替换未保存投影，显式放弃后才接受新版本", async () => {
    const { controller, edit, document } = await setup();
    edit("local");
    const next = { ...document, sourceSha256: "b".repeat(64) };
    controller.receiveDocument(next);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      failure: "fileChanged",
    });
    expect(controller.getSnapshot().document.sheets[0].cells.A2.raw).toBe(
      "local",
    );
    controller.discardEdits();
    controller.receiveDocument(next);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      failure: null,
      document: { sourceSha256: next.sourceSha256 },
    });
  });
  it("应用scope保留原controller与活跃输入，独立scope互相隔离", async () => {
    const { controller } = await setup();
    const scope = createStore(),
      other = createStore();
    scope.get(workbookControllersAtom).set(controller.path, controller);
    controller.openCellEditor("delimited", "A2");
    controller.updateFormulaInput("unmounted draft");
    expect(
      scope.get(workbookControllersAtom).get(controller.path)?.getSnapshot()
        .editor?.value,
    ).toBe("unmounted draft");
    expect(other.get(workbookControllersAtom).size).toBe(0);
  });
});
