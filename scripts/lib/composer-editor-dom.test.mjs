import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  composerEditorSelector,
  fillComposerEditor,
  findVisibleComposerEditorsDom,
  readComposerEditor,
  readComposerEditorTextDom,
  withComposerEditorDom,
} from "./composer-editor-dom.mjs";

function editor(html, attributes = {}) {
  const element = document.createElement("div");
  element.setAttribute("data-testid", "composer-editor");
  element.setAttribute("role", "textbox");
  element.setAttribute("contenteditable", "true");
  element.setAttribute("data-session-id", "session-current");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

describe("Composer fixture DOM projection", () => {
  it.each(["  中😀\n````\n\n", ""])(
    "separates P/NodeView/P without flattening code whitespace %j",
    (body) => {
      const element = editor(
        '<p>first</p><div data-composer-code-block="true"><div data-composer-code-block-toolbar="true" contenteditable="false">Auto TypeScript</div><pre dir="ltr"><code class="hljs language-typescript"></code></pre></div><p>last</p>',
      );
      try {
        element.querySelector("code").textContent = body;
        expect(readComposerEditorTextDom(element)).toBe(`first\n${body}\nlast`);
      } finally {
        element.remove();
      }
    },
  );
  it("skips toolbar text while retaining nested syntax leaves and visible atoms", () => {
    const element = editor(
      '<p>lead <span data-composer-token="skill" data-composer-label="$capability-report" data-composer-display-name="Capability Report" contenteditable="false">Capability Report</span></p><div data-composer-code-block="true"><div data-composer-code-block-toolbar="true" contenteditable="false">Auto TypeScript search</div><pre dir="ltr"><code class="hljs language-typescript">  <span class="hljs-keyword">const</span> value = <span class="hljs-string">中😀</span>;\n````\n\n</code></pre></div><p><span data-composer-token="paste" contenteditable="false" data-payload="hidden">[Pasted text]</span> tail</p>',
    );
    expect(readComposerEditorTextDom(element)).toBe(
      "lead $capability-report\n  const value = 中😀;\n````\n\n\n[Pasted text] tail",
    );
    element.remove();
  });
  it("preserves whitespace and explicit hard breaks without the view trailing break", () => {
    const element = editor(
      '<p> lead <br>line<br><br class="ProseMirror-trailingBreak"></p>',
    );
    expect(readComposerEditorTextDom(element)).toBe(" lead \nline\n");
    element.remove();
  });

  it("joins paragraphs with one LF and preserves a real empty final paragraph", () => {
    const element = editor(
      '<p>first</p><p>second</p><p><br class="ProseMirror-trailingBreak"></p>',
    );
    expect(readComposerEditorTextDom(element)).toBe("first\nsecond\n");
    element.remove();
  });

  it("reads canonical mention labels separately from display names and paste payload", () => {
    const element = editor(
      '<p>Use <span data-composer-token="skill" data-composer-label="$capability-report" data-composer-display-name="Capability Report" contenteditable="false">Capability Report</span> <span data-composer-token="paste" contenteditable="false" data-payload="unseen full paste">[Pasted 80 lines]</span></p>',
    );
    expect(readComposerEditorTextDom(element)).toBe(
      "Use $capability-report [Pasted 80 lines]",
    );
    expect(readComposerEditor(element)).toMatchObject({
      sessionId: "session-current",
      disabled: false,
      connected: true,
    });
    element.remove();
  });

  it.each(["file", "skill", "plugin"])(
    "rejects a %s display name without its canonical label",
    (kind) => {
      const element = editor(
        `<p><span data-composer-token="${kind}">Display name</span></p>`,
      );
      try {
        expect(() => readComposerEditorTextDom(element)).toThrow(
          `Missing canonical Composer ${kind} label`,
        );
      } finally {
        element.remove();
      }
    },
  );

  it.each([
    { "aria-disabled": "true" },
    { contenteditable: "false" },
    { contenteditable: "inherit" },
  ])("fails closed for a noneditable projection %j", (attributes) => {
    const element = editor("<p>locked</p>", attributes);
    expect(readComposerEditor(element).disabled).toBe(true);
    element.remove();
  });

  it("rejects a foreign form element", () => {
    expect(() =>
      readComposerEditor(document.createElement("textarea")),
    ).toThrow("Missing current Composer editor DOM");
  });

  it("the serialized observer needs only DOM and its explicit callback argument", () => {
    const element = editor("<p>visible<br>text</p>");
    // Match a Node fixture callback, before a bundler rewrites imported names.
    const callback = withComposerEditorDom(
      new Function(
        "arg",
        "return readComposerEditorTextDom(document.querySelector(arg.selector));",
      ),
    );
    const serialized = new Function(`return (${callback.toString()});`)();
    expect(serialized({ selector: composerEditorSelector() })).toBe(
      "visible\ntext",
    );
    element.remove();
  });

  it("serializes the visibility observer without importing renderer state", () => {
    const current = editor("<p>current</p>");
    vi.spyOn(current, "getClientRects").mockReturnValue([{}]);
    const callback = withComposerEditorDom(
      new Function(
        "sessionId",
        "return findVisibleComposerEditorsDom(sessionId).length;",
      ),
    );
    const serialized = new Function(`return (${callback.toString()});`)();
    expect(serialized("session-current")).toBe(1);
    expect(serialized("foreign")).toBe(0);
    current.remove();
  });

  it("fills the scoped live contenteditable through Playwright before reading the DOM", async () => {
    const element = editor("<p>old</p>");
    const fill = vi.fn(async (text) => {
      element.replaceChildren(document.createElement("p"));
      element.firstChild.textContent = text;
    });
    const evaluate = vi.fn(async (fn) => fn(element));
    const locator = vi.fn(() => ({ fill, evaluate }));
    const snapshot = await fillComposerEditor(
      { locator },
      "new",
      "session-current",
    );
    expect(locator).toHaveBeenCalledWith(
      '[data-testid="composer-editor"][role="textbox"][data-session-id="session-current"]:visible',
    );
    expect(fill).toHaveBeenCalledWith("new");
    expect(snapshot.text).toBe("new");
    element.remove();
  });

  it("isolates hidden and foreign-session projections without choosing an arbitrary editor", () => {
    const current = editor("<p>current</p>");
    const hidden = editor("<p>hidden</p>");
    const foreign = editor("<p>foreign</p>", { "data-session-id": "other" });
    hidden.style.visibility = "hidden";
    for (const node of [current, hidden, foreign]) {
      vi.spyOn(node, "getClientRects").mockReturnValue([{}]);
    }
    expect(findVisibleComposerEditorsDom("session-current")).toEqual([current]);
    expect(findVisibleComposerEditorsDom("missing")).toEqual([]);
    hidden.style.visibility = "visible";
    expect(findVisibleComposerEditorsDom("session-current")).toEqual([
      current,
      hidden,
    ]);
    for (const node of [current, hidden, foreign]) node.remove();
  });

  it("escapes a session identity in the DOM selector", () => {
    expect(composerEditorSelector('a"\\b')).toBe(
      '[data-testid="composer-editor"][role="textbox"][data-session-id="a\\"\\\\b"]',
    );
  });

  it("main Composer fixtures cannot restore the retired textarea selector", () => {
    const retiredSelector = ["textarea[name=", '"agent-chat-message"]'].join(
      "",
    );
    const roots = [
      "scripts/agent-runtime",
      "scripts/electron",
      "scripts/harness",
    ];
    const found = [];
    for (const root of roots) {
      const visit = (directory) => {
        for (const entry of fs.readdirSync(directory, {
          withFileTypes: true,
        })) {
          const target = path.join(directory, entry.name);
          if (entry.isDirectory()) visit(target);
          else if (
            entry.name.endsWith(".mjs") &&
            fs.readFileSync(target, "utf8").includes(retiredSelector)
          ) {
            found.push(target);
          }
        }
      };
      visit(root);
    }
    expect(found).toEqual([]);
  });
});
