import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  composerMarksFixture,
  readComposerMarksDom,
  readComposerMarksSnapshotDom,
  withComposerMarksDom,
  installComposerCodeKeyboardObserverDom,
  takeComposerCodeKeyboardEventsDom,
  summarizeComposerCodeBoundary,
  summarizeComposerMarksCancel,
  placeComposerCodeCaretAtEndDom,
  buildComposerMarksScenarioAssertions,
} from "./claw-chat-current-fixture-composer-marks.mjs";

const PROMPT =
  "请结合这个截图、文件和 Capability Report 技能，先不要输出正文。";
const PASTE = "历史粘贴验证😀\n".repeat(180);
const BODY = "  const value = '中😀';\n````";
const EXPECTED_MARKS = {
  links: [
    {
      label: "中😀",
      href: "https://example.invalid/marks",
      title: "标题",
      role: "link",
      disabled: false,
      isAutolink: false,
      isGeneratedAutolink: false,
    },
  ],
  codeBlocks: [
    {
      language: "typescript",
      body: `${BODY}\n\n`,
      validStructure: true,
      hardBreakCount: 0,
      keywordTokens: ["const"],
    },
  ],
  blockTags: ["P", "P", "DIV", "P"],
};

function oracle() {
  return composerMarksFixture({
    prompt: PROMPT,
    skillIdentity: { name: "capability-report", key: "user:capability-report" },
    pasteText: PASTE,
  });
}

function snapshot(index = 2) {
  const marks = structuredClone(EXPECTED_MARKS);
  marks.codeBlocks[0].body = BODY + "\n".repeat(index);
  return {
    electron: true,
    preload: true,
    editorCount: 1,
    sessionId: "marks-session",
    disabled: false,
    marks,
    traceRaw: "[]",
  };
}

function read() {
  return {
    ipcObservation: {
      electron: true,
      fallback: false,
      transport: "electron-ipc",
      command: "app_server_handle_json_lines",
      status: "success",
      method: "thread/read",
      requestId: "marks-read",
      responseId: "marks-read",
      params: { threadId: "marks-thread" },
    },
    result: { thread: { id: "marks-thread", turns: [] } },
  };
}

function boundary() {
  return {
    snapshots: [0, 1, 2].map(snapshot),
    beforeRead: read(),
    afterRead: read(),
    sessionId: "marks-session",
    threadId: "marks-thread",
    events: [false, true].map((shiftKey) => ({
      key: "Enter",
      shiftKey,
      trusted: true,
      focused: true,
      defaultPrevented: true,
      insideCode: true,
      sessionId: "marks-session",
    })),
  };
}

function editor() {
  const node = document.createElement("div");
  node.setAttribute("data-testid", "composer-editor");
  node.setAttribute("role", "textbox");
  node.setAttribute("data-session-id", "marks-session");
  node.setAttribute("contenteditable", "true");
  node.innerHTML =
    '<p>prompt</p><p><span text-link-href="https://example.invalid/marks" text-link-title="标题" role="link" aria-disabled="false">中😀</span></p><div data-composer-code-block="true"><div data-composer-code-block-toolbar="true" contenteditable="false">TypeScript</div><pre dir="ltr"><code class="hljs language-typescript"></code></pre></div><p>tail</p>';
  const code = node.querySelector("code");
  code.append(document.createTextNode("  "));
  const keyword = document.createElement("span");
  keyword.className = "hljs-keyword";
  keyword.textContent = "const";
  code.append(keyword, document.createTextNode(" value = "));
  const string = document.createElement("span");
  string.className = "hljs-string";
  string.textContent = "'中😀'";
  code.append(string, document.createTextNode(";\n````\n\n"));
  document.body.append(node);
  vi.spyOn(node, "getClientRects").mockReturnValue([{}]);
  return node;
}

afterEach(() => {
  if (window.__composerCodeKeyboardObserver)
    takeComposerCodeKeyboardEventsDom();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("independent marks Markdown/UTF8 fixture", () => {
  it("keeps literal five-tick fences, code whitespace/newlines and fixed UTF8 slices", () => {
    const expected = oracle();
    expect(expected.marks).toEqual(EXPECTED_MARKS);
    expect(expected.text).toContain(
      "[中😀](https://example.invalid/marks \"标题\")\n`````typescript\n  const value = '中😀';\n````\n\n\n`````\n尾中😀 ",
    );
    const bytes = Buffer.from(expected.text, "utf8");
    expect(bytes.length).toBe(4362);
    expect(expected.textElements).toEqual([
      {
        byteRange: { start: 203, end: 4343 },
        placeholder: "[Pasted text 1: 1620 characters]",
      },
      {
        byteRange: { start: 4344, end: 4362 },
        placeholder: "$capability-report",
      },
    ]);
    expect(
      createHash("sha256").update(bytes.subarray(203, 4343)).digest("hex"),
    ).toBe("efe7ffb00ece5294d1cd2b7cac4533861af4b728d7988212acc3a9551b98cb0a");
    expect(bytes.subarray(4344, 4362).toString("utf8")).toBe(
      "$capability-report",
    );
    expect(expected.displayText).toContain(
      "中😀\n  const value = '中😀';\n````\n\n\n尾中😀",
    );
    expect(expected.displayText).not.toContain("https://");
  });
});

describe("actual rendered marks semantics", () => {
  it("observes the shipped span link/code DOM and ignores private attrs and trailingBreak", () => {
    const node = editor();
    node.querySelector("span").setAttribute("literal-source", "private");
    const br = document.createElement("br");
    br.className = "ProseMirror-trailingBreak";
    node.querySelector("code").append(br);
    expect(readComposerMarksDom(node)).toEqual(EXPECTED_MARKS);
    expect(JSON.stringify(readComposerMarksDom(node))).not.toContain("private");
  });

  it.each([
    "href",
    "title",
    "autolink",
    "generated",
    "disabled",
    "language",
    "body",
    "hard_break",
    "wrapper",
    "missing-link",
    "missing-code",
    "old-dom",
    "multiple-languages",
    "fake-highlight",
    "toolbar-body",
  ])("observes %s drift that plain text would hide", (mode) => {
    const node = editor();
    const link = node.querySelector("span");
    const code = node.querySelector("code");
    if (mode === "href")
      link.setAttribute("text-link-href", "https://example.invalid/wrong");
    if (mode === "title") link.setAttribute("text-link-title", "wrong");
    if (mode === "autolink") link.setAttribute("data-breakable-url", "true");
    if (mode === "generated")
      link.setAttribute("data-rich-text-generated-autolink", "true");
    if (mode === "disabled") link.setAttribute("aria-disabled", "true");
    if (mode === "language") code.className = "hljs language-javascript";
    if (mode === "multiple-languages")
      code.classList.add("language-javascript");
    if (mode === "fake-highlight")
      code.querySelector(".hljs-keyword").className = "hljs-string";
    if (mode === "toolbar-body")
      code.prepend(document.createTextNode("TypeScript"));
    if (mode === "old-dom") {
      const pre = code.parentElement;
      pre.setAttribute("data-composer-code-block", "true");
      code.setAttribute("data-language", "typescript");
      pre.parentElement.replaceWith(pre);
    }
    if (mode === "body") code.textContent = code.textContent.trim();
    if (mode === "hard_break") code.append(document.createElement("br"));
    if (mode === "wrapper") code.innerHTML = "<span>  中😀\n````\n\n</span>";
    if (mode === "missing-link") link.replaceWith(...link.childNodes);
    if (mode === "missing-code") code.parentElement.remove();
    expect(readComposerMarksDom(node)).not.toEqual(EXPECTED_MARKS);
  });

  it("serializes only explicit DOM observers without module imports or business state", () => {
    const node = editor();
    const callback = withComposerMarksDom(
      new Function(
        "arg",
        "return readComposerMarksDom(document.querySelector(arg.selector));",
      ),
    );
    const serialized = new Function(`return (${callback.toString()});`)();
    expect(serialized({ selector: '[data-testid="composer-editor"]' })).toEqual(
      EXPECTED_MARKS,
    );
    expect(node.textContent).toContain("中😀");
  });

  it("fails closed on hidden/duplicate/foreign editor observations", () => {
    const node = editor();
    const callback = withComposerMarksDom(readComposerMarksSnapshotDom);
    const foreign = callback({ sessionId: "foreign" });
    expect(foreign.editorCount).toBe(0);
    expect(foreign.marks).toBeNull();
    node.style.display = "none";
    expect(callback({ sessionId: "marks-session" }).editorCount).toBe(0);
    node.style.display = "block";
    editor();
    expect(callback({ sessionId: "marks-session" }).marks).toBeNull();
  });
});

describe("passive code keyboard evidence", () => {
  it("places caret at the final actual text leaf across nested highlight spans", () => {
    const node = editor();
    const code = node.querySelector("code");
    const nested = document.createElement("span");
    nested.className = "hljs-string";
    nested.innerHTML = '<span class="hljs-subst"></span>';
    nested.firstChild.textContent = code.lastChild.nodeValue;
    code.lastChild.replaceWith(nested);
    placeComposerCodeCaretAtEndDom(node);
    expect(window.getSelection().anchorNode).toBe(nested.firstChild.firstChild);
    expect(window.getSelection().anchorOffset).toBe(
      nested.firstChild.textContent.length,
    );
    expect(readComposerMarksDom(node)).toEqual(EXPECTED_MARKS);
  });
  it("observes consumed keys after the EditorView handler and keeps synthetic trust false", () => {
    const node = editor();
    node.focus();
    placeComposerCodeCaretAtEndDom(node);
    const text = node.querySelector("code").lastChild;
    expect(window.getSelection().anchorNode).toBe(text);
    expect(window.getSelection().anchorOffset).toBe(text.nodeValue.length);
    node.addEventListener("keydown", (event) => event.preventDefault());
    installComposerCodeKeyboardObserverDom(node);
    for (const shiftKey of [false, true])
      node.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    expect(takeComposerCodeKeyboardEventsDom()).toEqual(
      [false, true].map((shiftKey) => ({
        key: "Enter",
        shiftKey,
        trusted: false,
        focused: true,
        sessionId: "marks-session",
        defaultPrevented: true,
        insideCode: true,
      })),
    );
    expect(window.__composerCodeKeyboardObserver).toBeUndefined();
  });

  it("does not credit a later ancestor's preventDefault to the EditorView", () => {
    const node = editor();
    const parent = document.createElement("section");
    node.replaceWith(parent);
    parent.append(node);
    parent.addEventListener("keydown", (event) => event.preventDefault());
    installComposerCodeKeyboardObserverDom(node);
    node.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(takeComposerCodeKeyboardEventsDom()[0].defaultPrevented).toBe(false);
  });
});

describe("code Enter/ShiftEnter fail-closed boundary", () => {
  it("requires the complete input/semantic/real-read contract", () => {
    expect(summarizeComposerCodeBoundary(boundary()).ok).toBe(true);
  });
  it.each([
    "trusted",
    "focused",
    "defaultPrevented",
    "insideCode",
    "sessionId",
    "shiftKey",
  ])("rejects missing keyboard %s", (field) => {
    const input = boundary();
    delete input.events[0][field];
    expect(summarizeComposerCodeBoundary(input).ok).toBe(false);
  });
  it.each([
    "turn/start",
    "turn/steer",
    "thread/queue/add",
    "thread/queue/update",
    "thread/queue/start",
  ])("rejects unexpected %s even with valid code LF", (method) => {
    const input = boundary();
    input.snapshots[2].traceRaw = JSON.stringify([
      {
        command: "app_server_handle_json_lines",
        transport: "electron-ipc",
        status: "success",
        args_preview: {
          request: {
            lines: [
              JSON.stringify({
                id: "extra",
                method,
                params: {
                  threadId: "marks-thread",
                  input: [{ type: "text", text: "extra" }],
                },
              }),
            ],
          },
        },
      },
    ]);
    expect(summarizeComposerCodeBoundary(input).noInputRequest).toBe(false);
  });
  it.each([
    "missing-trace",
    "malformed-trace",
    "lf",
    "hard_break",
    "code",
    "link",
    "synthetic",
    "canonical",
    "foreign-read",
    "unobserved-read",
  ])("rejects %s evidence", (mode) => {
    const input = boundary();
    if (mode === "missing-trace") input.snapshots[2].traceRaw = null;
    if (mode === "malformed-trace") input.snapshots[1].traceRaw = "{}";
    if (mode === "lf") input.snapshots[2].marks.codeBlocks[0].body = BODY;
    if (mode === "hard_break")
      input.snapshots[1].marks.codeBlocks[0].hardBreakCount = 1;
    if (mode === "code") input.snapshots[2].marks.codeBlocks = [];
    if (mode === "link") input.snapshots[0].marks.links[0].href = "wrong";
    if (mode === "synthetic") input.events[0].trusted = false;
    if (mode === "canonical")
      input.afterRead.result.thread.turns.push({
        id: "unexpected",
        items: [{ type: "userMessage" }],
      });
    if (mode === "foreign-read") input.afterRead.result.thread.id = "foreign";
    if (mode === "unobserved-read") delete input.afterRead.ipcObservation;
    expect(summarizeComposerCodeBoundary(input).ok).toBe(false);
  });
});

describe("cancel restoration independent semantics", () => {
  function input() {
    const expectedSubmission = oracle();
    return {
      prepared: { ...snapshot(), text: expectedSubmission.displayText },
      restored: { ...snapshot(), text: expectedSubmission.displayText },
      expectedSubmission,
      sessionId: "marks-session",
    };
  }
  it("accepts the expected DOM and display contract", () =>
    expect(summarizeComposerMarksCancel(input()).ok).toBe(true));
  it.each(["href", "language", "lf", "display", "session", "missing"])(
    "rejects jointly preserved incorrect %s",
    (mode) => {
      const evidence = input();
      for (const value of [evidence.prepared, evidence.restored]) {
        if (mode === "href") value.marks.links[0].href = "wrong";
        if (mode === "language") value.marks.codeBlocks[0].language = "js";
        if (mode === "lf") value.marks.codeBlocks[0].body = BODY;
        if (mode === "display") value.text += "wrong";
        if (mode === "session") value.sessionId = "foreign";
        if (mode === "missing") delete value.marks;
      }
      expect(summarizeComposerMarksCancel(evidence).ok).toBe(false);
    },
  );
});

describe("rich fixture language Picker summary", () => {
  it("cannot accept marks preparation without the editing-only Picker boundary", () => {
    const summary = {
      inputbarRichRestoreDraftPrepared: {
        marks: { preparation: { ok: true }, codeBoundary: { ok: true } },
      },
    };
    expect(
      buildComposerMarksScenarioAssertions(summary)
        .inputbarRichRestoreCodePickerEditingOnly,
    ).toBe(false);
    summary.inputbarRichRestoreDraftPrepared.marks.pickerBoundary = {
      ok: true,
    };
    expect(
      buildComposerMarksScenarioAssertions(summary)
        .inputbarRichRestoreCodePickerEditingOnly,
    ).toBe(true);
  });
});
