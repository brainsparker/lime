import {
  a,
  p,
  fail,
  loadPresentationPackage,
  megabyte,
  one,
  readXml,
  relationPartPath,
  savePresentationPackage,
  slidePaths,
  xmlPart,
} from "./presentationPackageXml";
import {
  presentationTextBlockId,
  presentationTextBody,
  type PresentationTextCell,
} from "./presentationTextDocument";
import {
  paragraphText,
  validateTextBody,
  validateTextInput,
} from "./presentationTextRangeXml";
import {
  appendPresentationTextHyperlinks,
  presentationTextRelationships,
  type PresentationTextHyperlink,
} from "./presentationTextRelationships";

export interface PresentationTextEdit {
  slideId: string;
  elementId: string;
  cell?: PresentationTextCell;
  bodyXml: string;
  hyperlinks?: readonly PresentationTextHyperlink[];
}

function signature(node: Node): unknown {
  if (node.nodeType !== 1) return [node.nodeType, node.nodeValue];
  const element = node as Element;
  return [
    element.namespaceURI,
    element.localName,
    Array.from(element.attributes)
      .filter(
        (attribute) =>
          attribute.namespaceURI !== "http://www.w3.org/2000/xmlns/",
      )
      .map((attribute) => [
        attribute.namespaceURI,
        attribute.localName,
        attribute.value,
      ])
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
    Array.from(element.childNodes, signature),
  ];
}
const equal = (left?: Element, right?: Element) =>
  JSON.stringify(left ? signature(left) : null) ===
  JSON.stringify(right ? signature(right) : null);

function replacementBody(original: Element, source: string): Element {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).length > 4 * megabyte
  )
    fail("text body input");
  const body = readXml(source).documentElement;
  if (
    body.localName !== "txBody" ||
    body.namespaceURI !== original.namespaceURI ||
    (body.namespaceURI !== a && body.namespaceURI !== p)
  )
    fail("text body namespace");
  validateTextBody(body);
  const attributes = (node: Element) => {
    const copy = node.cloneNode(false) as Element;
    return signature(copy);
  };
  if (
    JSON.stringify(attributes(body)) !== JSON.stringify(attributes(original)) ||
    !equal(one(body, a, "bodyPr"), one(original, a, "bodyPr")) ||
    !equal(one(body, a, "lstStyle"), one(original, a, "lstStyle"))
  )
    fail("text body metadata changed");
  validateTextInput(
    Array.from(body.children)
      .filter((node) => node.namespaceURI === a && node.localName === "p")
      .map(paragraphText)
      .join("\n"),
  );
  return body;
}

/** 同一原包事务定点写正文及新增链接；不把原包引用改成 renderer 或独立业务模型。 */
export async function editPresentationTextPackage(
  bytes: Uint8Array,
  edits: readonly PresentationTextEdit[],
): Promise<Uint8Array> {
  if (!Array.isArray(edits) || edits.length > 10000) fail("text edits");
  const zip = await loadPresentationPackage(bytes),
    paths = slidePaths(
      await xmlPart(zip, "ppt/presentation.xml"),
      await xmlPart(zip, "ppt/_rels/presentation.xml.rels"),
    );
  const documents = new Map<string, Document>(),
    relations = new Map<string, Document>(),
    changed = new Set<string>(),
    seen = new Set<string>();
  for (const edit of edits) {
    if (
      !edit ||
      typeof edit !== "object" ||
      Array.isArray(edit) ||
      Reflect.ownKeys(edit).some(
        (key) =>
          !["slideId", "elementId", "cell", "bodyXml", "hyperlinks"].includes(
            String(key),
          ),
      )
    )
      fail("text edit input");
    const key = presentationTextBlockId(
      edit.slideId,
      edit.elementId,
      edit.cell,
    );
    if (seen.has(key)) fail("duplicate text edit target");
    seen.add(key);
    const path = paths.get(edit.slideId);
    if (!path) fail("missing slide identity");
    const document = documents.get(path) ?? (await xmlPart(zip, path));
    documents.set(path, document);
    const original = presentationTextBody(document, edit.elementId, edit.cell),
      body = replacementBody(original, edit.bodyXml);
    const relationPath = relationPartPath(path),
      relation =
        relations.get(relationPath) ??
        presentationTextRelationships(
          await zip.file(relationPath)?.async("string"),
        );
    relations.set(relationPath, relation);
    if (appendPresentationTextHyperlinks(relation, body, edit.hyperlinks))
      changed.add(relationPath);
    if (!equal(original, body)) {
      original.replaceWith(document.importNode(body, true));
      changed.add(path);
    }
  }
  if (!changed.size) return bytes.slice();
  for (const [path, document] of [...documents, ...relations])
    if (changed.has(path)) {
      const source = new XMLSerializer().serializeToString(document);
      readXml(source);
      zip.file(path, source);
    }
  return savePresentationPackage(zip);
}
