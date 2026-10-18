import { webcrypto } from "node:crypto";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationController } from "./PresentationController";
import { importPresentationDocument } from "./presentationDocument";
import { readPresentationTextBlock } from "./presentationTextDocument";
import {
  textPackageFixture,
  textRelationsPath,
  textSlidePath,
} from "./presentationTextDocument.testFixtures";
import { a, children, one, readXml, r } from "./presentationPackageXml";
import { presentationTextContent } from "./presentationTextRangeXml";

describe("同一PresentationController的canonical富文本输入与原包保存", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  async function setup() {
    let disk = await textPackageFixture();
    const original = disk.slice();
    const files = {
      read: vi.fn(async () => disk.slice()),
      write: vi.fn(async (_path: string, bytes: Uint8Array) => {
        disk = bytes.slice();
      }),
    };
    const controller = new PresentationController(
      "/workspace/rich.pptx",
      await importPresentationDocument(disk, new AbortController().signal),
      files,
    );
    controller.setEditingEnabled(true);
    expect(controller.textActivateBlockEnd("2")).toBe(true);
    const select = (anchor: number, caret = anchor) => {
      expect(
        controller.textSetSelection(
          controller.textPositionAtOffset(anchor)!,
          controller.textPositionAtOffset(caret)!,
        ),
      ).toBe(true);
    };
    const editor = () => controller.getSnapshot().textEditor!;
    const body = () => readXml(editor().bodyXml).documentElement;
    return {
      controller,
      select,
      editor,
      body,
      original,
      files,
      disk: () => disk,
    };
  }

  it("选区保留方向、run范围、链接HTML；只样式化选中文字，跨保存撤销重做", async () => {
    const { controller, select, editor, body, files, disk } = await setup();
    const original = new XMLSerializer().serializeToString(
      children(children(body(), a, "p")[0], a, "r")[0],
    );
    select(9, 6);
    expect(editor()).toMatchObject({
      selectedPlainText: "中😀",
      selection: [{ paraIndex: 0, runIndex: 1, start: 0, end: 3 }],
    });
    expect(
      controller.updateSelectedElementStyle({ bold: true, color: "AA3344" }),
    ).toBe(true);
    expect(editor().selectedPlainText).toBe("中😀");
    expect(
      new XMLSerializer().serializeToString(
        children(children(body(), a, "p")[0], a, "r")[0],
      ),
    ).toBe(original);
    expect(await controller.flushPublicFile()).toBe(true);
    expect(files.read).toHaveBeenCalledTimes(2);
    expect(files.write).toHaveBeenCalledTimes(1);
    const saved = await importPresentationDocument(
      disk(),
      new AbortController().signal,
    );
    const block = readPresentationTextBlock(saved, "512", "2")!;
    const runs = children(children(block.body, a, "p")[0], a, "r");
    expect(one(runs[1], a, "t")!.textContent).toBe("中😀");
    expect(one(runs[1], a, "rPr")!.getAttribute("b")).toBe("1");
    expect(one(runs[2], a, "t")!.textContent).toBe("文");
    expect(one(runs[2], a, "rPr")!.hasAttribute("b")).toBe(false);
    controller.undo();
    expect(await controller.flushPublicFile()).toBe(true);
    const restored = readPresentationTextBlock(
      controller.getSnapshot().document,
      "512",
      "2",
    )!;
    const restoredRun = children(children(restored.body, a, "p")[0], a, "r")[1];
    expect(one(restoredRun, a, "t")!.textContent).toBe("中😀文");
    expect(one(restoredRun, a, "rPr")!.hasAttribute("b")).toBe(false);
    expect(files.write).toHaveBeenCalledTimes(2);
    controller.redo();
    expect(await controller.flushPublicFile()).toBe(true);
    expect(files.write).toHaveBeenCalledTimes(3);
  });

  it("beforeinput在canonical选区插入，删除按grapheme而非代理对中点", async () => {
    const { controller, select, editor } = await setup();
    select(9);
    expect(controller.textHandleBeforeInput("deleteContentBackward")).toBe(
      true,
    );
    expect(editor().value.startsWith("Alpha 中文\ntail")).toBe(true);
    select(6, 8);
    expect(controller.textHandleBeforeInput("insertText", "输入😀")).toBe(true);
    expect(editor().value.startsWith("Alpha 输入😀\ntail")).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(
      presentationTextContent(
        readPresentationTextBlock(
          controller.getSnapshot().document,
          "512",
          "2",
        )!.body,
      ),
    ).toContain("输入😀");
  });

  it("软换行和新段落分别保留br与paragraph；collapsed样式仅影响下一次输入", async () => {
    const { controller, select, body, editor } = await setup();
    select(6);
    expect(controller.textApplyStyle({ italic: true, color: "AA3344" })).toBe(
      true,
    );
    expect(controller.getSnapshot().dirty).toBe(false);
    expect(controller.textHandleBeforeInput("insertText", "TYPED")).toBe(true);
    expect(body().querySelector('[i="1"]')).not.toBeNull();
    const count = children(body(), a, "p").length;
    expect(controller.textHandleBeforeInput("insertLineBreak")).toBe(true);
    expect(children(body(), a, "p")).toHaveLength(count);
    expect(body().getElementsByTagNameNS(a, "br")).toHaveLength(2);
    expect(controller.textHandleBeforeInput("insertParagraph")).toBe(true);
    expect(children(body(), a, "p")).toHaveLength(count + 1);
    expect(editor().value).toContain("TYPED\n\n中😀文");
  });

  it("HTML paste与新链接在同一原包事务保存，原链接、unknown和非目标ZIP保留", async () => {
    const { controller, select, editor, original, disk } = await setup();
    select(0);
    expect(
      controller.textHandlePaste(
        "安全 <&>",
        '<p><strong>安全 &lt;&amp;&gt;</strong><a href="https://example.invalid/new?x=1&amp;y=2">link</a></p>',
      ),
    ).toBe(true);
    expect(editor().value.startsWith("安全 <&>linkAlpha ")).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    const before = await JSZip.loadAsync(original),
      after = await JSZip.loadAsync(disk());
    const rels = await after.file(textRelationsPath)!.async("string");
    expect(rels).toContain("https://example.invalid/new?x=1&amp;y=2");
    expect(rels).toContain('Id="rLink"');
    const xml = readXml(await after.file(textSlidePath)!.async("string"));
    const ids = Array.from(
      xml.getElementsByTagNameNS(a, "hlinkClick"),
      (node) => node.getAttributeNS(r, "id"),
    );
    expect(ids).toContain("rLink");
    expect(ids.every((id) => id && rels.includes(`Id="${id}"`))).toBe(true);
    for (const [name, part] of Object.entries(before.files))
      if (!part.dir && ![textSlidePath, textRelationsPath].includes(name))
        expect(await after.file(name)!.async("uint8array")).toEqual(
          await part.async("uint8array"),
        );
  });

  it("草稿撤销重做恢复选区、输入样式和新链接，提交只产生一次全局历史", async () => {
    const { controller, select, editor, files, disk } = await setup();
    const initial = editor().bodyXml;
    select(9, 6);
    controller.textApplyStyle({ bold: true, color: "AA3344" });
    const styled = editor().bodyXml;
    expect(controller.textHandleBeforeInput("historyUndo")).toBe(true);
    expect(editor().bodyXml).toBe(initial);
    expect(editor().selectedPlainText).toBe("中😀");
    expect(controller.textHandleBeforeInput("historyRedo")).toBe(true);
    expect(editor().bodyXml).toBe(styled);
    expect(editor().selectedPlainText).toBe("中😀");
    select(0);
    controller.textApplyStyle({ italic: true });
    expect(controller.textHandleBeforeInput("historyUndo")).toBe(true);
    expect(editor().typingStyle).toEqual({});
    expect(controller.textHandleBeforeInput("historyRedo")).toBe(true);
    expect(editor().typingStyle).toEqual({ italic: true });
    expect(
      controller.textHandlePaste(
        "new link",
        '<a href="https://example.invalid/local-history">new link</a>',
      ),
    ).toBe(true);
    const linked = editor().bodyXml;
    expect(controller.textHandleBeforeInput("historyUndo")).toBe(true);
    expect(editor().bodyXml).toBe(styled);
    expect(controller.textHandleBeforeInput("historyRedo")).toBe(true);
    expect(editor().bodyXml).toBe(linked);
    expect(files.write).not.toHaveBeenCalled();
    expect(controller.getSnapshot().canUndo).toBe(false);
    expect(await controller.flushPublicFile()).toBe(true);
    expect(files.write).toHaveBeenCalledTimes(1);
    expect(
      await (await JSZip.loadAsync(disk()))
        .file(textRelationsPath)!
        .async("string"),
    ).toContain("https://example.invalid/local-history");
    controller.undo();
    expect(await controller.flushPublicFile()).toBe(true);
    expect(
      presentationTextContent(
        readPresentationTextBlock(
          controller.getSnapshot().document,
          "512",
          "2",
        )!.body,
      ),
    ).toBe("Alpha 中😀文\ntail\nSecond 👩‍💻IME\nThird");
    expect(controller.getSnapshot().canUndo).toBe(false);
  });

  it("粘贴后删除的临时链接不进入原包关系，空本地历史不会撤销已提交动作", async () => {
    const { controller, select, editor, disk } = await setup();
    select(0);
    expect(controller.textHandleBeforeInput("historyUndo")).toBe(false);
    expect(controller.textHandleBeforeInput("historyRedo")).toBe(false);
    controller.textHandlePaste(
      "discard",
      '<a href="https://example.invalid/discard">discard</a>',
    );
    select(0, editor().value.length);
    controller.textHandlePaste("保留正文", "<p>保留正文</p>");
    expect(await controller.flushPublicFile()).toBe(true);
    const saved = await JSZip.loadAsync(disk());
    expect(await saved.file(textRelationsPath)!.async("string")).not.toContain(
      "https://example.invalid/discard",
    );
    expect(controller.textActivateBlockEnd("2")).toBe(true);
    expect(controller.textHandleBeforeInput("historyUndo")).toBe(false);
    expect(editor().value).toContain("保留正文");
    controller.cancelTextEdit();
    expect(controller.getSnapshot().canUndo).toBe(true);
  });

  it("非法Unicode位置和输入不改稿，取消清dirty且不生成历史", async () => {
    const { controller, editor, original, disk } = await setup();
    const previous = editor().bodyXml;
    expect(() => controller.textPositionAtOffset(8)).toThrow(/Unicode/);
    expect(controller.textHandleBeforeInput("insertText", "\u0000")).toBe(
      false,
    );
    expect(editor().bodyXml).toBe(previous);
    expect(
      controller.textHandleCompositionEnd(
        "Alpha 中😀文\ntail\nSecond 👩‍💻IME\nThird",
        8,
        9,
      ),
    ).toBe(false);
    expect(editor().bodyXml).toBe(previous);
    expect(controller.textHandleBeforeInput("historyUndo")).toBe(false);
    expect(
      controller.textHandlePaste(
        "plain fallback",
        '<img src="https://example.invalid/remote.png">',
      ),
    ).toBe(true);
    expect(editor().value).toContain("plain fallback");
    controller.cancelTextEdit();
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      canUndo: false,
      textEditor: null,
    });
    expect(disk()).toEqual(original);
  });
});
