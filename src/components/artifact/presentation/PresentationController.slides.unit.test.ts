import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationController } from "./PresentationController";
import { importPresentationDocument } from "./presentationDocument";
import {
  presentationElements,
  presentationElementText,
} from "./presentationElements";
import {
  fixture,
  blankLayout,
  original,
} from "./presentationSlidesPackage.testFixtures";

const path = "/workspace/structure.pptx";
const read = (bytes: Uint8Array) =>
  importPresentationDocument(bytes, new AbortController().signal);

describe("PresentationController 幻灯片与对象共用操作历史", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());
  async function setup(bytes = fixture()) {
    let disk = (await bytes).slice();
    const files = {
      read: vi.fn(async () => disk.slice()),
      write: vi.fn(async (_path: string, value: Uint8Array) => {
        disk = value.slice();
      }),
    };
    const document = await read(disk);
    const controller = new PresentationController(path, document, files);
    controller.setEditingEnabled(true);
    const text = (slideId = controller.getSnapshot().selectedSlideId) =>
      presentationElements(controller.getSnapshot().document, slideId).map(
        presentationElementText,
      );
    const edit = (value: string) => {
      const node = presentationElements(
        controller.getSnapshot().document,
        controller.getSnapshot().selectedSlideId,
      ).find((node) => presentationElementText(node) !== undefined)!;
      expect(controller.textActivateBlockEnd(node.id)).toBe(true);
      controller.textHandleInput(value);
    };
    return { controller, files, document, text, edit, disk: () => disk };
  }

  it("在途文字先提交，复制得到当时内容，副本编辑不污染源页；移动删除后保存重开", async () => {
    const { controller, files, document, edit, text, disk } = await setup();
    const sourceId = document.slideIds[0];
    edit("SOURCE_AT_COPY");
    expect(controller.duplicateSelectedSlide()).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    const copyId = controller.getSnapshot().selectedSlideId;
    expect(copyId).not.toBe(sourceId);
    expect(controller.getSnapshot().primarySelectedElementId).toBeNull();
    expect(text()).toContain("SOURCE_AT_COPY");
    edit("COPY_ONLY");
    expect(await controller.flushEdits()).toBe(true);
    expect(text(sourceId)).toContain("SOURCE_AT_COPY");
    expect(text(copyId)).toContain("COPY_ONLY");
    expect(controller.moveSlide(1, 3)).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.getSnapshot().document.slideIds.at(-1)).toBe(copyId);
    expect(controller.deleteSlide(1)).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    const reopened = await read(disk());
    expect(reopened.slideIds).toEqual([sourceId, document.slideIds[2], copyId]);
    expect(
      presentationElements(reopened, copyId).map(presentationElementText),
    ).toContain("COPY_ONLY");
    expect(files.write).toHaveBeenCalledExactlyOnceWith(
      path,
      expect.any(Uint8Array),
    );
  });

  it("新增使用真实版式，undo/redo重放同一身份且可继续编辑；删除当前页选择邻页", async () => {
    const { controller, document, text } = await setup();
    expect(controller.addSlide(blankLayout)).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    const created = controller.getSnapshot().selectedSlideId;
    expect(controller.getSnapshot().document.slideIds).toEqual([
      document.slideIds[0],
      created,
      ...document.slideIds.slice(1),
    ]);
    expect(text()).not.toContain("SLIDE_PREVIEW_01");
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.getSnapshot().document.slideIds).toEqual(
      document.slideIds,
    );
    controller.redo();
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.getSnapshot().document.slideIds[1]).toBe(created);
    controller.setSelectedSlideIdx(1);
    expect(controller.deleteSlide(1)).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.getSnapshot().selectedSlideId).toBe(document.slideIds[1]);
  });

  it("无真实版式时新增失败保留已有对象稿，undo后仍可保存", async () => {
    const { controller, files, edit, text } = await setup(
      Promise.resolve(original()),
    );
    edit("KEEP_OBJECT_DRAFT");
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.addSlide()).toBe(true);
    expect(await controller.flushEdits()).toBe(false);
    expect(await controller.flushPublicFile()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      failure: "invalidEdit",
    });
    expect(text()).toContain("KEEP_OBJECT_DRAFT");
    expect(files.write).not.toHaveBeenCalled();
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
  });

  it("末页删除受到保护，结构修改遇到外部冲突仍保稿且零写入", async () => {
    const { controller, files } = await setup();
    for (let index = 0; index < 2; index++) {
      expect(controller.deleteSlide(0)).toBe(true);
      expect(await controller.flushEdits()).toBe(true);
    }
    expect(controller.deleteSlide(0)).toBe(false);
    expect(controller.getSnapshot().document.slideIds).toHaveLength(1);
    files.read.mockResolvedValue(new Uint8Array([1, 2]));
    expect(await controller.flushPublicFile()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      failure: "fileChanged",
    });
    expect(controller.getSnapshot().document.slideIds).toHaveLength(1);
    expect(files.write).not.toHaveBeenCalled();
  });

  it("保存等待投影时立即锁住结构编辑，重复保存返回同一Promise", async () => {
    const { controller, files, edit } = await setup();
    edit("SAVED_ONCE");
    const pending = controller.flushPublicFile();
    expect(controller.getSnapshot().saving).toBe(true);
    expect(controller.flushPublicFile()).toBe(pending);
    expect(controller.duplicateSelectedSlide()).toBe(false);
    expect(controller.addSlide()).toBe(false);
    expect(controller.deleteSlide(0)).toBe(false);
    expect(await pending).toBe(true);
    expect(files.write).toHaveBeenCalledTimes(1);
  });
});
