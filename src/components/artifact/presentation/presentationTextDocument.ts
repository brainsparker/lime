import type { parseZip } from "@aiden0z/pptx-renderer";
import type { PresentationSnapshot } from "./presentationDocument";
import { findElement } from "./presentationPackage";
import {
  a,
  p,
  fail,
  numericId,
  one,
  readXml,
  relationPartPath,
  slidePaths,
} from "./presentationPackageXml";
import { cellAt, tableGrid } from "./presentationTableGrid";
import { validateTextBody } from "./presentationTextRangeXml";
import { presentationTextHyperlinkResolver } from "./presentationTextRelationships";

export interface PresentationTextCell {
  row: number;
  column: number;
}
export interface PresentationTextBlock {
  blockId: string;
  slideId: string;
  elementId: string;
  cell?: PresentationTextCell;
  body: Element;
  resolveHyperlink: (id: string) => string | undefined;
}
type Source = Readonly<{ xml: string; relationships?: string }>;
const sources = new WeakMap<
  PresentationSnapshot["model"],
  ReadonlyMap<string, Source>
>();
const xmlns = "http://www.w3.org/2000/xmlns/";

function independentBody(original: Element): Element {
  const body = original.cloneNode(true) as Element;
  // 独立正文仍需原来的命名空间作用域，不能依赖 serializer 生成临时前缀。
  for (
    let ancestor: Element | null = original;
    ancestor;
    ancestor = ancestor.parentElement
  )
    for (const attribute of Array.from(ancestor.attributes))
      if (
        attribute.namespaceURI === xmlns &&
        !body.hasAttributeNS(xmlns, attribute.localName)
      )
        body.setAttributeNS(xmlns, attribute.name, attribute.value);
  return body;
}

/** 仅登记原始字符串；必须在预览 sanitizer 删除外部关系之前复制 files。 */
export function registerPresentationTextSources(
  snapshot: PresentationSnapshot,
  files: Awaited<ReturnType<typeof parseZip>>,
): void {
  const paths = slidePaths(
    readXml(files.presentation),
    readXml(files.presentationRels),
  );
  if (JSON.stringify([...paths.keys()]) !== JSON.stringify(snapshot.slideIds))
    fail("text source slide inventory");
  const registered = new Map<string, Source>();
  for (const [id, path] of paths) {
    const xml = files.slides.get(path);
    if (typeof xml !== "string") fail("missing text slide source");
    readXml(xml);
    registered.set(
      id,
      Object.freeze({
        xml,
        relationships: files.slideRels.get(relationPartPath(path)),
      }),
    );
  }
  const previous = sources.get(snapshot.model);
  if (
    previous &&
    JSON.stringify([...previous]) !== JSON.stringify([...registered])
  )
    fail("text source already registered");
  if (!previous) sources.set(snapshot.model, registered);
}

export function presentationTextBlockId(
  slideId: string,
  elementId: string,
  cell?: PresentationTextCell,
): string {
  if (
    typeof slideId !== "string" ||
    typeof elementId !== "string" ||
    !numericId(slideId, 256, 2147483647) ||
    !numericId(elementId, 0, 4294967295)
  )
    fail("text target identity");
  if (
    cell !== undefined &&
    (!cell ||
      typeof cell !== "object" ||
      Array.isArray(cell) ||
      Reflect.ownKeys(cell).some(
        (key) => !["row", "column"].includes(String(key)),
      ) ||
      !Number.isSafeInteger(cell.row) ||
      !Number.isSafeInteger(cell.column) ||
      cell.row < 0 ||
      cell.column < 0)
  )
    fail("text cell address");
  return `${slideId}:${elementId}${cell ? `:${cell.row}:${cell.column}` : ""}`;
}

/** 原包目标定位由读取与写入共同使用；缺失 body 或 continuation 不创建代理目标。 */
export function presentationTextBody(
  document: Document,
  elementId: string,
  cell?: PresentationTextCell,
): Element {
  const element = findElement(document, elementId);
  let parent: Element, namespace: string;
  if (cell !== undefined) {
    const owner = cellAt(tableGrid(document, elementId), cell.row, cell.column);
    if (owner.row !== cell.row || owner.column !== cell.column)
      fail("merged cell continuation target");
    parent = owner.element;
    namespace = a;
  } else {
    if (element.localName !== "sp") fail("unsupported text element");
    parent = element;
    namespace = p;
  }
  if (
    Array.from(parent.children).some(
      (node) => node.localName === "txBody" && node.namespaceURI !== namespace,
    )
  )
    fail("text body namespace");
  const body = one(parent, namespace, "txBody");
  if (!body) fail("missing text body");
  return validateTextBody(body);
}

/** 每次从不可变原文派生新 DOM；renderer 的内部 source/proto 不是编辑事实源。 */
export function readPresentationTextBlock(
  snapshot: PresentationSnapshot,
  slideId: string,
  elementId: string,
  cell?: PresentationTextCell,
): PresentationTextBlock | undefined {
  try {
    const blockId = presentationTextBlockId(slideId, elementId, cell),
      source = sources.get(snapshot.model)?.get(slideId);
    if (!source) return undefined;
    const body = independentBody(
      presentationTextBody(readXml(source.xml), elementId, cell),
    );
    return {
      blockId,
      slideId,
      elementId,
      ...(cell ? { cell: { ...cell } } : {}),
      body,
      resolveHyperlink: presentationTextHyperlinkResolver(source.relationships),
    };
  } catch {
    return undefined;
  }
}
