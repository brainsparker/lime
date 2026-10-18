import {
  p,
  a,
  fail,
  one,
  create,
  numericId,
  xmlPart,
  slidePaths,
  loadPresentationPackage,
  savePresentationPackage,
} from "./presentationPackageXml";

import {
  validateTextBody,
  replaceText,
  replaceFill,
  rgb,
  applyTextStyle,
  type PresentationTextStyle,
} from "./presentationTextPackage";

export type PresentationElementOrder =
  | "bring-forward"
  | "bring-to-front"
  | "send-backward"
  | "send-to-back";

export interface PresentationElementEdit {
  slideId: string;
  elementId: string;
  text?: string;
  frame?: {
    x: number;
    y: number;
    width: number;
    height: number;
    /** 与 renderer 一致，单位为度；未指定时保留原 rot/flip。 */
    rotation?: number;
  };
  /** fontSize 与 renderer 相同，单位为 CSS px；颜色为六位 RGB，可带 #。 */
  style?: PresentationTextStyle & { fillColor?: string };
  deleted?: boolean;
  zOrder?: PresentationElementOrder;
}

export function findElement(xml: Document, id: string): Element {
  if (
    xml.documentElement.namespaceURI !== p ||
    xml.documentElement.localName !== "sld"
  )
    fail("slide namespace");
  const content = one(xml.documentElement, p, "cSld");
  const tree = content && one(content, p, "spTree");
  if (!tree) fail("slide shape tree");
  const ids = new Set<string>();
  for (const identity of Array.from(xml.getElementsByTagNameNS(p, "cNvPr"))) {
    const value = identity.getAttribute("id") ?? "";
    if (!numericId(value, 0, 4294967295) || ids.has(value))
      fail("element identity");
    ids.add(value);
  }
  for (const element of Array.from(tree.children)) {
    const owner = new Map([
      ["sp", "nvSpPr"],
      ["pic", "nvPicPr"],
      ["graphicFrame", "nvGraphicFramePr"],
    ]).get(element.localName);
    if (element.namespaceURI !== p || !owner) continue;
    const properties = one(element, p, owner);
    const identity = properties && one(properties, p, "cNvPr");
    if (identity?.getAttribute("id") === id) return element;
  }
  fail("unsupported or missing top-level element");
}

function textBody(element: Element): Element {
  if (element.localName !== "sp") fail("unsupported text element");
  let body = one(element, p, "txBody");
  if (!body) {
    body = create(element, p, "txBody");
    body.append(create(element, a, "bodyPr"), create(element, a, "lstStyle"));
    element.insertBefore(body, one(element, p, "extLst") ?? null);
  }
  return validateTextBody(body);
}

function shapeProperties(element: Element): Element {
  if (!["sp", "pic"].includes(element.localName))
    fail("unsupported shape fill");
  let properties = one(element, p, "spPr");
  if (!properties) {
    properties = create(element, p, "spPr");
    const after = element.localName === "sp" ? "nvSpPr" : "blipFill";
    const previous = one(element, p, after);
    element.insertBefore(
      properties,
      previous ? previous.nextSibling : element.firstChild,
    );
  }
  return properties;
}

function applyStyle(
  element: Element,
  style: NonNullable<PresentationElementEdit["style"]>,
) {
  const { fontSize, bold, italic, color, fillColor } = style;
  if (fillColor !== undefined)
    replaceFill(shapeProperties(element), rgb(fillColor));
  if ([fontSize, bold, italic, color].every((value) => value === undefined))
    return;
  applyTextStyle(textBody(element), style);
}

function applyFrame(
  element: Element,
  frame: NonNullable<PresentationElementEdit["frame"]>,
) {
  const values = [frame.x, frame.y, frame.width, frame.height].map((value) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value * 9525)
      : NaN,
  );
  if (!values.every(Number.isSafeInteger) || values[2] <= 0 || values[3] <= 0)
    fail("element frame");
  const rotation =
    frame.rotation === undefined
      ? undefined
      : Math.round(frame.rotation * 60000);
  if (
    rotation !== undefined &&
    (typeof frame.rotation !== "number" ||
      !Number.isSafeInteger(rotation) ||
      rotation < -2147483648 ||
      rotation > 2147483647)
  )
    fail("element rotation");
  const graphic = element.localName === "graphicFrame";
  const parent = graphic ? element : shapeProperties(element);
  const namespace = graphic ? p : a;
  let transform = one(parent, namespace, "xfrm");
  if (!transform) {
    transform = create(parent, namespace, "xfrm");
    parent.insertBefore(
      transform,
      graphic ? (one(parent, a, "graphic") ?? null) : parent.firstChild,
    );
  }
  if (rotation !== undefined) transform.setAttribute("rot", String(rotation));
  for (const [name, attrs, entries] of [
    ["off", ["x", "y"], values.slice(0, 2)],
    ["ext", ["cx", "cy"], values.slice(2)],
  ] as const) {
    let child = one(transform, a, name);
    if (!child) {
      child = create(transform, a, name);
      transform.insertBefore(
        child,
        name === "off"
          ? transform.firstChild
          : (one(transform, a, "off")?.nextSibling ?? null),
      );
    }
    attrs.forEach((attr, index) =>
      child!.setAttribute(attr, String(entries[index])),
    );
  }
}

/** spTree 中的绘制顺序即层级；完整节点移动保留 identity、关系和未知内容。 */
function applyOrder(element: Element, direction: PresentationElementOrder) {
  const tree = element.parentElement!;
  const drawings = Array.from(tree.children).filter(
    (node) =>
      node.namespaceURI === p &&
      ["sp", "pic", "graphicFrame", "grpSp", "cxnSp", "contentPart"].includes(
        node.localName,
      ),
  );
  const index = drawings.indexOf(element);
  let destination: number;
  switch (direction) {
    case "bring-forward":
      destination = Math.min(index + 1, drawings.length - 1);
      break;
    case "bring-to-front":
      destination = drawings.length - 1;
      break;
    case "send-backward":
      destination = Math.max(index - 1, 0);
      break;
    case "send-to-back":
      destination = 0;
      break;
    default:
      fail("element order");
  }
  if (destination === index) return false;
  const neighbor = drawings[destination];
  tree.insertBefore(
    element,
    destination < index ? neighbor : neighbor.nextSibling,
  );
  return true;
}

/** 只修改选定顶层对象；关系、媒体、版式和其他 ZIP payload 均由原包保留。 */
export async function editPresentationPackage(
  bytes: Uint8Array,
  edits: readonly PresentationElementEdit[],
): Promise<Uint8Array> {
  const zip = await loadPresentationPackage(bytes);
  const paths = slidePaths(
    await xmlPart(zip, "ppt/presentation.xml"),
    await xmlPart(zip, "ppt/_rels/presentation.xml.rels"),
  );
  const loaded = new Map<string, Document>(),
    seen = new Set<string>(),
    changed = new Set<string>();
  for (const edit of edits) {
    const key = `${edit.slideId}:${edit.elementId}`;
    if (
      !numericId(edit.slideId, 256, 2147483647) ||
      !numericId(edit.elementId, 0, 4294967295) ||
      seen.has(key) ||
      (edit.deleted !== undefined && typeof edit.deleted !== "boolean")
    )
      fail("edit identity");
    seen.add(key);
    const path = paths.get(edit.slideId);
    if (!path) fail("missing slide identity");
    const xml = loaded.get(path) ?? (await xmlPart(zip, path));
    loaded.set(path, xml);
    const element = findElement(xml, edit.elementId);
    if (edit.deleted) {
      element.remove();
      changed.add(path);
      continue;
    }
    if (edit.text !== undefined) replaceText(textBody(element), edit.text);
    if (edit.frame !== undefined) applyFrame(element, edit.frame);
    if (edit.style !== undefined) applyStyle(element, edit.style);
    const reordered =
      edit.zOrder !== undefined && applyOrder(element, edit.zOrder);
    if (
      edit.text !== undefined ||
      edit.frame !== undefined ||
      edit.style !== undefined ||
      reordered
    )
      changed.add(path);
  }
  if (!changed.size) return bytes.slice();
  for (const [path, xml] of loaded)
    if (changed.has(path))
      zip.file(path, new XMLSerializer().serializeToString(xml));
  return savePresentationPackage(zip);
}
