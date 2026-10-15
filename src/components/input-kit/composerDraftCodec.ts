import {
  assertPersistedDraftPayload,
  PERSISTED_ATOM_LIMITS,
} from "@/lib/api/persistedAtomProtocol";
import type { JsonObject } from "@/lib/api/persistedAtomTypes";
import { composerDocumentFromJSON } from "@/components/input-kit/composerSchema";
import { projectComposerDocument } from "@/components/input-kit/composerSerialization";
import {
  composerPositionToOffset,
  composerTextSelection,
} from "@/components/input-kit/composerPositions";
import { resourcesFrom } from "@/components/input-kit/composerState";
import type {
  ComposerAttachment,
  ComposerDocument,
  ComposerEditorDocument,
  ComposerPathReference,
} from "@/components/input-kit/types";

export class ComposerDraftCodecError extends Error {
  constructor(readonly code: "invalid_draft" | "capacity_exceeded") {
    super("Composer draft cannot be persisted or restored");
    this.name = "ComposerDraftCodecError";
  }
}

export interface DecodedComposerDraft {
  readonly document: ComposerDocument;
  /** Immutable Controller option; restoreDraft does not change this mode. */
  readonly plainTextMode: boolean;
}

function invalid(): never {
  throw new ComposerDraftCodecError("invalid_draft");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function exact(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  const result = record(value);
  if (
    required.some((key) => !Object.hasOwn(result, key)) ||
    Object.keys(result).some(
      (key) => !required.includes(key) && !optional.includes(key),
    )
  )
    invalid();
  return result;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = Object.keys(left),
    b = Object.keys(right);
  return (
    a.length === b.length &&
    a.every(
      (key) =>
        Object.hasOwn(right, key) &&
        jsonEqual(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}

function strings(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  if (keys.some((key) => typeof value[key] !== "string")) invalid();
}

function attachment(value: unknown, allowPreview: boolean): ComposerAttachment {
  const data = exact(
    value,
    ["data", "mediaType"],
    [
      "sourceUri",
      "sourcePath",
      "metadata",
      "index",
      ...(allowPreview ? ["previewUrl"] : []),
    ],
  );
  strings(data, ["data", "mediaType"]);
  for (const key of ["sourceUri", "sourcePath", "previewUrl"])
    if (Object.hasOwn(data, key)) strings(data, [key]);
  if (!(data.mediaType as string).trim()) invalid();
  if (Object.hasOwn(data, "metadata")) record(data.metadata);
  if (
    Object.hasOwn(data, "index") &&
    (typeof data.index !== "number" ||
      !Number.isSafeInteger(data.index) ||
      data.index < 0)
  )
    invalid();
  const sourceUri = data.sourceUri as string | undefined;
  if (sourceUri?.trim().toLowerCase().startsWith("blob:")) invalid();
  if (
    !(data.data as string).trim() &&
    !(data.sourcePath as string | undefined)?.trim() &&
    !sourceUri?.trim()
  )
    invalid();
  // Existing attachment owners rebuild previews from data/mediaType or sources.
  const { previewUrl: _previewUrl, ...durable } = data;
  return durable as unknown as ComposerAttachment;
}

function pathReference(value: unknown): ComposerPathReference {
  const data = exact(
    value,
    ["id", "path", "name", "isDir"],
    ["size", "mimeType", "source"],
  );
  strings(data, ["id", "path", "name"]);
  if (typeof data.isDir !== "boolean") invalid();
  if (
    Object.hasOwn(data, "size") &&
    data.size !== null &&
    (typeof data.size !== "number" ||
      !Number.isFinite(data.size) ||
      data.size < 0)
  )
    invalid();
  if (Object.hasOwn(data, "mimeType") && data.mimeType !== null)
    strings(data, ["mimeType"]);
  if (
    Object.hasOwn(data, "source") &&
    data.source !== "file_manager" &&
    data.source !== "system_drop"
  )
    invalid();
  return data as unknown as ComposerPathReference;
}

function document(value: unknown, allowPreview: boolean): ComposerDocument {
  const data = exact(
    value,
    [
      "editorDocument",
      "text",
      "selectionStart",
      "selectionEnd",
      "textElements",
      "mentionBindings",
      "attachments",
      "pathReferences",
      "pendingPastes",
    ],
    ["inputCapabilityRoute"],
  );
  const pm = composerDocumentFromJSON(
    data.editorDocument as ComposerEditorDocument,
  );
  const editorDocument = pm.toJSON() as ComposerEditorDocument;
  // Accept the current canonical schema; never silently drop unknown PM fields.
  if (!jsonEqual(data.editorDocument, editorDocument)) invalid();
  const projection = projectComposerDocument(pm);
  for (const key of [
    "text",
    "textElements",
    "mentionBindings",
    "pendingPastes",
  ] as const)
    if (!jsonEqual(data[key], projection[key])) invalid();
  const start = data.selectionStart,
    end = data.selectionEnd;
  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    end > projection.text.length
  )
    invalid();
  const selection = composerTextSelection(pm, { start, end });
  if (
    composerPositionToOffset(pm, selection.from) !== start ||
    composerPositionToOffset(pm, selection.to) !== end
  )
    invalid();
  if (!Array.isArray(data.attachments) || !Array.isArray(data.pathReferences))
    invalid();
  const resources = resourcesFrom({
    attachments: data.attachments.map((item) => attachment(item, allowPreview)),
    pathReferences: data.pathReferences.map(pathReference),
    ...(Object.hasOwn(data, "inputCapabilityRoute")
      ? { inputCapabilityRoute: data.inputCapabilityRoute }
      : {}),
  });
  return {
    editorDocument,
    text: projection.text,
    selectionStart: start,
    selectionEnd: end,
    textElements: projection.textElements,
    mentionBindings: projection.mentionBindings,
    pendingPastes: projection.pendingPastes,
    ...resources,
  };
}

function json(
  value: unknown,
  enforceBudget: boolean,
): asserts value is JsonObject {
  assertPersistedDraftPayload(value);
  if (
    enforceBudget &&
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
      PERSISTED_ATOM_LIMITS.maxDraftBytes
  )
    throw new ComposerDraftCodecError("capacity_exceeded");
}

function guarded<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ComposerDraftCodecError) throw error;
    // Do not include draft content or parser exception text in diagnostics.
    return invalid();
  }
}

/** Renderer-only codec. Main sees JSON and owns no PM, Controller or resources. */
export function encodeComposerDraft(
  value: ComposerDocument,
  plainTextMode: boolean,
): JsonObject {
  return guarded(() => {
    json(value, false);
    if (typeof plainTextMode !== "boolean") invalid();
    const payload = {
      format: "composer-draft",
      version: 1,
      plainTextMode,
      document: document(value, true),
    };
    json(payload, true);
    return payload;
  });
}

export function decodeComposerDraft(value: unknown): DecodedComposerDraft {
  return guarded(() => {
    json(value, true);
    const payload = exact(value, [
      "format",
      "version",
      "plainTextMode",
      "document",
    ]);
    if (
      payload.format !== "composer-draft" ||
      payload.version !== 1 ||
      typeof payload.plainTextMode !== "boolean"
    )
      invalid();
    return {
      document: document(payload.document, false),
      plainTextMode: payload.plainTextMode,
    };
  });
}
