import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationController } from "./PresentationController";
import { importPresentationDocument } from "./presentationDocument";
import {
  installPresentationTextEditor,
  presentationEditorOffset,
  presentationEditorText,
} from "./presentationTextEditor";
import {
  modifyTextPackage,
  textPackageFixture,
} from "./presentationTextDocument.testFixtures";
import { a, p, children, one, readXml } from "./presentationPackageXml";
import { runText, textRuns } from "./presentationTextRangeXml";
import { textBodyFixture } from "./presentationTextRange.testFixtures";

const cleanup: (() => void)[] = [];
type InputOptions = NonNullable<ConstructorParameters<typeof InputEvent>[1]>;
type KeyboardOptions = NonNullable<
  ConstructorParameters<typeof KeyboardEvent>[1]
>;
const serialize = (node: Node) => new XMLSerializer().serializeToString(node);
const paragraph = (root: HTMLElement, index: number) =>
  root.querySelector<HTMLElement>(`[data-text-paragraph="${index}"]`)!;
const run = (root: HTMLElement, para: number, index: number) =>
  paragraph(root, para).querySelector<HTMLElement>(
    `[data-text-run="${index}"]`,
  )!;
const beforeInput = (
  root: HTMLElement,
  inputType: string,
  data: string | null = null,
  options: InputOptions = {},
) => {
  const event = new root.ownerDocument.defaultView!.InputEvent("beforeinput", {
    inputType,
    data,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  root.dispatchEvent(event);
  return event;
};
const targetedInput = (
  root: HTMLElement,
  inputType: string,
  ranges?: readonly {
    startContainer: Node;
    startOffset: number;
    endContainer: Node;
    endOffset: number;
  }[],
) => {
  const event = new root.ownerDocument.defaultView!.InputEvent("beforeinput", {
    inputType,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "getTargetRanges", {
    value: ranges && (() => ranges),
  });
  root.dispatchEvent(event);
  return event;
};
const input = (root: HTMLElement, options: InputOptions = {}) =>
  root.dispatchEvent(
    new root.ownerDocument.defaultView!.InputEvent("input", {
      bubbles: true,
      ...options,
    }),
  );
const key = (
  root: HTMLElement,
  value: string,
  options: KeyboardOptions = {},
) => {
  const event = new root.ownerDocument.defaultView!.KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  root.dispatchEvent(event);
  return event;
};
const clipboard = (
  root: HTMLElement,
  name: string,
  initial: Record<string, string> = {},
) => {
  const values = new Map(Object.entries(initial));
  const event = new root.ownerDocument.defaultView!.Event(name, {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (type: string) => values.get(type) ?? "",
      setData: (type: string, value: string) => values.set(type, value),
    },
  });
  root.dispatchEvent(event);
  return { event, values };
};
const composition = (root: HTMLElement, type: string) =>
  root.dispatchEvent(
    new root.ownerDocument.defaultView!.CompositionEvent(type, {
      bubbles: true,
    }),
  );
const selectionAt = (
  root: HTMLElement,
  anchor: Node,
  from: number,
  caret = anchor,
  to = from,
) => {
  root.ownerDocument.getSelection()!.setBaseAndExtent(anchor, from, caret, to);
  root.ownerDocument.dispatchEvent(
    new root.ownerDocument.defaultView!.Event("selectionchange"),
  );
};
const ticks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

async function setup(frame = false, bytes?: Uint8Array) {
  let disk = bytes ?? (await textPackageFixture());
  const original = disk.slice(),
    files = {
      read: vi.fn(async () => disk.slice()),
      write: vi.fn(async (_path: string, bytes: Uint8Array) => {
        disk = bytes.slice();
      }),
    },
    controller = new PresentationController(
      "/workspace/editor.pptx",
      await importPresentationDocument(disk, new AbortController().signal),
      files,
    );
  controller.setEditingEnabled(true);
  expect(controller.textActivateBlockEnd("2")).toBe(true);
  const host = document.createElement(frame ? "iframe" : "div");
  document.body.append(host);
  const mount = frame
    ? (host as HTMLIFrameElement).contentDocument!.body
    : host;
  const dispose = installPresentationTextEditor({
    mount,
    controller,
    label: "正文",
    style: {},
  });
  const root = mount.querySelector<HTMLElement>(
    "[data-presentation-text-editor]",
  )!;
  cleanup.push(() => {
    dispose();
    host.remove();
  });
  const editor = () => controller.getSnapshot().textEditor!;
  const body = () => readXml(editor().bodyXml).documentElement;
  const select = (anchor: number, caret = anchor) => {
    expect(
      controller.textSetSelection(
        controller.textPositionAtOffset(anchor)!,
        controller.textPositionAtOffset(caret)!,
      ),
    ).toBe(true);
  };
  return {
    controller,
    root,
    host,
    mount,
    dispose,
    files,
    editor,
    body,
    select,
    original,
    disk: () => disk,
  };
}

async function setupParagraphs(paragraphs: string[]) {
  return setup(
    false,
    await modifyTextPackage(await textPackageFixture(), (document) => {
      one(
        document.getElementsByTagNameNS(p, "sp")[0],
        p,
        "txBody",
      )!.replaceWith(
        document.importNode(textBodyFixture({ paragraphs }), true),
      );
    }),
  );
}

describe("controlled presentation text DOM", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => {
    for (const dispose of cleanup.splice(0).reverse()) dispose();
    vi.unstubAllGlobals();
  });

  it("DOM Range 正反向映射真实 run、软br与段落UTF-16 offset", async () => {
    const { root, controller, editor } = await setup(),
      first = run(root, 0, 0).firstChild!,
      han = run(root, 0, 1).firstChild!,
      second = run(root, 1, 1).firstChild!;
    expect(root.getAttribute("role")).toBe("textbox");
    expect(presentationEditorText(root)).toBe(
      "Alpha 中😀文\ntail\nSecond 👩‍💻IME\nThird",
    );
    expect(presentationEditorOffset(root, first, 6)).toBe(6);
    expect(presentationEditorOffset(root, han, 1)).toBe(7);
    expect(presentationEditorOffset(root, han, 3)).toBe(9);
    expect(presentationEditorOffset(root, paragraph(root, 0), 2)).toBe(10);
    expect(presentationEditorOffset(root, paragraph(root, 0), 3)).toBe(11);
    expect(presentationEditorOffset(root, run(root, 0, 3).firstChild!, 4)).toBe(
      15,
    );
    expect(presentationEditorOffset(root, run(root, 1, 0).firstChild!, 0)).toBe(
      16,
    );
    expect(presentationEditorOffset(root, root, 1)).toBe(15);
    for (const reverse of [false, true]) {
      selectionAt(
        root,
        reverse ? second : han,
        reverse ? 2 : 0,
        reverse ? han : second,
        reverse ? 0 : 2,
      );
      expect(editor().selectedPlainText).toBe("中😀文\ntail\nSecond 👩");
      expect(controller.textOffsetAtPosition(editor().anchor)).toBe(
        reverse ? 25 : 6,
      );
      expect(controller.textOffsetAtPosition(editor().caret)).toBe(
        reverse ? 6 : 25,
      );
    }
    expect(presentationEditorOffset(root, document.body, 0)).toBeUndefined();
    expect(presentationEditorOffset(root, first, 100)).toBeUndefined();
  });

  it("受控placeholder不额外计换行，空段与soft break各自保留", () => {
    const root = document.createElement("div");
    root.innerHTML =
      "<div>A<br>B</div><div><span></span><br data-text-placeholder></div><div>C</div>";
    expect(presentationEditorText(root)).toBe("A\nB\n\nC");
  });

  it("真实原包段落按同源pt/lh显示固定或百分比行距与段距，空段/软br不变", async () => {
    const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
    cleanup.push(() => setProperty.mockRestore());
    const { root, editor, body } = await setupParagraphs([
      '<a:p keep="spacing"><a:pPr marL="12700" marR="25400" indent="-6350"><a:lnSpc><a:spcPct val="175000"/></a:lnSpc><a:spcBef><a:spcPts val="450"/></a:spcBef><a:spcAft><a:spcPct val="150000"/></a:spcAft><a:extLst><a:ext uri="urn:retained"/></a:extLst></a:pPr><a:r><a:t>A</a:t></a:r><a:br/><a:r><a:t>B</a:t></a:r></a:p>',
      '<a:p><a:pPr><a:lnSpc><a:spcPts val="2400"/></a:lnSpc><a:spcBef><a:spcPct val="100000"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buChar char="○"/></a:pPr><a:endParaRPr lang="zh-CN"/></a:p>',
    ]);
    const original = editor().bodyXml,
      first = paragraph(root, 0).style,
      empty = paragraph(root, 1).style;
    expect(first.lineHeight).toBe("1.75");
    expect(first.marginTop).toBe("4.5pt");
    // JSDOM 的 CSS parser 尚不接受 lh；断言真实投影调用，不伪造布局支持。
    expect(setProperty).toHaveBeenCalledWith("margin-bottom", "1.5lh");
    expect(first.marginLeft).toBe("1pt");
    expect(first.marginRight).toBe("2pt");
    expect(first.textIndent).toBe("-0.5pt");
    expect(empty.lineHeight).toBe("24pt");
    expect(setProperty).toHaveBeenCalledWith("margin-top", "1lh");
    expect(empty.marginBottom).toBe("0pt");
    expect(empty.listStyleType).toBe("circle");
    expect(
      paragraph(root, 1).querySelector("[data-text-placeholder]"),
    ).not.toBeNull();
    expect(presentationEditorText(root)).toBe("A\nB\n");
    expect(presentationEditorOffset(root, run(root, 0, 2).firstChild!, 1)).toBe(
      3,
    );
    expect(presentationEditorOffset(root, paragraph(root, 1), 1)).toBe(4);
    expect(serialize(body())).toBe(original);
  });

  it("列表用原生CSS marker表达类型、起点、连续级别；不污染范围、复制或原XML", async () => {
    const sources = [
      ['<a:buAutoNum type="arabicPeriod" startAt="4"/>', 0, "A"],
      ['<a:buAutoNum type="arabicPeriod"/>', 0, "B"],
      ['<a:buAutoNum type="alphaLcPeriod" startAt="3"/>', 1, "C"],
      ['<a:buAutoNum type="alphaLcPeriod"/>', 1, "D"],
      ['<a:buAutoNum type="arabicPeriod"/>', 0, "E"],
      ['<a:buAutoNum type="alphaUcPeriod"/>', 0, "F"],
      ['<a:buAutoNum type="romanLcPeriod" startAt="9"/>', 0, "G"],
      ['<a:buAutoNum type="romanUcPeriod" startAt="2"/>', 0, "H"],
      ['<a:buChar char="•"/>', 0, "I"],
      ['<a:buChar char="▪"/>', 0, "J"],
      ["<a:buNone/>", 0, "K"],
      ['<a:buAutoNum type="arabicPeriod"/>', 0, "L"],
      ['<a:buAutoNum type="ea1ChsPeriod" startAt="5"/>', 0, "M"],
      ['<a:buChar char="☞"/>', 0, "N"],
    ] as const;
    const { root, controller, editor } = await setupParagraphs(
      sources.map(
        ([list, level, text]) =>
          `<a:p keep="${text}"><a:pPr lvl="${level}">${list}</a:pPr><a:r><a:t>${text}</a:t></a:r></a:p>`,
      ),
    );
    const original = editor().bodyXml,
      styles = sources.map((_, index) => paragraph(root, index).style);
    expect(styles.map((style) => style.listStyleType)).toEqual([
      "decimal",
      "decimal",
      "lower-alpha",
      "lower-alpha",
      "decimal",
      "upper-alpha",
      "lower-roman",
      "upper-roman",
      "disc",
      "square",
      "",
      "decimal",
      "",
      "",
    ]);
    expect(
      styles.map((style) => style.getPropertyValue("counter-set")),
    ).toEqual([
      "list-item 4",
      "list-item 5",
      "list-item 3",
      "list-item 4",
      "list-item 6",
      "list-item 1",
      "list-item 9",
      "list-item 2",
      "",
      "",
      "",
      "list-item 1",
      "",
      "",
    ]);
    expect(styles[0].display).toBe("list-item");
    expect(styles[0].listStylePosition).toBe("inside");
    expect(root.childNodes).toHaveLength(sources.length);
    expect(
      root.querySelector("li,ol,ul,style,[contenteditable=false]"),
    ).toBeNull();
    expect(presentationEditorText(root)).toBe(
      sources.map(([, , text]) => text).join("\n"),
    );
    selectionAt(
      root,
      run(root, 0, 0).firstChild!,
      0,
      run(root, 4, 0).firstChild!,
      1,
    );
    expect(editor().selectedPlainText).toBe("A\nB\nC\nD\nE");
    expect(clipboard(root, "copy").values.get("text/plain")).toBe(
      "A\nB\nC\nD\nE",
    );
    expect(controller.textOffsetAtPosition(editor().anchor)).toBe(0);
    expect(controller.textOffsetAtPosition(editor().caret)).toBe(9);
    expect(editor().bodyXml).toBe(original);
  });

  it("beforeinput替换只改canonical选区，未涉及run/link/list/unknown保留", async () => {
    const { root, editor, body, select } = await setup();
    const latin = serialize(textRuns(children(body(), a, "p")[0])[0]),
      properties = children(body(), a, "p").map((p) =>
        serialize(one(p, a, "pPr")!),
      );
    select(6, 9);
    const parent = vi.fn();
    root.parentElement!.addEventListener("beforeinput", parent);
    expect(beforeInput(root, "insertText", "汉字").defaultPrevented).toBe(true);
    expect(parent).not.toHaveBeenCalled();
    expect(editor().value).toBe("Alpha 汉字文\ntail\nSecond 👩‍💻IME\nThird");
    expect(serialize(textRuns(children(body(), a, "p")[0])[0])).toBe(latin);
    expect(
      children(body(), a, "p").map((p) => serialize(one(p, a, "pPr")!)),
    ).toEqual(properties);
    expect(
      one(
        textRuns(children(body(), a, "p")[0]).find(
          (run) => runText(run) === "文",
        )!,
        a,
        "rPr",
      )!.getAttribute("custom"),
    ).toBe("retained");
    expect(presentationEditorText(root)).toBe(editor().value);
  });

  it("IME原生临时DOM在compositionend合并最小diff，尾随input不重复应用", async () => {
    const { root, controller, editor, body, select } = await setup();
    const latin = serialize(textRuns(children(body(), a, "p")[0])[0]);
    select(6, 10);
    const initial = editor().bodyXml;
    const completed = vi.spyOn(controller, "textHandleCompositionEnd");
    composition(root, "compositionstart");
    expect(
      beforeInput(root, "insertCompositionText", "组合😀", {
        isComposing: true,
      }).defaultPrevented,
    ).toBe(false);
    const text = run(root, 0, 1);
    text.textContent = "组合😀";
    selectionAt(root, text.firstChild!, 4);
    input(root, { inputType: "insertCompositionText", isComposing: true });
    expect(editor().bodyXml).toBe(initial);
    composition(root, "compositionend");
    expect(editor().value).toBe("Alpha 组合😀\ntail\nSecond 👩‍💻IME\nThird");
    expect(completed).toHaveBeenCalledTimes(1);
    const final = editor().bodyXml;
    input(root, { inputType: "insertCompositionText" });
    expect(editor().bodyXml).toBe(final);
    expect(serialize(textRuns(children(body(), a, "p")[0])[0])).toBe(latin);
    expect(textRuns(children(body(), a, "p")[0]).map(runText)).toEqual([
      "Alpha ",
      "组合😀",
      "\n",
      "tail",
    ]);
  });

  it("不可取消的正常原生输入回收为最小diff，非法Unicode输入强制恢复DOM", async () => {
    const { root, editor, body, select } = await setup();
    select(6);
    const properties = serialize(
      one(textRuns(children(body(), a, "p")[0])[0], a, "rPr")!,
    );
    expect(
      beforeInput(root, "insertText", "N", { cancelable: false })
        .defaultPrevented,
    ).toBe(false);
    run(root, 0, 0).textContent = "Alpha N";
    selectionAt(root, run(root, 0, 0).firstChild!, 7);
    input(root, { inputType: "insertText", data: "N" });
    expect(editor().value.startsWith("Alpha N中😀文")).toBe(true);
    expect(
      serialize(one(textRuns(children(body(), a, "p")[0])[0], a, "rPr")!),
    ).toBe(properties);
    const before = editor().bodyXml;
    run(root, 0, 0).textContent = "Alpha \u0000";
    selectionAt(root, run(root, 0, 0).firstChild!, 7);
    input(root, { inputType: "insertText", data: "\u0000" });
    expect(editor().bodyXml).toBe(before);
    expect(presentationEditorText(root)).toBe(editor().value);
    expect(root.textContent).not.toContain("\u0000");
  });

  it("非法代理对selection不使用旧选区插入，unsupported/drop不能遗留原生DOM", async () => {
    const { root, editor } = await setup(),
      before = editor().bodyXml;
    selectionAt(root, run(root, 0, 1).firstChild!, 2);
    expect(beforeInput(root, "insertText", "WRONG").defaultPrevented).toBe(
      true,
    );
    expect(editor().bodyXml).toBe(before);
    for (const cancelable of [true, false]) {
      const event = beforeInput(root, "insertFromDrop", null, { cancelable });
      expect(event.defaultPrevented).toBe(cancelable);
      root.innerHTML =
        '<div onclick="unsafe()"><a href="https://example.invalid">DROPPED</a></div>';
      input(root, { inputType: "insertFromDrop" });
      expect(editor().bodyXml).toBe(before);
      expect(root.querySelector("a,[onclick]")).toBeNull();
      expect(presentationEditorText(root)).toBe(editor().value);
    }
    expect(beforeInput(root, "formatUnderline").defaultPrevented).toBe(true);
    const drop = new root.ownerDocument.defaultView!.Event("drop", {
      bubbles: true,
      cancelable: true,
    });
    root.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(editor().bodyXml).toBe(before);
  });

  it("按浏览器target range执行词/软行/硬行删除，不自行推算OS分词或使用旧选区", async () => {
    const { root, controller, editor, select } = await setup();
    const original = editor().value;
    for (const type of [
      "deleteWordBackward",
      "deleteWordForward",
      "deleteSoftLineBackward",
      "deleteSoftLineForward",
      "deleteHardLineBackward",
      "deleteHardLineForward",
    ]) {
      select(14);
      const first = run(root, 0, 0).firstChild!,
        next = run(root, 1, 0).firstChild!;
      expect(
        targetedInput(root, type, [
          {
            startContainer: first,
            startOffset: 1,
            endContainer: next,
            endOffset: 2,
          },
        ]).defaultPrevented,
      ).toBe(true);
      expect(editor().value).toBe(original.slice(0, 1) + original.slice(18));
      expect(controller.textOffsetAtPosition(editor().caret)).toBe(1);
      const applied = editor().bodyXml;
      input(root, { inputType: type });
      expect(editor().bodyXml).toBe(applied);
      expect(controller.textHandleBeforeInput("historyUndo")).toBe(true);
      expect(editor().value).toBe(original);
    }
  });

  it("缺失、多重、越界、空、反向、代理对内或非canonical的target range均受控拒绝", async () => {
    const { root, editor, select } = await setup();
    select(0, 5);
    const original = editor().bodyXml,
      outside = document.createTextNode("outside"),
      range = () => ({
        startContainer: run(root, 0, 0).firstChild!,
        startOffset: 0,
        endContainer: run(root, 0, 0).firstChild!,
        endOffset: 5,
      });
    for (const ranges of [
      () => undefined,
      () => [],
      () => [range(), range()],
      () => [{ ...range(), startContainer: outside }],
      () => [{ ...range(), startOffset: -1 }],
      () => [{ ...range(), endOffset: 100 }],
      () => [{ ...range(), startOffset: 5, endOffset: 1 }],
      () => [{ ...range(), endOffset: 0 }],
      () => [
        { ...range(), endContainer: run(root, 0, 1).firstChild!, endOffset: 2 },
      ],
    ]) {
      expect(
        targetedInput(root, "deleteWordBackward", ranges()).defaultPrevented,
      ).toBe(true);
      expect(editor().bodyXml).toBe(original);
      expect(presentationEditorText(root)).toBe(editor().value);
    }
    root.textContent = "uncontrolled";
    expect(
      targetedInput(root, "deleteHardLineForward", [
        {
          startContainer: root.firstChild!,
          startOffset: 0,
          endContainer: root.firstChild!,
          endOffset: 3,
        },
      ]).defaultPrevented,
    ).toBe(true);
    input(root, { inputType: "deleteHardLineForward" });
    expect(editor().bodyXml).toBe(original);
    expect(presentationEditorText(root)).toBe(editor().value);
  });

  it("Cmd/Ctrl+B/I与原生format事件每次真正切换，AltGr不触发快捷样式", async () => {
    const { root, editor, select } = await setup();
    select(6, 10);
    for (const [name, modifier] of [
      ["b", { metaKey: true }],
      ["i", { ctrlKey: true }],
    ] as const) {
      const property = name === "b" ? "bold" : "italic",
        initial = editor().style[property];
      expect(key(root, name, modifier).defaultPrevented).toBe(true);
      expect(editor().style[property]).toBe(!initial);
      key(root, name, modifier);
      expect(editor().style[property]).toBe(initial);
      const type = name === "b" ? "formatBold" : "formatItalic";
      expect(beforeInput(root, type).defaultPrevented).toBe(true);
      expect(editor().style[property]).toBe(!initial);
      beforeInput(root, type);
      expect(editor().style[property]).toBe(initial);
    }
    const before = editor().bodyXml;
    expect(
      key(root, "b", { ctrlKey: true, altKey: true }).defaultPrevented,
    ).toBe(false);
    expect(editor().bodyXml).toBe(before);
  });

  it("本地草稿快捷键和原生history事件共享undo/redo，空栈不退出或改全局历史", async () => {
    const { root, controller, editor, select, files } = await setup();
    select(6);
    const original = editor().value;
    beforeInput(root, "insertText", "A");
    const first = editor().value;
    beforeInput(root, "insertText", "B");
    const second = editor().value;
    key(root, "z", { ctrlKey: true });
    expect(editor().value).toBe(first);
    key(root, "z", { metaKey: true, shiftKey: true });
    expect(editor().value).toBe(second);
    expect(beforeInput(root, "historyUndo").defaultPrevented).toBe(true);
    expect(editor().value).toBe(first);
    expect(beforeInput(root, "historyRedo").defaultPrevented).toBe(true);
    expect(editor().value).toBe(second);
    key(root, "z", { metaKey: true });
    key(root, "y", { ctrlKey: true });
    expect(editor().value).toBe(second);
    for (let index = 0; index < 4; index++) key(root, "z", { metaKey: true });
    expect(editor().value).toBe(original);
    expect(controller.getSnapshot().canUndo).toBe(false);
    expect(controller.getSnapshot().textEditor).not.toBeNull();
    expect(files.write).not.toHaveBeenCalled();
  });

  it("clipboard按canonical plain/html复制剪切，rich paste和安全plain fallback均受控", async () => {
    const { root, editor, body, select } = await setup();
    select(0, 5);
    const copied = clipboard(root, "copy");
    expect(copied.event.defaultPrevented).toBe(true);
    expect(copied.values.get("text/plain")).toBe("Alpha");
    expect(copied.values.get("text/html")).toContain(
      "https://example.invalid/rich",
    );
    expect(copied.values.get("text/html")).toContain("font-weight:bold");
    const cut = clipboard(root, "cut");
    expect(cut.values.get("text/plain")).toBe("Alpha");
    expect(editor().value.startsWith(" 中😀文")).toBe(true);
    const afterCut = editor().bodyXml;
    input(root, { inputType: "deleteByCut" });
    expect(editor().bodyXml).toBe(afterCut);
    select(0);
    expect(
      clipboard(root, "paste", {
        "text/plain": "Rich link",
        "text/html":
          '<p><strong>Rich </strong><a href="https://example.invalid/pasted">link</a></p>',
      }).event.defaultPrevented,
    ).toBe(true);
    expect(editor().value.startsWith("Rich link 中😀文")).toBe(true);
    expect(
      body().getElementsByTagNameNS(a, "hlinkClick").length,
    ).toBeGreaterThan(2);
    expect(root.querySelector("a,script,img,[onclick]")).toBeNull();
    select(0);
    clipboard(root, "paste", {
      "text/plain": "plain <&>",
      "text/html": '<img src="https://example.invalid/remote.png">',
    });
    expect(editor().value.startsWith("plain <&>Rich link")).toBe(true);
  });

  it("clipboard不可用或写入异常不能原生paste/cut或删除canonical文字", async () => {
    const { root, editor, select } = await setup();
    select(0, 5);
    const before = editor().bodyXml;
    const missing = new root.ownerDocument.defaultView!.Event("paste", {
      bubbles: true,
      cancelable: true,
    });
    root.dispatchEvent(missing);
    expect(missing.defaultPrevented).toBe(true);
    const failed = new root.ownerDocument.defaultView!.Event("cut", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(failed, "clipboardData", {
      value: {
        setData() {
          throw new Error("clipboard unavailable");
        },
      },
    });
    root.dispatchEvent(failed);
    expect(failed.defaultPrevented).toBe(true);
    expect(editor().bodyXml).toBe(before);
    expect(presentationEditorText(root)).toBe(editor().value);
  });

  it("外部toolbar失焦保留canonical选区且不抢焦点；回到editor恢复DOM Range", async () => {
    const { root, host, controller, editor, select } = await setup(true);
    select(6, 9);
    const toolbar = document.createElement("div"),
      button = document.createElement("button");
    toolbar.dataset.presentationTextControls = "";
    toolbar.append(button);
    document.body.append(toolbar);
    cleanup.push(() => toolbar.remove());
    button.focus();
    root.ownerDocument.defaultView!.dispatchEvent(
      new root.ownerDocument.defaultView!.FocusEvent("blur"),
    );
    await ticks();
    expect(editor().selectedPlainText).toBe("中😀");
    expect(controller.textApplyStyle({ bold: true })).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(editor().selectedPlainText).toBe("中😀");
    // JSDOM 不联动 iframe 内外的 focus，显式模拟浏览上下文回焦。
    host.focus();
    root.focus();
    expect(document.activeElement).toBe(host);
    root.ownerDocument.defaultView!.dispatchEvent(
      new root.ownerDocument.defaultView!.FocusEvent("focus"),
    );
    const selection = root.ownerDocument.getSelection()!;
    expect(
      presentationEditorOffset(
        root,
        selection.anchorNode!,
        selection.anchorOffset,
      ),
    ).toBe(6);
    expect(
      presentationEditorOffset(
        root,
        selection.focusNode!,
        selection.focusOffset,
      ),
    ).toBe(9);
  });

  it("Escape取消零保存；Cmd+Enter和普通失焦提交；卸载后不再响应事件", async () => {
    const cancelled = await setup();
    beforeInput(cancelled.root, "insertText", "discard");
    expect(key(cancelled.root, "Escape").defaultPrevented).toBe(true);
    expect(cancelled.controller.getSnapshot().textEditor).toBeNull();
    expect(cancelled.controller.getSnapshot().dirty).toBe(false);
    expect(cancelled.disk()).toEqual(cancelled.original);
    expect(cancelled.files.write).not.toHaveBeenCalled();
    cancelled.dispose();
    const committed = await setup();
    beforeInput(committed.root, "insertText", "commit");
    expect(
      key(committed.root, "Enter", { metaKey: true }).defaultPrevented,
    ).toBe(true);
    expect(committed.controller.getSnapshot().textEditor).toBeNull();
    expect(await committed.controller.flushPublicFile()).toBe(true);
    expect(committed.files.write).toHaveBeenCalledTimes(1);
    committed.dispose();
    const blurred = await setup(),
      button = document.createElement("button");
    document.body.append(button);
    cleanup.push(() => button.remove());
    beforeInput(blurred.root, "insertText", "blur");
    button.focus();
    await ticks();
    expect(blurred.controller.getSnapshot().textEditor).toBeNull();
    expect(await blurred.controller.flushEdits()).toBe(true);
    blurred.dispose();
    const state = blurred.controller.getSnapshot();
    key(blurred.root, "Escape");
    beforeInput(blurred.root, "insertText", "detached");
    expect(blurred.controller.getSnapshot()).toBe(state);
    const frameBlurred = await setup(true);
    beforeInput(frameBlurred.root, "insertText", "frame blur");
    button.focus();
    frameBlurred.root.ownerDocument.defaultView!.dispatchEvent(
      new frameBlurred.root.ownerDocument.defaultView!.FocusEvent("blur"),
    );
    await ticks();
    expect(frameBlurred.controller.getSnapshot().textEditor).toBeNull();
    expect(await frameBlurred.controller.flushEdits()).toBe(true);
  });
});
