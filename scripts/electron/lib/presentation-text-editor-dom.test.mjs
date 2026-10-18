import assert from "node:assert/strict";
import { Script } from "node:vm";
import { JSDOM } from "jsdom";
import { it, onTestFinished } from "vitest";
import { presentationTextEditorMatches } from "./presentation-text-editor-dom.mjs";

// Playwright 序列化后的 callback 只有父 document 和显式入参，不带模块闭包。
const serialized = new Script(
  `(${presentationTextEditorMatches.toString()})(input)`,
);

function fixture(html, value) {
  const dom = new JSDOM(
    '<section data-testid="presentation-panel" data-status="ready"><iframe id="presentation-frame" sandbox="allow-same-origin"></iframe></section>',
  );
  onTestFinished(() => dom.window.close());
  const document = dom.window.document;
  const content = document.querySelector("iframe").contentDocument;
  content.body.innerHTML =
    '<main data-slide-id="512"><p id="projected">ORIGINAL_RENDERER_TEXT</p></main><button id="outside">Outside</button>';
  const editor = content.createElement("div");
  editor.setAttribute("data-presentation-text-editor", "");
  editor.setAttribute("contenteditable", "true");
  editor.setAttribute("role", "textbox");
  editor.tabIndex = 0;
  editor.innerHTML = html;
  content.querySelector("main").append(editor);
  editor.focus();
  const input = { selector: "#presentation-frame", value };
  return {
    document,
    content,
    editor,
    matches: (options = {}) =>
      serialized.runInNewContext({
        document,
        input: { ...input, ...options },
      }),
  };
}

it.each([
  [
    "mixed styled runs and Unicode",
    '<div data-text-paragraph="0"><span data-text-run="0">中文 👩🏽‍💻</span><span data-text-run="1" style="font-weight:700"> &lt;&amp;&gt; é</span></div>',
    "中文 👩🏽‍💻 <&> é",
  ],
  [
    "paragraph and soft-line boundaries",
    '<div data-text-paragraph="0"><span>第一段</span><br data-text-run="1"><span>软换行</span></div><div data-text-paragraph="1"><span>第二段</span></div>',
    "第一段\n软换行\n第二段",
  ],
  [
    "empty placeholder paragraph",
    '<div data-text-paragraph="0"><span data-text-run="0"></span><br data-text-placeholder=""></div>',
    "",
  ],
  [
    "leading, middle and trailing empty paragraphs",
    '<div><br data-text-placeholder=""></div><div><span>内容</span></div><div><br data-text-placeholder=""></div><div><br data-text-placeholder=""></div>',
    "\n内容\n\n",
  ],
  [
    "literal soft line distinct from placeholder",
    '<div><br data-text-run="0"></div><div><br data-text-placeholder=""></div>',
    "\n\n",
  ],
  [
    "native block elements and nested spans",
    "<p><b>one</b></p><p><i>two</i><br>tail</p><li>three</li>",
    "one\ntwo\ntail\nthree",
  ],
  ["literal whitespace preserved", "<div>  A&nbsp;B\t </div>", "  A\u00a0B\t "],
])("序列化父页面观察保留%s", (_name, html, value) => {
  const { matches } = fixture(html, value);
  assert.equal(matches(), true);
  assert.equal(matches({ value: `${value}changed` }), false);
});

it("精确读取段间换行，不将 textContent 拼接结果当作输入成功", () => {
  const { editor, matches } = fixture(
    "<div>first</div><div>second</div>",
    "first\nsecond",
  );
  assert.equal(editor.textContent, "firstsecond");
  assert.equal(matches(), true);
  assert.equal(matches({ value: editor.textContent }), false);
});

it("文字匹配但焦点已离开时不能证明活动草稿", () => {
  const { content, matches } = fixture("<div>draft</div>", "draft");
  assert.equal(matches(), true);
  content.querySelector("#outside").focus();
  assert.equal(matches(), false);
});

it("缺失 current 编辑器或 frame 时拒绝，旧 textarea 不充当替代", () => {
  const { content, editor, matches } = fixture("draft", "draft");
  assert.equal(matches({ selector: "#missing-frame" }), false);
  editor.remove();
  const old = content.createElement("textarea");
  old.value = "draft";
  content.body.append(old);
  old.focus();
  assert.equal(matches(), false);
});

it("flush 场景保留原 panel ready 条件", () => {
  const { document, matches } = fixture("draft", "draft");
  assert.equal(matches({ ready: true }), true);
  document.querySelector("section").setAttribute("data-status", "loading");
  assert.equal(matches(), true);
  assert.equal(matches({ ready: true }), false);
});

it("导航只排除活动编辑器文字，仍拒绝 renderer 提前投影草稿", () => {
  const { content, matches } = fixture("<div>NEW_DRAFT</div>", "NEW_DRAFT");
  assert.ok(content.querySelector("main").textContent.includes("NEW_DRAFT"));
  assert.equal(matches({ uncommittedSlideId: "512" }), true);
  content.querySelector("#projected").textContent = "NEW_DRAFT";
  assert.equal(matches({ uncommittedSlideId: "512" }), false);
});

it("读取不改动父/子 DOM、焦点或 selection", () => {
  const { document, content, editor, matches } = fixture(
    "<div><span>draft</span></div><div>next</div>",
    "draft\nnext",
  );
  const range = content.createRange();
  range.setStart(editor.firstChild.firstChild.firstChild, 2);
  range.collapse(true);
  const selection = content.getSelection();
  selection.addRange(range);
  const before = {
    parent: document.documentElement.outerHTML,
    content: content.documentElement.outerHTML,
    anchor: selection.anchorNode,
    offset: selection.anchorOffset,
  };
  assert.equal(matches({ ready: true, uncommittedSlideId: "512" }), true);
  assert.equal(document.documentElement.outerHTML, before.parent);
  assert.equal(content.documentElement.outerHTML, before.content);
  assert.equal(content.activeElement, editor);
  assert.equal(selection.anchorNode, before.anchor);
  assert.equal(selection.anchorOffset, before.offset);
});
