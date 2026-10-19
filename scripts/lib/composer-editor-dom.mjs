export const COMPOSER_EDITOR_SELECTOR =
  '[data-testid="composer-editor"][role="textbox"]';

export function composerEditorSelector(sessionId = null) {
  if (!sessionId) return COMPOSER_EDITOR_SELECTOR;
  const escaped = String(sessionId).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${COMPOSER_EDITOR_SELECTOR}[data-session-id="${escaped}"]`;
}

// This function is also serialized by Playwright into the renderer context.
export function readComposerEditorTextDom(element) {
  const readNode = (node) => {
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1) return "";
    if (node.getAttribute("data-composer-code-block-toolbar") === "true")
      return "";
    if (node.tagName === "BR") {
      return node.classList.contains("ProseMirror-trailingBreak") ? "" : "\n";
    }
    const kind = node.getAttribute("data-composer-token");
    if (["file", "skill", "plugin"].includes(kind)) {
      const label = node.getAttribute("data-composer-label");
      if (!label) throw new Error(`Missing canonical Composer ${kind} label`);
      return label;
    }
    if (kind) return node.textContent || "";
    return Array.from(node.childNodes).map(readNode).join("");
  };
  let text = "";
  Array.from(element.childNodes).forEach((node, index) => {
    if (
      index > 0 &&
      node.nodeType === 1 &&
      /^(P|DIV|PRE)$/.test(node.tagName)
    ) {
      text += "\n";
    }
    text += readNode(node);
  });
  return text;
}

// Read only the current visible projection. A hidden or foreign-session editor
// must never satisfy an action or observation intended for this conversation.
export function findVisibleComposerEditorsDom(sessionId = null) {
  return Array.from(
    document.querySelectorAll(
      '[data-testid="composer-editor"][role="textbox"]',
    ),
  ).filter((element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (sessionId && element.dataset.sessionId !== sessionId) return false;
    const style = window.getComputedStyle(element);
    return (
      element.isConnected &&
      element.getClientRects().length > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.visibility !== "collapse"
    );
  });
}

export function readComposerEditor(element) {
  if (
    !(element instanceof HTMLElement) ||
    !element.matches('[data-testid="composer-editor"][role="textbox"]')
  ) {
    throw new Error("Missing current Composer editor DOM");
  }
  return {
    sessionId: element.dataset.sessionId || null,
    text: readComposerEditorTextDom(element),
    disabled:
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("contenteditable") !== "true",
    connected: element.isConnected,
  };
}

// Playwright serializes page callbacks without their module scope. Embed only
// this read-only DOM observer; no renderer controller or business state is exposed.
export function withComposerEditorDom(pageFunction) {
  return new Function(
    "arg",
    `${readComposerEditorTextDom.toString()}\n${findVisibleComposerEditorsDom.toString()}\nreturn (${pageFunction.toString()})(arg);`,
  );
}

export const COMPOSER_EDITOR_DOM_SOURCE = readComposerEditorTextDom.toString();

export async function fillComposerEditor(page, text, sessionId = null) {
  const editor = page.locator(`${composerEditorSelector(sessionId)}:visible`);
  await editor.fill(text);
  return editor.evaluate(withComposerEditorDom(readComposerEditor));
}

export async function readComposerEditorText(editor) {
  const snapshot = await editor.evaluate(
    withComposerEditorDom(readComposerEditor),
  );
  return snapshot.text;
}
