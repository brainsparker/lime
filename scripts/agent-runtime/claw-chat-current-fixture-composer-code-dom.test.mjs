import { afterEach, describe, expect, it, vi } from "vitest";
import { readComposerHistorySnapshot } from "./claw-chat-current-fixture-composer-history.mjs";
const BODY = "  const value = '中😀';\n````\n\n";
let host;
function mount() {
  host = document.createElement("div");
  host.innerHTML =
    '<div data-testid="composer-editor" role="textbox" data-session-id="modern-history" contenteditable="true"><p>前 <span text-link-href="https://example.invalid/marks" text-link-title="标题" role="link" aria-disabled="false">中😀</span></p><div data-composer-code-block="true"><div data-composer-code-block-toolbar="true" contenteditable="false">Auto JavaScript</div><pre dir="ltr"><code class="hljs language-typescript">  <span class="hljs-keyword">const</span> value = <span class="hljs-string">\'中😀\'</span>;\n````\n\n</code></pre></div><p><span data-composer-token="paste" data-composer-id="paste-1" contenteditable="false">[Pasted text]</span> <span data-composer-token="skill" data-composer-id="user:capability-report" data-composer-name="capability-report" data-composer-path="/fixture/SKILL.md" contenteditable="false">/user:capability-report</span> 尾 </p></div>';
  document.body.append(host);
  const editor = host.firstChild;
  vi.spyOn(editor, "getClientRects").mockReturnValue([{}]);
  return editor;
}
const read = () =>
  readComposerHistorySnapshot(
    { evaluate: (fn, arg) => fn(arg) },
    "modern-history",
  );
afterEach(() => {
  host?.remove();
  vi.restoreAllMocks();
});
describe("modern code history document projection", () => {
  it("captures canonical body and atoms while excluding toolbar and highlight arrangement", async () => {
    const editor = mount();
    const before = await read();
    expect(before.text).toBe(
      `前 中😀\n${BODY}\n[Pasted text] /user:capability-report 尾 `,
    );
    expect(before.documentProjection[1]).toEqual({
      type: "code_block",
      language: "typescript",
      content: [{ type: "text", text: BODY }],
    });
    expect(before.tokens).toHaveLength(2);
    expect(before.tokens.map((token) => token.id)).toEqual([
      "paste-1",
      "user:capability-report",
    ]);
    expect(before.marks.links).toEqual([
      {
        label: "中😀",
        href: "https://example.invalid/marks",
        title: "标题",
        role: "link",
        disabled: false,
        isAutolink: false,
        isGeneratedAutolink: false,
      },
    ]);
    editor.querySelector(
      '[data-composer-code-block-toolbar="true"]',
    ).textContent = "TypeScript picker search";
    editor.querySelector("code").replaceChildren(document.createTextNode(BODY));
    const after = await read();
    expect(after.text).toBe(before.text);
    expect(after.documentProjection).toEqual(before.documentProjection);
    expect(after.tokens).toEqual(before.tokens);
    expect(after.marks.codeBlocks[0].keywordTokens).toEqual([]);
    expect(after.marks).not.toEqual(before.marks);
  });
  it.each([
    "body",
    "language",
    "old-dom",
    "lost-paste",
    "lost-skill",
    "link-href",
    "link-title",
    "toolbar-body",
  ])("exposes %s drift through the independent views", async (mode) => {
    const editor = mount();
    const before = await read();
    const code = editor.querySelector("code");
    if (mode === "body") code.textContent = BODY.trim();
    if (mode === "language") code.className = "hljs language-javascript";
    if (mode === "old-dom") {
      const pre = code.parentElement;
      pre.setAttribute("data-composer-code-block", "true");
      code.setAttribute("data-language", "typescript");
      pre.parentElement.replaceWith(pre);
    }
    if (mode === "lost-paste")
      editor.querySelector('[data-composer-token="paste"]').remove();
    if (mode === "lost-skill")
      editor.querySelector('[data-composer-token="skill"]').remove();
    if (mode === "link-href")
      editor
        .querySelector("[text-link-href]")
        .setAttribute("text-link-href", "wrong");
    if (mode === "link-title")
      editor
        .querySelector("[text-link-title]")
        .setAttribute("text-link-title", "wrong");
    if (mode === "toolbar-body")
      code.prepend(document.createTextNode("TypeScript"));
    const after = await read();
    if (mode.startsWith("lost-")) expect(after.text).not.toBe(before.text);
    else expect(after.marks).not.toEqual(before.marks);
    if (
      ["body", "old-dom", "lost-paste", "lost-skill", "toolbar-body"].includes(
        mode,
      )
    )
      expect(after.documentProjection).not.toEqual(before.documentProjection);
    if (mode.startsWith("lost-")) expect(after.tokens).toHaveLength(1);
  });
});
