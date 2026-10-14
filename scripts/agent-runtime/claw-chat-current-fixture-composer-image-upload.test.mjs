import { afterEach, describe, expect, it, vi } from "vitest";
import { readComposerImageInputOwnerDom } from "./claw-chat-current-fixture-composer-image-upload.mjs";

function surface(sessionId = "current") {
  const element = document.createElement("div");
  element.innerHTML = `<input type="file" accept="image/*" style="display:none"><section data-testid="inputbar-core-container"><div data-testid="composer-editor" role="textbox" contenteditable="true" data-session-id="${sessionId}"></div><button aria-label="添加图片">添加图片</button></section>`;
  document.body.append(element);
  const editor = element.querySelector('[data-testid="composer-editor"]');
  vi.spyOn(editor, "getClientRects").mockReturnValue([{}]);
  return { element, editor, input: element.querySelector("input") };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("Composer image chooser ownership", () => {
  it("accepts the real Surface input that is a sibling of Core", () => {
    const current = surface();
    expect(
      current.input.closest('[data-testid="inputbar-core-container"]'),
    ).toBeNull();
    expect(readComposerImageInputOwnerDom(current.input, "current")).toEqual({
      matches: true,
      editorCount: 1,
      editorSessionId: "current",
      imageInputCount: 1,
      surfaceEditorCount: 1,
    });
  });

  it("rejects another conversation's chooser even when the expected editor is visible", () => {
    surface();
    const foreign = surface("foreign");
    expect(
      readComposerImageInputOwnerDom(foreign.input, "current").matches,
    ).toBe(false);
  });

  it("rejects duplicate visible editors for the same session", () => {
    const current = surface();
    surface();
    expect(
      readComposerImageInputOwnerDom(current.input, "current").matches,
    ).toBe(false);
  });

  it("rejects a Surface with multiple image inputs", () => {
    const current = surface();
    current.element.append(current.input.cloneNode());
    expect(
      readComposerImageInputOwnerDom(current.input, "current").matches,
    ).toBe(false);
  });

  it("rejects a broad ancestor shared by different conversation editors", () => {
    const current = surface();
    surface("foreign");
    document.body.append(current.input);
    expect(
      readComposerImageInputOwnerDom(current.input, "current").matches,
    ).toBe(false);
  });

  it.each(["hidden", "detached", "wrong-type", "wrong-accept", "nested-input"])(
    "rejects %s picker ownership",
    (mode) => {
      const current = surface();
      if (mode === "hidden") current.editor.style.display = "none";
      if (mode === "detached") current.element.remove();
      if (mode === "wrong-type") current.input.type = "text";
      if (mode === "wrong-accept") current.input.accept = "*/*";
      if (mode === "nested-input") {
        const wrapper = document.createElement("div");
        current.element.append(wrapper);
        wrapper.append(current.input);
      }
      expect(
        readComposerImageInputOwnerDom(current.input, "current").matches,
      ).toBe(false);
    },
  );
});
