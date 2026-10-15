import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ensureUserVisibleCapabilityReportSkill } from "./claw-chat-current-fixture-skills-workspace.mjs";
import {
  installComposerHistoryKeyboardObserverDom,
  summarizeComposerHistoryRecall,
  takeComposerHistoryKeyboardEventsDom,
  readComposerHistorySnapshot,
} from "./claw-chat-current-fixture-composer-history.mjs";

let root;
let skillIdentity;
let alias;
let foreign;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "composer-history-identity-"));
  const skill = ensureUserVisibleCapabilityReportSkill({ env: { HOME: root } });
  skillIdentity = skill.skillIdentity;
  const aliasDirectory = path.join(root, "alias");
  fs.symlinkSync(skill.skillDirectory, aliasDirectory, "junction");
  alias = path.join(aliasDirectory, "SKILL.md");
  const foreignDirectory = path.join(root, "other", "capability-report");
  fs.mkdirSync(foreignDirectory, { recursive: true });
  foreign = path.join(foreignDirectory, "SKILL.md");
  fs.copyFileSync(skillIdentity.path, foreign);
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

function fixture() {
  const expandedText = `正文 ${"中😀\n".repeat(350)} /${skillIdentity.key}`;
  const input = [
    { type: "text", text: `/${skillIdentity.name} ${expandedText}` },
    { type: "skill", name: skillIdentity.name, path: skillIdentity.path },
  ];
  const trace = [
    {
      command: "app_server_handle_json_lines",
      transport: "electron-ipc",
      status: "success",
      args_preview: {
        request: {
          lines: [
            JSON.stringify({
              id: "history-submit",
              method: "turn/start",
              params: {
                threadId: "history-thread",
                clientUserMessageId: "history-client",
                input,
              },
            }),
          ],
        },
      },
    },
  ];
  const live = {
    electron: true,
    preload: true,
    editorCount: 1,
    sessionId: "history-session",
    disabled: false,
    traceRaw: JSON.stringify(trace),
  };
  const tokens = [
    {
      type: "paste",
      id: "paste-1",
      name: null,
      path: null,
      label: "[Pasted text 1: 1400 characters]",
      editable: "false",
    },
    {
      type: "skill",
      id: skillIdentity.key,
      name: skillIdentity.name,
      path: skillIdentity.path,
      label: `/${skillIdentity.key}`,
      editable: "false",
    },
  ];
  const prepared = {
    ...live,
    text: `正文 ${tokens[0].label} ${tokens[1].label}`,
    documentProjection: [
      { type: "p", content: [{ type: "text", text: "正文 " }, ...tokens] },
    ],
    marks: { links: [], codeBlocks: [], blockTags: ["P"] },
    tokens,
    images: [{ src: "data:image/png;base64,aW1hZ2U=", decoded: true }],
    paths: [
      {
        id: "file:/fixture/a.ts",
        path: "/fixture/a.ts",
        name: "a.ts",
        isDir: "false",
      },
    ],
    capability: {
      panelObserved: true,
      active: true,
      selectionLabel: `技能能力已挂载 ${skillIdentity.name}清空技能`,
    },
  };
  const cleared = {
    ...live,
    text: "",
    documentProjection: [{ type: "p", content: [] }],
    marks: { links: [], codeBlocks: [], blockTags: ["P"] },
    tokens: [],
    images: [],
    paths: [],
    capability: { panelObserved: true, active: false, selectionLabel: null },
  };
  const beforeRead = {
    ipcObservation: {
      electron: true,
      fallback: false,
      transport: "electron-ipc",
      status: "success",
      command: "app_server_handle_json_lines",
      method: "thread/read",
      requestId: "history-read",
      responseId: "history-read",
      params: { threadId: "history-thread" },
    },
    result: {
      thread: {
        id: "history-thread",
        turns: [
          {
            id: "history-turn",
            items: [
              {
                type: "userMessage",
                id: "history-item",
                clientId: "history-client",
                content: input,
              },
            ],
          },
        ],
      },
    },
  };
  return {
    prepared,
    cleared,
    recalled: structuredClone(prepared),
    returned: structuredClone(cleared),
    beforeRead,
    afterRead: structuredClone(beforeRead),
    threadId: "history-thread",
    sessionId: "history-session",
    skillIdentity: { ...skillIdentity },
    expandedText,
    expectedSubmission: {
      text: `/${skillIdentity.name} ${expandedText}`,
      displayText: `正文 ${tokens[0].label} ${tokens[1].label}`,
      textElements: [],
      marks: { links: [], codeBlocks: [], blockTags: ["P"] },
    },
    backendText: `/${skillIdentity.name} ${expandedText}`,
    keyboardActions: [
      "ControlOrMeta+Home",
      "ArrowUp",
      "ControlOrMeta+End",
      "ArrowDown",
    ],
    keyboardEvents: ["ArrowUp", "ArrowDown"].map((key) => ({
      key,
      trusted: true,
      defaultPrevented: true,
      sessionId: "history-session",
      focused: true,
    })),
    imageDataUrl: prepared.images[0].src,
    pathReference: structuredClone(prepared.paths[0]),
  };
}

describe("Composer history keyboard observation order", () => {
  function editor() {
    const node = document.createElement("div");
    node.tabIndex = 0;
    node.dataset.sessionId = "history-session";
    document.body.append(node);
    node.focus();
    return node;
  }

  function press(node, key, cancelable = true) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable,
    });
    node.dispatchEvent(event);
    return event;
  }

  afterEach(() => {
    if (window.__composerHistoryObserver)
      takeComposerHistoryKeyboardEventsDom();
    document.body.replaceChildren();
  });

  it("samples consumed keys after the editor handler even when capture observed false", () => {
    const node = editor();
    const captureValues = [];
    node.addEventListener(
      "keydown",
      (event) => captureValues.push(event.defaultPrevented),
      true,
    );
    node.addEventListener("keydown", (event) => event.preventDefault());
    installComposerHistoryKeyboardObserverDom(node);
    press(node, "ArrowUp");
    press(node, "ArrowDown");
    expect(captureValues).toEqual([false, false]);
    expect(takeComposerHistoryKeyboardEventsDom()).toEqual(
      ["ArrowUp", "ArrowDown"].map((key) => ({
        key,
        trusted: false,
        sessionId: "history-session",
        focused: true,
        defaultPrevented: true,
      })),
    );
  });

  it("does not attribute cancellation by a later ancestor to the editor", () => {
    const node = editor();
    installComposerHistoryKeyboardObserverDom(node);
    const parent = document.createElement("section");
    node.replaceWith(parent);
    parent.append(node);
    node.focus();
    parent.addEventListener("keydown", (event) => event.preventDefault());
    const event = press(node, "ArrowUp");
    expect(event.defaultPrevented).toBe(true);
    expect(takeComposerHistoryKeyboardEventsDom()[0].defaultPrevented).toBe(
      false,
    );
  });

  it.each(["unhandled", "noncancelable"])(
    "preserves %s keys as unconsumed",
    (mode) => {
      const node = editor();
      if (mode === "noncancelable")
        node.addEventListener("keydown", (event) => event.preventDefault());
      installComposerHistoryKeyboardObserverDom(node);
      press(node, "ArrowUp", mode !== "noncancelable");
      expect(takeComposerHistoryKeyboardEventsDom()[0].defaultPrevented).toBe(
        false,
      );
    },
  );

  it("preserves actual focus, session and synthetic-event trust instead of upgrading them", () => {
    const node = editor();
    node.dataset.sessionId = "foreign-session";
    node.blur();
    node.addEventListener("keydown", (event) => event.preventDefault());
    installComposerHistoryKeyboardObserverDom(node);
    press(node, "ArrowUp");
    expect(takeComposerHistoryKeyboardEventsDom()[0]).toMatchObject({
      trusted: false,
      focused: false,
      sessionId: "foreign-session",
      defaultPrevented: true,
    });
  });

  it("ignores other keys and removes the exact bubble listener when collecting", () => {
    const node = editor();
    installComposerHistoryKeyboardObserverDom(node);
    press(node, "Enter");
    press(node, "ArrowUp");
    const events = takeComposerHistoryKeyboardEventsDom();
    expect(events.map((event) => event.key)).toEqual(["ArrowUp"]);
    expect(window.__composerHistoryObserver).toBeUndefined();
    press(node, "ArrowDown");
    expect(events.map((event) => event.key)).toEqual(["ArrowUp"]);
  });
});

describe("real keyboard Composer history evidence", () => {
  it("reads link/code metadata through the real serialized history DOM observer", async () => {
    const node = document.createElement("div");
    node.setAttribute("data-testid", "composer-editor");
    node.setAttribute("role", "textbox");
    node.setAttribute("data-session-id", "history-session");
    node.setAttribute("contenteditable", "true");
    node.innerHTML =
      '<p>first</p><p><span role="link" text-link-href="https://example.invalid/marks" text-link-title="标题" aria-disabled="false">中😀</span></p><div data-composer-code-block="true"><div data-composer-code-block-toolbar="true" contenteditable="false">TypeScript</div><pre dir="ltr"><code class="hljs language-typescript">  <span class="hljs-keyword">const</span> value = \'中😀\';\n````\n\n</code></pre></div><p>tail</p>';
    document.body.append(node);
    vi.spyOn(node, "getClientRects").mockReturnValue([{}]);
    try {
      const page = {
        evaluate: async (fn, arg) =>
          new Function(`return (${fn.toString()});`)()(arg),
      };
      const prepared = await readComposerHistorySnapshot(
        page,
        "history-session",
      );
      expect(prepared.marks.links[0]).toMatchObject({
        href: "https://example.invalid/marks",
        title: "标题",
        label: "中😀",
        isAutolink: false,
      });
      expect(prepared.marks.codeBlocks[0]).toEqual({
        language: "typescript",
        body: "  const value = '中😀';\n````\n\n",
        validStructure: true,
        hardBreakCount: 0,
        keywordTokens: ["const"],
      });
      node
        .querySelector("span")
        .setAttribute("text-link-href", "https://example.invalid/wrong");
      node.querySelector(
        '[data-composer-code-block-toolbar="true"]',
      ).textContent = "Language picker";
      const recalled = await readComposerHistorySnapshot(
        page,
        "history-session",
      );
      expect(recalled.text).toBe(prepared.text);
      expect(recalled.documentProjection).toEqual(prepared.documentProjection);
      expect(recalled.marks).not.toEqual(prepared.marks);
    } finally {
      node.remove();
      vi.restoreAllMocks();
    }
  });

  it("rejects history without an independent submission expectation", () => {
    const input = fixture();
    delete input.expectedSubmission;
    expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
  });
  it("rejects matching prepared/recalled wrong link semantics against the independent sample", () => {
    const input = fixture();
    input.expectedMarks = {
      links: [
        {
          href: "https://example.invalid/marks",
          title: "标题",
          label: "中😀",
          role: "link",
          disabled: false,
          isAutolink: false,
          isGeneratedAutolink: false,
        },
      ],
      codeBlocks: [
        {
          language: "ts",
          body: "  中😀\n````\n\n",
          validStructure: true,
          hardBreakCount: 0,
        },
      ],
      blockTags: ["P", "P", "PRE", "P"],
    };
    input.prepared.marks = structuredClone(input.expectedMarks);
    input.recalled.marks = structuredClone(input.expectedMarks);
    input.prepared.marks.links[0].href = "https://example.invalid/wrong";
    input.recalled.marks.links[0].href = "https://example.invalid/wrong";
    expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
  });
  it.each([
    "missing-prefix",
    "wrong-prefix",
    "double-prefix",
    "suffix",
    "truncated",
  ])(
    "rejects self-consistent wire/backend %s instead of deriving expected text from trace",
    (mode) => {
      const input = fixture();
      const expected = input.backendText;
      const changed = {
        "missing-prefix": input.expandedText,
        "wrong-prefix": `/foreign ${input.expandedText}`,
        "double-prefix": `/capability-report ${expected}`,
        suffix: `${expected} extra`,
        truncated: expected.slice(0, -1),
      }[mode];
      for (const snapshot of [input.cleared, input.returned]) {
        const trace = JSON.parse(snapshot.traceRaw);
        const request = JSON.parse(trace[0].args_preview.request.lines[0]);
        request.params.input[0].text = changed;
        trace[0].args_preview.request.lines = [JSON.stringify(request)];
        snapshot.traceRaw = JSON.stringify(trace);
      }
      for (const read of [input.beforeRead, input.afterRead])
        read.result.thread.turns[0].items[0].content[0].text = changed;
      input.backendText = changed;
      expect(summarizeComposerHistoryRecall(input)).toMatchObject({
        acceptedSubmissionObserved: false,
        noAdditionalInput: false,
        submissionDiagnostics: {
          checks: { wireTextMatched: false, backendTextMatched: false },
        },
      });
    },
  );

  it.each([
    "status",
    "client",
    "empty-client",
    "duplicate-text",
    "duplicate-request",
  ])(
    "rejects accepted submission %s evidence despite matching routed text",
    (mode) => {
      const input = fixture();
      for (const snapshot of [input.cleared, input.returned]) {
        const trace = JSON.parse(snapshot.traceRaw);
        const request = JSON.parse(trace[0].args_preview.request.lines[0]);
        if (mode === "status") trace[0].status = "error";
        if (mode === "client")
          request.params.clientUserMessageId = "foreign-client";
        if (mode === "empty-client") request.params.clientUserMessageId = "";
        if (mode === "duplicate-text")
          request.params.input.push({ type: "text", text: "extra" });
        trace[0].args_preview.request.lines = [JSON.stringify(request)];
        if (mode === "duplicate-request") trace.push(structuredClone(trace[0]));
        snapshot.traceRaw = JSON.stringify(trace);
      }
      expect(
        summarizeComposerHistoryRecall(input).acceptedSubmissionObserved,
      ).toBe(false);
      expect(summarizeComposerHistoryRecall(input).noAdditionalInput).toBe(
        false,
      );
    },
  );

  it("reports failed acceptance predicates without exposing text, media or Skill files", () => {
    const input = fixture();
    input.backendText = `/capability-report /capability-report ${input.expandedText}`;
    const result = summarizeComposerHistoryRecall(input);
    expect(result.acceptedSubmissionObserved).toBe(false);
    expect(result.submissionDiagnostics).toMatchObject({
      traceParsed: true,
      beforeInputRequestCount: 1,
      afterInputRequestCount: 1,
      requestBoundaryUnchanged: true,
      canonicalClientId: "history-client",
      checks: {
        canonicalClientMatched: true,
        wireTextMatched: true,
        skillIdentityMatched: true,
        backendTextMatched: false,
      },
      requests: [
        {
          method: "turn/start",
          transport: "electron-ipc",
          status: "success",
          clientUserMessageId: "history-client",
          inputTypes: ["text", "skill"],
        },
      ],
    });
    expect(result.submissionDiagnostics.backendTextIdentity.sha256).not.toBe(
      result.submissionDiagnostics.expectedWireTextIdentity.sha256,
    );
    const serialized = JSON.stringify(result.submissionDiagnostics);
    for (const privateValue of [
      input.expandedText,
      input.imageDataUrl,
      skillIdentity.path,
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it("fails closed on malformed trace without exposing the raw buffer", () => {
    const input = fixture();
    input.cleared.traceRaw = "private malformed trace";
    const result = summarizeComposerHistoryRecall(input);
    expect(result.acceptedSubmissionObserved).toBe(false);
    expect(result.noAdditionalInput).toBe(false);
    expect(result.submissionDiagnostics).toEqual({ traceParsed: false });
  });

  it.each(["name", "path", "missing"])(
    "rejects unchanged canonical %s drift from the expected Skill file",
    (mode) => {
      const input = fixture();
      for (const read of [input.beforeRead, input.afterRead]) {
        const skill = read.result.thread.turns[0].items[0].content[1];
        if (mode === "name") skill.name = "Capability Report";
        else
          skill.path =
            mode === "path" ? foreign : path.join(root, "missing", "SKILL.md");
      }
      expect(
        summarizeComposerHistoryRecall(input).canonicalInputUnchanged,
      ).toBe(false);
    },
  );

  it("accepts a recalled filesystem alias to the same Skill file", () => {
    const input = fixture();
    input.recalled.tokens[1].path = alias;
    expect(summarizeComposerHistoryRecall(input).ok).toBe(true);
  });

  it.each(["name", "path", "missing", "id", "label"])(
    "rejects matching prepared/recalled %s drift from the actual fixture",
    (mode) => {
      const input = fixture();
      for (const snapshot of [input.prepared, input.recalled]) {
        const token = snapshot.tokens[1];
        if (mode === "name") token.name = "Capability Report";
        if (mode === "id") token.id = "project:capability-report";
        if (mode === "label") token.label = "/project:capability-report";
        if (mode === "path") token.path = foreign;
        if (mode === "missing")
          token.path = path.join(root, "missing", "SKILL.md");
      }
      expect(summarizeComposerHistoryRecall(input).tokenIdentityPreserved).toBe(
        false,
      );
      expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
    },
  );

  it.each(["trusted", "defaultPrevented", "sessionId", "focused"])(
    "rejects missing real keyboard %s evidence",
    (field) => {
      const input = fixture();
      delete input.keyboardEvents[0][field];
      expect(summarizeComposerHistoryRecall(input).keyboardObserved).toBe(
        false,
      );
    },
  );

  it("requires actual fixture resource identities before accepting preserved projections", () => {
    const input = fixture();
    input.imageDataUrl = "data:image/png;base64,foreign";
    expect(summarizeComposerHistoryRecall(input).imagesPreserved).toBe(false);
    input.pathReference.path = "/foreign";
    expect(summarizeComposerHistoryRecall(input).pathIdentityPreserved).toBe(
      false,
    );
  });

  it("requires accepted clear, full visible rich recall, empty return and unchanged canonical input", () => {
    expect(summarizeComposerHistoryRecall(fixture())).toMatchObject({
      ok: true,
      itemId: "history-item",
      documentSource: "read-only rendered DOM",
      pasteSourceAfterRecallObserved: false,
    });
  });

  it.each(["prepared", "cleared", "recalled", "returned"])(
    "rejects foreign or duplicate %s editors",
    (field) => {
      const input = fixture();
      input[field].sessionId = "foreign";
      expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
      input[field].sessionId = input.sessionId;
      input[field].editorCount = 2;
      expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
    },
  );

  it.each([
    "document",
    "paste-id",
    "paste-label",
    "skill-path",
    "image",
    "image-decode",
    "path",
    "path-id",
    "capability",
  ])("rejects recalled %s drift", (mode) => {
    const input = fixture();
    const recalled = input.recalled;
    if (mode === "document")
      recalled.documentProjection[0].content[0].text = "changed";
    if (mode === "paste-id") recalled.tokens[0].id = "other-paste";
    if (mode === "paste-label")
      recalled.tokens[0].label = "[Pasted different text]";
    if (mode === "skill-path") recalled.tokens[1].path = "/foreign/SKILL.md";
    if (mode === "image")
      recalled.images[0].src = "data:image/png;base64,b3RoZXI=";
    if (mode === "image-decode") recalled.images[0].decoded = false;
    if (mode === "path") recalled.paths[0].path = "/foreign/a.ts";
    if (mode === "path-id") recalled.paths[0].id = "other-reference";
    if (mode === "capability") recalled.capability.active = false;
    expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
  });

  it.each(["tokens", "images", "paths", "capability"])(
    "rejects resources retained after ArrowDown: %s",
    (field) => {
      const input = fixture();
      input.returned[field] = structuredClone(input.prepared[field]);
      expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
    },
  );

  it.each([
    "client",
    "item",
    "content",
    "turn",
    "duplicate",
    "read-thread",
    "read-response",
  ])("rejects canonical %s drift", (mode) => {
    const input = fixture();
    const read = input.afterRead;
    const turn = read.result.thread.turns[0];
    if (mode === "client") turn.items[0].clientId = "foreign";
    if (mode === "item") turn.items[0].id = "foreign";
    if (mode === "content") turn.items[0].content[0].text = "other";
    if (mode === "turn") turn.id = "foreign";
    if (mode === "duplicate") turn.items.push(structuredClone(turn.items[0]));
    if (mode === "read-thread") read.ipcObservation.params.threadId = "foreign";
    if (mode === "read-response") read.ipcObservation.responseId = "foreign";
    expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
  });

  it.each([
    "turn/start",
    "turn/steer",
    "thread/queue/add",
    "thread/queue/update",
    "thread/queue/start",
  ])("rejects additional %s after keyboard navigation", (method) => {
    const input = fixture();
    const trace = JSON.parse(input.returned.traceRaw);
    trace.push({
      ...trace[0],
      args_preview: {
        request: {
          lines: [
            JSON.stringify({
              id: "extra-input",
              method,
              params: {
                threadId: input.threadId,
                input: [{ type: "text", text: "extra" }],
              },
            }),
          ],
        },
      },
    });
    input.returned.traceRaw = JSON.stringify(trace);
    expect(summarizeComposerHistoryRecall(input).noAdditionalInput).toBe(false);
  });

  it.each([
    "keyboard",
    "backend",
    "missing-trace",
    "malformed-trace",
    "not-cleared",
  ])("rejects insufficient %s evidence", (mode) => {
    const input = fixture();
    if (mode === "keyboard") input.keyboardActions = ["ArrowUp", "ArrowDown"];
    if (mode === "backend") input.backendText = input.prepared.text;
    if (mode === "missing-trace") input.returned.traceRaw = "[]";
    if (mode === "malformed-trace") input.cleared.traceRaw = "not-json";
    if (mode === "not-cleared") input.cleared.text = input.prepared.text;
    expect(summarizeComposerHistoryRecall(input).ok).toBe(false);
  });
});
