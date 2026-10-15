import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installComposerCodePickerObserverDom,
  readComposerCodePickerDom,
  summarizeComposerCodePickerBoundary,
  takeComposerCodePickerEventsDom,
  withComposerCodePickerDom,
} from "./claw-chat-current-fixture-composer-code-picker.mjs";
const BODY = "  const value = '中😀';\n````";
const TEXT = `prompt\n${BODY}\n/user:capability-report [Pasted text]`;
const SESSION = "picker-session",
  THREAD = "picker-thread";
const CHOICES = ["auto", "plaintext", "typescript"];
function emptyRead() {
  return {
    ipcObservation: {
      electron: true,
      fallback: false,
      transport: "electron-ipc",
      command: "app_server_handle_json_lines",
      status: "success",
      method: "thread/read",
      requestId: "read",
      responseId: "read",
      params: { threadId: THREAD },
    },
    result: { thread: { id: THREAD, turns: [] } },
  };
}
// Manufactured unit evidence tests the oracle, never a native Gate.
function boundary() {
  const stages = CHOICES.map((selection) => {
    const language = selection === "auto" ? "javascript" : selection;
    const label =
      selection === "auto"
        ? "Auto · JavaScript"
        : selection === "plaintext"
          ? "Plain"
          : "TypeScript";
    const live = {
      electron: true,
      preload: true,
      editorCount: 1,
      sessionId: SESSION,
      disabled: false,
      blockCount: 1,
      body: BODY,
      text: TEXT,
      language,
      keywordTokens: selection === "plaintext" ? [] : ["const"],
      traceRaw: "[]",
      triggerLabel: label,
      triggerAriaLabel: `Language: ${label}`,
    };
    const closed = {
      ...live,
      menuCount: 0,
      menuOwned: false,
      expanded: false,
      editorFocused: true,
    };
    const inspected = {
      ...live,
      menuCount: 1,
      menuOwned: true,
      expanded: true,
      searchCount: 1,
      searchQuery: "",
      searchFocused: true,
      choices: CHOICES.map((value) => ({
        value,
        label:
          value === "auto"
            ? "Auto"
            : value === "plaintext"
              ? "Plain"
              : "TypeScript",
        checked: value === selection,
        highlighted: value === "auto",
      })),
    };
    const searched = {
      ...inspected,
      searchQuery: selection,
      choices: inspected.choices.filter((item) => item.value === selection),
    };
    return {
      selection,
      searched,
      selected: structuredClone(closed),
      inspected,
      closed,
    };
  });
  const events = CHOICES.flatMap((language) => [
    { kind: "open", trusted: true, sessionId: SESSION },
    { kind: "search", query: language, trusted: true, sessionId: SESSION },
    { kind: "select", language, trusted: true, sessionId: SESSION },
    { kind: "open", trusted: true, sessionId: SESSION },
    { kind: "close", key: "Escape", trusted: true, sessionId: SESSION },
  ]);
  return {
    stages,
    events,
    beforeRead: emptyRead(),
    afterRead: emptyRead(),
    sessionId: SESSION,
    threadId: THREAD,
    body: BODY,
    expectedText: TEXT,
  };
}
function dom() {
  const editor = document.createElement("div");
  editor.setAttribute("data-testid", "composer-editor");
  editor.setAttribute("role", "textbox");
  editor.setAttribute("contenteditable", "true");
  editor.dataset.sessionId = SESSION;
  editor.innerHTML =
    '<p>prompt</p><div data-composer-code-block="true"><div data-composer-code-block-toolbar="true" contenteditable="false"><button class="composer-code-language-trigger" aria-expanded="true" aria-controls="language-menu" aria-label="Choose language">TypeScript</button></div><pre dir="ltr"><code class="hljs language-typescript">  <span class="hljs-keyword">const</span> value = <span class="hljs-string">\'中😀\'</span>;\n````</code></pre></div><p><span data-composer-token="skill" contenteditable="false">/user:capability-report</span> <span data-composer-token="paste" contenteditable="false">[Pasted text]</span></p>';
  const menu = document.createElement("div");
  menu.className = "composer-code-language-menu";
  menu.id = "language-menu";
  menu.innerHTML =
    '<input role="combobox"><div data-code-language="auto" aria-selected="true"><svg class="invisible"></svg>Auto</div><div data-code-language="plaintext" aria-selected="false"><svg class="invisible"></svg>Plain</div><div data-code-language="typescript" aria-selected="false"><svg></svg>TypeScript</div>';
  document.body.append(editor, menu);
  for (const node of [editor, menu])
    vi.spyOn(node, "getClientRects").mockReturnValue([{}]);
  return {
    editor,
    menu,
    trigger: editor.querySelector("button"),
    search: menu.querySelector("input"),
  };
}
afterEach(() => {
  if (window.__composerCodePickerObserver) takeComposerCodePickerEventsDom();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("independent code Picker DOM observations", () => {
  it("observes owned Portal, actual code spans and Check rather than cmdk highlight", () => {
    const { search } = dom();
    search.focus();
    const reader = withComposerCodePickerDom(readComposerCodePickerDom);
    const snapshot = new Function(`return (${reader.toString()});`)()({
      sessionId: SESSION,
    });
    expect(snapshot).toMatchObject({
      body: BODY,
      text: TEXT,
      language: "typescript",
      keywordTokens: ["const"],
      menuCount: 1,
      menuOwned: true,
      searchCount: 1,
      searchFocused: true,
      searchQuery: "",
    });
    expect(
      snapshot.choices.filter((item) => item.checked).map((item) => item.value),
    ).toEqual(["typescript"]);
    expect(
      snapshot.choices
        .filter((item) => item.highlighted)
        .map((item) => item.value),
    ).toEqual(["auto"]);
  });
  it("serializes a wait predicate with Picker and DOM helpers in the same lexical chain", () => {
    dom();
    const predicate = withComposerCodePickerDom(
      new Function(
        "arg",
        "const snapshot = readComposerCodePickerDom(arg); return snapshot.menuOwned && snapshot.body === arg.body && snapshot.text === arg.text;",
      ),
    );
    const serialized = new Function(`return (${predicate.toString()});`)();
    expect(serialized({ sessionId: SESSION, body: BODY, text: TEXT })).toBe(
      true,
    );
    expect(serialized({ sessionId: "foreign", body: BODY, text: TEXT })).toBe(
      false,
    );
  });
  it.each([
    "foreign-menu",
    "duplicate-menu",
    "old-dom",
    "duplicate-language",
    "lost-atom",
    "toolbar-body",
    "fake-highlight",
  ])("exposes %s instead of inventing valid evidence", (mode) => {
    const { editor, menu } = dom();
    const code = editor.querySelector("code");
    if (mode === "foreign-menu") menu.id = "foreign";
    if (mode === "duplicate-menu") {
      const second = menu.cloneNode(true);
      document.body.append(second);
      vi.spyOn(second, "getClientRects").mockReturnValue([{}]);
    }
    if (mode === "old-dom") {
      const pre = code.parentElement;
      pre.setAttribute("data-composer-code-block", "true");
      pre.parentElement.replaceWith(pre);
    }
    if (mode === "duplicate-language")
      code.classList.add("language-javascript");
    if (mode === "lost-atom")
      editor.querySelector('[data-composer-token="paste"]').remove();
    if (mode === "toolbar-body")
      code.prepend(document.createTextNode("TypeScript"));
    if (mode === "fake-highlight")
      code.querySelector(".hljs-keyword").className = "hljs-string";
    const snapshot = withComposerCodePickerDom(readComposerCodePickerDom)({
      sessionId: SESSION,
    });
    if (mode.includes("menu")) expect(snapshot.menuOwned).toBe(false);
    if (mode === "old-dom") expect(snapshot.blockCount).toBe(0);
    if (mode === "duplicate-language") expect(snapshot.language).toBeNull();
    if (mode === "lost-atom") expect(snapshot.text).not.toBe(TEXT);
    if (mode === "toolbar-body") expect(snapshot.body).not.toBe(BODY);
    if (mode === "fake-highlight") expect(snapshot.keywordTokens).toEqual([]);
  });
  it("passively observes synthetic search/click/Escape with trust false and ignores foreign Portal", () => {
    const { editor, menu, trigger, search } = dom();
    installComposerCodePickerObserverDom(editor);
    trigger.click();
    search.value = "typescript";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    menu.querySelector('[data-code-language="typescript"]').click();
    search.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    menu.id = "foreign";
    menu.querySelector('[data-code-language="auto"]').click();
    expect(takeComposerCodePickerEventsDom()).toEqual([
      { kind: "open", trusted: false, sessionId: SESSION },
      {
        kind: "search",
        query: "typescript",
        trusted: false,
        sessionId: SESSION,
      },
      {
        kind: "select",
        language: "typescript",
        trusted: false,
        sessionId: SESSION,
      },
      { kind: "close", key: "Escape", trusted: false, sessionId: SESSION },
    ]);
    expect(window.__composerCodePickerObserver).toBeUndefined();
  });
});
describe("Picker fail-closed editing-only oracle", () => {
  it("requires Auto JavaScript, Plain and searched explicit TypeScript before sending", () =>
    expect(summarizeComposerCodePickerBoundary(boundary())).toMatchObject({
      ok: true,
      searchObserved: true,
      noInputRequest: true,
      noCanonicalTurn: true,
    }));
  it.each([
    "missing-stage",
    "order",
    "synthetic",
    "foreign-action",
    "missing-search",
    "wrong-query",
    "unfiltered",
    "unfocused-search",
    "foreign-menu",
    "wrong-check",
    "highlight-as-check",
    "wrong-auto",
    "wrong-final-language",
    "fake-highlight",
    "plain-highlight",
    "lost-atom",
    "toolbar-body",
    "lost-focus",
    "missing-trace",
    "malformed-trace",
    "canonical-turn",
    "foreign-read",
    "unobserved-read",
  ])("rejects %s", (mode) => {
    const input = boundary();
    if (mode === "missing-stage") input.stages.pop();
    if (mode === "order") input.stages.reverse();
    if (mode === "synthetic") input.events[1].trusted = false;
    if (mode === "foreign-action") input.events[2].sessionId = "foreign";
    if (mode === "missing-search") input.events.splice(1, 1);
    if (mode === "wrong-query") input.stages[2].searched.searchQuery = "java";
    if (mode === "unfiltered")
      input.stages[2].searched.choices.push({ value: "javascript" });
    if (mode === "unfocused-search")
      input.stages[2].searched.searchFocused = false;
    if (mode === "foreign-menu") input.stages[0].inspected.menuOwned = false;
    if (mode === "wrong-check")
      input.stages[2].inspected.choices[0].checked = true;
    if (mode === "highlight-as-check")
      input.stages[2].inspected.choices.forEach((item) => {
        item.checked = item.highlighted;
      });
    if (mode === "wrong-auto") input.stages[0].selected.language = "typescript";
    if (mode === "wrong-final-language") input.stages[2].closed.language = "ts";
    if (mode === "fake-highlight") input.stages[2].closed.keywordTokens = [];
    if (mode === "plain-highlight")
      input.stages[1].selected.keywordTokens = ["const"];
    if (mode === "lost-atom")
      input.stages[1].inspected.text = `prompt\n${BODY}`;
    if (mode === "toolbar-body")
      input.stages[2].closed.body = `TypeScript${BODY}`;
    if (mode === "lost-focus") input.stages[2].closed.editorFocused = false;
    if (mode === "missing-trace") input.stages[1].searched.traceRaw = null;
    if (mode === "malformed-trace") input.stages[1].closed.traceRaw = "{}";
    if (mode === "canonical-turn")
      input.afterRead.result.thread.turns.push({ id: "unexpected" });
    if (mode === "foreign-read")
      input.afterRead.ipcObservation.params.threadId = "foreign";
    if (mode === "unobserved-read") delete input.afterRead.ipcObservation;
    expect(summarizeComposerCodePickerBoundary(input).ok).toBe(false);
  });
  it.each([
    "turn/start",
    "turn/steer",
    "thread/queue/add",
    "thread/queue/update",
    "thread/queue/start",
  ])("rejects additional %s while searching", (method) => {
    const input = boundary();
    input.stages[2].searched.traceRaw = JSON.stringify([
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
                  threadId: THREAD,
                  input: [{ type: "text", text: BODY }],
                },
              }),
            ],
          },
        },
      },
    ]);
    expect(summarizeComposerCodePickerBoundary(input).noInputRequest).toBe(
      false,
    );
  });
});
