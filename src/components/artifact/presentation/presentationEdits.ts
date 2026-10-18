import {
  editPresentationPackage,
  type PresentationElementEdit,
} from "./presentationPackage";
import {
  editPresentationSlidesPackage,
  type PresentationSlideEdit,
} from "./presentationSlidesPackage";
import {
  editPresentationTablePackage,
  type PresentationTableEdit,
} from "./presentationTablePackage";
import {
  editPresentationTextPackage,
  type PresentationTextEdit,
} from "./presentationTextEditPackage";

export type PresentationEdit =
  | { kind: "element"; value: PresentationElementEdit }
  | { kind: "table"; value: PresentationTableEdit }
  | { kind: "text"; value: PresentationTextEdit }
  | { kind: "slide"; value: PresentationSlideEdit };

/** 保持结构操作前后的编辑顺序；复制得到的是当时的真实内容。 */
export async function applyPresentationEdits(
  source: Uint8Array,
  edits: readonly PresentationEdit[],
) {
  let bytes = source;
  const elements = new Map<string, PresentationElementEdit>();
  const createdSlideIds: string[] = [];
  const flush = async () => {
    if (!elements.size) return;
    bytes = await editPresentationPackage(bytes, [...elements.values()]);
    elements.clear();
  };
  for (const edit of edits) {
    if (edit.kind === "element") {
      // 层级动作有相对语义，必须保留顺序，不能合并同一对象的多次前移。
      if (edit.value.zOrder !== undefined) {
        await flush();
        bytes = await editPresentationPackage(bytes, [edit.value]);
        continue;
      }
      const key = `${edit.value.slideId}:${edit.value.elementId}`;
      const previous = elements.get(key);
      elements.set(key, {
        ...previous,
        ...edit.value,
        ...((previous?.style || edit.value.style) && {
          style: { ...previous?.style, ...edit.value.style },
        }),
      });
    } else {
      await flush();
      if (edit.kind === "text") {
        bytes = await editPresentationTextPackage(bytes, [edit.value]);
        continue;
      }
      if (edit.kind === "table") {
        bytes = await editPresentationTablePackage(bytes, [edit.value]);
        continue;
      }
      const result = await editPresentationSlidesPackage(bytes, [edit.value]);
      bytes = result.bytes;
      createdSlideIds.push(...result.createdSlideIds);
    }
  }
  await flush();
  return { bytes, createdSlideIds };
}
