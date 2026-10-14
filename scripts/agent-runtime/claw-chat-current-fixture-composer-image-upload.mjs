import {
  composerEditorSelector,
  findVisibleComposerEditorsDom,
} from "../lib/composer-editor-dom.mjs";
import { assert } from "./claw-chat-current-fixture-utils.mjs";

export function readComposerImageInputOwnerDom(input, sessionId) {
  const editors = findVisibleComposerEditorsDom(sessionId);
  const editor = editors.length === 1 ? editors[0] : null;
  const core = editor?.closest('[data-testid="inputbar-core-container"]');
  const surface = input?.parentElement;
  const imageInputs = Array.from(surface?.children ?? []).filter(
    (node) =>
      node instanceof HTMLInputElement &&
      node.type === "file" &&
      node.accept === "image/*",
  );
  const surfaceEditors = findVisibleComposerEditorsDom().filter((node) =>
    surface?.contains(node),
  );
  return {
    matches:
      input instanceof HTMLInputElement &&
      input.type === "file" &&
      input.accept === "image/*" &&
      imageInputs.length === 1 &&
      imageInputs[0] === input &&
      !!core &&
      surface?.contains(core) === true &&
      surfaceEditors.length === 1 &&
      surfaceEditors[0] === editor,
    editorCount: editors.length,
    editorSessionId: editor?.dataset.sessionId ?? null,
    imageInputCount: imageInputs.length,
    surfaceEditorCount: surfaceEditors.length,
  };
}

export async function attachComposerImage(
  page,
  { sessionId, image, imageButtonName, timeoutMs },
) {
  const editor = page.locator(`${composerEditorSelector(sessionId)}:visible`);
  assert((await editor.count()) === 1, "图片上传要求唯一同会话 Composer");
  const addImage = editor
    .locator('xpath=ancestor::*[@data-testid="inputbar-core-container"][1]')
    .getByRole("button", { name: imageButtonName, exact: true });
  // Registering filechooser before the real button click intercepts the native
  // picker while preserving the production fileInputRef -> onChange path.
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: timeoutMs }),
    addImage.click({ timeout: timeoutMs }),
  ]);
  const observer = new Function(
    "input",
    "sessionId",
    `${findVisibleComposerEditorsDom.toString()}\nreturn (${readComposerImageInputOwnerDom.toString()})(input, sessionId);`,
  );
  const ownership = await chooser.element().evaluate(observer, sessionId);
  assert(
    ownership.matches,
    `图片选择器未绑定同会话 InputbarSurface: ${JSON.stringify(ownership)}`,
  );
  await chooser.setFiles(image, { timeout: timeoutMs });
  return { ...ownership, source: "real Add Image button -> filechooser" };
}
