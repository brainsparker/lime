// JSDOM has no layout engine; geometry is validated by the Electron gates.
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(),
  });
}

export const COMPOSER_EDITOR_SELECTOR =
  '[data-testid="composer-editor"][role="textbox"]';

export function getComposerEditorText(editor: HTMLElement | null): string {
  if (!editor) throw new Error("Composer editor is missing");
  const read = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element)) return "";
    if (
      node.matches(
        '[data-composer-token="file"], [data-composer-token="skill"], [data-composer-token="plugin"]',
      )
    ) {
      const label = node.getAttribute("data-composer-label");
      if (label === null)
        throw new Error("Composer mention canonical label is missing");
      return label;
    }
    if (node.matches("br.ProseMirror-trailingBreak")) return "";
    if (node.tagName === "BR") return "\n";
    return Array.from(node.childNodes).map(read).join("");
  };
  return Array.from(editor.children).map(read).join("\n");
}

export function setComposerEditorText(
  editor: HTMLElement | null,
  text: string,
): void {
  if (!editor) throw new Error("Composer editor is missing");
  editor.focus();
  for (const modifier of ["ctrlKey", "metaKey"] as const) {
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "a",
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  if (!text) {
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Backspace",
        bubbles: true,
        cancelable: true,
      }),
    );
    return;
  }
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      items: [],
      files: [],
      getData: (format: string) =>
        format === "text/plain" || format === "text" ? text : "",
    },
  });
  editor.dispatchEvent(event);
}
