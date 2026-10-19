import { afterEach, describe, expect, it, vi } from "vitest";
import { readComposerAttachmentOwnerDom } from "./claw-chat-current-fixture-composer-image-upload.mjs";

function surface(sessionId = "current") {
  const element = document.createElement("div");
  element.innerHTML = `<section data-testid="inputbar-core-container"><div data-testid="composer-editor" role="textbox" contenteditable="true" data-session-id="${sessionId}"></div></section>`;
  document.body.append(element);
  const editor = element.querySelector('[data-testid="composer-editor"]');
  vi.spyOn(editor, "getClientRects").mockReturnValue([{}]);
  return { element, editor, core: element.querySelector("section") };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe("native Composer attachment ownership", () => {
  it("accepts one connected Composer without a browser file-input fallback", () => {
    const current = surface();
    expect(readComposerAttachmentOwnerDom(current.core, "current")).toEqual({
      matches: true,
      editorCount: 1,
      editorSessionId: "current",
    });
  });
  it("rejects another conversation's picker", () => {
    surface();
    expect(
      readComposerAttachmentOwnerDom(surface("foreign").core, "current")
        .matches,
    ).toBe(false);
  });
  it("rejects duplicate editors for the same scope", () => {
    const current = surface();
    surface();
    expect(
      readComposerAttachmentOwnerDom(current.core, "current").matches,
    ).toBe(false);
  });
  it.each(["hidden", "detached", "old-input"])("rejects %s", (mode) => {
    const current = surface();
    if (mode === "hidden") current.editor.style.display = "none";
    if (mode === "detached") current.element.remove();
    if (mode === "old-input")
      current.element.insertAdjacentHTML(
        "afterbegin",
        '<input type="file" accept="image/*">',
      );
    expect(
      readComposerAttachmentOwnerDom(current.core, "current").matches,
    ).toBe(false);
  });
});
