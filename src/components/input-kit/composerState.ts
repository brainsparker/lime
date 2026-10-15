import { EditorState } from "@tiptap/pm/state";
import { history } from "@tiptap/pm/history";
import { createComposerEditingKeymap } from "./composerKeymap";
import { composerDocumentFromJSON } from "./composerSchema";
import {
  composerDocumentFromAnnotations,
  projectComposerDocument,
} from "./composerSerialization";
import {
  composerPositionToOffset,
  composerTextSelection,
} from "./composerPositions";
import { createCodeBlockHighlight } from "./composerCodeBlockHighlight";
import { createCodeBlockAutoDetect } from "./composerCodeBlockAutoDetect";
import type {
  ComposerAttachment,
  ComposerDocument,
  ComposerDocumentInput,
  ComposerEditorDocument,
  ComposerPathReference,
} from "./types";

export interface ComposerResources {
  attachments: readonly ComposerAttachment[];
  pathReferences: readonly ComposerPathReference[];
  inputCapabilityRoute?: unknown;
}

export const clone = <T>(value: T): T => structuredClone(value);

export function resourcesFrom(input: ComposerDocumentInput): ComposerResources {
  return clone({
    attachments: [...(input.attachments ?? [])],
    pathReferences: [...(input.pathReferences ?? [])],
    ...(input.inputCapabilityRoute === undefined
      ? {}
      : { inputCapabilityRoute: input.inputCapabilityRoute }),
  });
}

export function stateFrom(
  input: ComposerDocumentInput,
  codeBlocksEnabled = false,
): EditorState {
  const doc = input.editorDocument
    ? composerDocumentFromJSON(input.editorDocument)
    : composerDocumentFromAnnotations(input);
  // Validate programmatically supplied annotations as strictly as JSON restores.
  composerDocumentFromJSON(doc.toJSON() as ComposerEditorDocument);
  const text = projectComposerDocument(doc).text;
  const start = input.selectionStart ?? text.length;
  return EditorState.create({
    doc,
    selection: composerTextSelection(doc, {
      start,
      end: input.selectionEnd ?? start,
    }),
    plugins: [
      history(),
      ...createComposerEditingKeymap(),
      ...(codeBlocksEnabled
        ? [createCodeBlockHighlight(), createCodeBlockAutoDetect()]
        : []),
    ],
  });
}

export function documentFrom(
  state: EditorState,
  resources: ComposerResources,
): ComposerDocument {
  const projection = projectComposerDocument(state.doc);
  return {
    editorDocument: state.doc.toJSON() as ComposerEditorDocument,
    text: projection.text,
    selectionStart: composerPositionToOffset(state.doc, state.selection.from),
    selectionEnd: composerPositionToOffset(state.doc, state.selection.to),
    textElements: projection.textElements,
    mentionBindings: projection.mentionBindings,
    pendingPastes: projection.pendingPastes,
    ...clone(resources),
  };
}

export function buildDocument(
  input: ComposerDocumentInput = {},
): ComposerDocument {
  return documentFrom(stateFrom(input), resourcesFrom(input));
}
