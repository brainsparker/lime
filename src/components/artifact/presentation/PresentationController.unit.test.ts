import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PresentationController } from "./PresentationController";
import {
  importPresentationDocument,
  type PresentationSnapshot,
} from "./presentationDocument";
import {
  presentationElements,
  presentationElementText,
  presentationElementFrame,
} from "./presentationElements";
import { hashFileBytes } from "@/lib/artifact/fileRevision";

const bytes = new Uint8Array(
  fs.readFileSync(
    "src/components/artifact/presentation/__fixtures__/review.pptx",
  ),
);
const path = "/workspace/review.pptx";
describe("PresentationController 真实PPTX编辑与原文件保存", () => {
  let document: PresentationSnapshot;
  let disk: Uint8Array;
  let files: {
    read: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };
  let controller: PresentationController;
  let elementId: string;
  const text = () =>
    presentationElementText(
      presentationElements(
        controller.getSnapshot().document,
        document.slideIds[0],
      ).find((node) => node.id === elementId)!,
    );
  const edit = async (value: string) => {
    expect(controller.textActivateBlockEnd(elementId)).toBe(true);
    controller.textHandleInput(value);
    expect(await controller.flushEdits()).toBe(true);
  };
  beforeEach(async () => {
    vi.stubGlobal("crypto", webcrypto);
    disk = bytes.slice();
    document = await importPresentationDocument(
      bytes,
      new AbortController().signal,
    );
    files = {
      read: vi.fn(async () => disk.slice()),
      write: vi.fn(async (_path: string, value: Uint8Array) => {
        disk = value.slice();
      }),
    };
    controller = new PresentationController(path, document, files);
    controller.setEditingEnabled(true);
    elementId = presentationElements(document, document.slideIds[0]).find(
      (node) => presentationElementText(node)?.includes("SLIDE_PREVIEW_01"),
    )!.id;
  });
  afterEach(() => vi.unstubAllGlobals());
  it("默认不开编辑；文字取消不修改原包，IME文本只有显式commit后投影", async () => {
    controller.setEditingEnabled(false);
    expect(controller.textActivateBlockEnd(elementId)).toBe(false);
    controller.setEditingEnabled(true);
    controller.textActivateBlockEnd(elementId);
    controller.textHandleCompositionEnd("输入法确认\n第二行");
    expect(controller.getSnapshot().textEditor?.value).toBe(
      "输入法确认\n第二行",
    );
    expect(text()).toBe("SLIDE_PREVIEW_01");
    controller.cancelTextEdit();
    expect(controller.getSnapshot().dirty).toBe(false);
    await edit("第一行\n第二行 <&>");
    expect(text()).toBe("第一行\n第二行 <&>");
    expect(files.write).not.toHaveBeenCalled();
    expect(controller.getSnapshot().document.sourceSha256).toBe(
      document.sourceSha256,
    );
  });
  it("文字保存后重读真实PPTX，清dirty并更新源SHA；不触发多余写入", async () => {
    await edit("PERSISTED_TEXT");
    expect(await controller.flushPublicFile()).toBe(true);
    expect(files.read).toHaveBeenCalledTimes(2);
    expect(files.write).toHaveBeenCalledExactlyOnceWith(
      path,
      expect.any(Uint8Array),
    );
    expect(controller.getSnapshot().document.sourceSha256).toBe(
      await hashFileBytes(disk),
    );
    expect(controller.getSnapshot().dirty).toBe(false);
    const reopened = await importPresentationDocument(
      disk,
      new AbortController().signal,
    );
    expect(
      presentationElements(reopened, document.slideIds[0]).map(
        presentationElementText,
      ),
    ).toContain("PERSISTED_TEXT");
    expect(await controller.flushPublicFile()).toBe(true);
    expect(files.write).toHaveBeenCalledTimes(1);
  });
  it("位置与字体修改、删除及undo/redo共用同一编辑历史", async () => {
    controller.setSelectedElementId(elementId);
    const frame = presentationElementFrame(
      presentationElements(document, document.slideIds[0]).find(
        (node) => node.id === elementId,
      )!,
    );
    expect(controller.nudgeSelectedElements({ dx: 10, dy: -5 })).toBe(true);
    await controller.flushEdits();
    expect(
      presentationElementFrame(
        presentationElements(
          controller.getSnapshot().document,
          document.slideIds[0],
        ).find((node) => node.id === elementId)!,
      ),
    ).toMatchObject({ x: frame.x + 10, y: frame.y - 5 });
    expect(
      controller.updateSelectedElementStyle({ bold: true, fontSize: 24 }),
    ).toBe(true);
    await controller.flushEdits();
    expect(controller.deleteSelectedElement()).toBe(true);
    await controller.flushEdits();
    expect(
      presentationElements(
        controller.getSnapshot().document,
        document.slideIds[0],
      ).some((node) => node.id === elementId),
    ).toBe(false);
    controller.undo();
    await controller.flushEdits();
    expect(text()).toBe("SLIDE_PREVIEW_01");
    controller.redo();
    await controller.flushEdits();
    expect(
      presentationElements(
        controller.getSnapshot().document,
        document.slideIds[0],
      ).some((node) => node.id === elementId),
    ).toBe(false);
  });
  it("第一次与序列化后的外部修改均拒绝覆盖并保留编辑稿", async () => {
    await edit("LOCAL_DRAFT");
    disk = new Uint8Array([1, 2, 3]);
    expect(await controller.flushPublicFile()).toBe(false);
    expect(controller.getSnapshot().failure).toBe("fileChanged");
    expect(text()).toBe("LOCAL_DRAFT");
    expect(controller.getSnapshot().dirty).toBe(true);
    expect(files.write).not.toHaveBeenCalled();
    files.read
      .mockReset()
      .mockResolvedValueOnce(bytes)
      .mockResolvedValueOnce(new Uint8Array([3, 2, 1]));
    expect(await controller.flushPublicFile()).toBe(false);
    expect(files.write).not.toHaveBeenCalled();
    expect(controller.getSnapshot().failure).toBe("fileChanged");
  });
  it("保存失败保稿并可重试；并发保存合并同一Promise", async () => {
    await edit("RETRY_DRAFT");
    files.write.mockRejectedValueOnce(new Error("write denied"));
    const first = controller.flushPublicFile();
    expect(controller.flushPublicFile()).toBe(first);
    expect(await first).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      saving: false,
      failure: "saveFailed",
    });
    expect(await controller.flushPublicFile()).toBe(true);
    expect(text()).toBe("RETRY_DRAFT");
  });
  it("保存期间编辑与放弃被锁定，完成后仍能撤销已保存修改", async () => {
    await edit("CAPTURED");
    let finish!: () => void;
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    files.write.mockImplementationOnce(
      async (_path: string, value: Uint8Array) => {
        await waiting;
        disk = value.slice();
      },
    );
    const saving = controller.flushPublicFile();
    await vi.waitFor(() => expect(files.write).toHaveBeenCalledTimes(1));
    expect(controller.getSnapshot().saving).toBe(true);
    expect(controller.textActivateBlockEnd(elementId)).toBe(false);
    controller.discardEdits();
    expect(text()).toBe("CAPTURED");
    finish();
    expect(await saving).toBe(true);
    expect(controller.getSnapshot().canUndo).toBe(true);
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(text()).toBe("SLIDE_PREVIEW_01");
    expect(controller.getSnapshot().dirty).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    expect(files.write).toHaveBeenCalledTimes(2);
    controller.redo();
    expect(await controller.flushEdits()).toBe(true);
    expect(text()).toBe("CAPTURED");
    expect(await controller.flushPublicFile()).toBe(true);
    expect(files.write).toHaveBeenCalledTimes(3);
  });
  it("重开外部版本不覆盖dirty稿；明确放弃后才接纳新文档", async () => {
    await edit("PRESERVED_DRAFT");
    const other = new PresentationController(path, document, files);
    other.setEditingEnabled(true);
    other.textActivateBlockEnd(elementId);
    other.textHandleInput("EXTERNAL");
    expect(await other.flushPublicFile()).toBe(true);
    const external = await importPresentationDocument(
      disk,
      new AbortController().signal,
    );
    controller.receiveDocument(external);
    expect(controller.getSnapshot().failure).toBe("fileChanged");
    expect(text()).toBe("PRESERVED_DRAFT");
    controller.discardEdits();
    controller.receiveDocument(external);
    expect(text()).toBe("EXTERNAL");
    expect(await controller.flushPublicFile()).toBe(true);
  });
  it("无法序列化的修改不写盘，撤销后可继续编辑并保存", async () => {
    controller.setSelectedElementId(elementId);
    controller.updateSelectedElementFrame({
      x: NaN,
      y: 0,
      width: 1,
      height: 1,
    });
    expect(await controller.flushEdits()).toBe(false);
    expect(await controller.flushPublicFile()).toBe(false);
    expect(files.write).not.toHaveBeenCalled();
    expect(controller.getSnapshot().failure).toBe("invalidEdit");
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    await edit("AFTER_UNDO");
    expect(await controller.flushPublicFile()).toBe(true);
  });
});
