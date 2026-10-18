import JSZip from "jszip";

export const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
export const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
export const r =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const relationships =
  "http://schemas.openxmlformats.org/package/2006/relationships";
export const megabyte = 1024 * 1024;

export function fail(message: string): never {
  throw new Error(`Invalid presentation ${message}`);
}

export function packagePath(name: string): boolean {
  return (
    !!name &&
    !name.startsWith("/") &&
    !/[\\:#?%]/u.test(name) &&
    Array.from(name).every(
      (character) =>
        character.codePointAt(0)! >= 32 && character.codePointAt(0) !== 127,
    ) &&
    name
      .replace(/\/$/, "")
      .split("/")
      .every((part) => !!part && part !== "." && part !== "..")
  );
}

function checkExtra(view: DataView, offset: number, length: number) {
  const end = offset + length;
  while (offset < end) {
    if (offset + 4 > end) fail("archive extra field");
    const id = view.getUint16(offset, true);
    offset += 4 + view.getUint16(offset + 2, true);
    if (id === 1 || offset > end) fail("ZIP64 archive");
  }
}

/** 解压前检查目录及 local header，避免 JSZip 归一化后掩盖重复或穿越路径。 */
export function checkArchive(bytes: Uint8Array) {
  if (bytes.length < 22 || bytes.length > 64 * megabyte) fail("package size");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  const minimum = Math.max(0, end - 65535);
  for (; end >= minimum; end--)
    if (
      view.getUint32(end, true) === 0x06054b50 &&
      end + 22 + view.getUint16(end + 20, true) === bytes.length
    )
      break;
  if (end < minimum || view.getUint32(end + 4, true) !== 0)
    fail("archive directory");
  const count = view.getUint16(end + 10, true);
  const length = view.getUint32(end + 12, true);
  const directory = view.getUint32(end + 16, true);
  if (
    !count ||
    count > 10000 ||
    count !== view.getUint16(end + 8, true) ||
    directory + length !== end
  )
    fail("archive directory");
  let offset = directory,
    total = 0;
  const names = new Set<string>();
  const spans: [number, number][] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      fail("archive entry");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const next =
      offset +
      46 +
      nameLength +
      extraLength +
      view.getUint16(offset + 32, true);
    total += size;
    if (
      next > end ||
      size > 32 * megabyte ||
      total > 128 * megabyte ||
      compressed > 64 * megabyte ||
      flags & 0x2041 ||
      view.getUint16(offset + 6, true) > 20 ||
      ![0, 8].includes(method) ||
      view.getUint16(offset + 34, true)
    )
      fail("archive size or encryption");
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (
      !packagePath(name) ||
      names.has(name) ||
      name.replace(/\/$/, "").startsWith("_xmlsignatures/")
    )
      fail("archive path or signature");
    names.add(name);
    checkExtra(view, offset + 46 + nameLength, extraLength);
    const local = view.getUint32(offset + 42, true);
    if (local + 30 > directory || view.getUint32(local, true) !== 0x04034b50)
      fail("archive local header");
    const localNameLength = view.getUint16(local + 26, true);
    const localExtraLength = view.getUint16(local + 28, true);
    const data = local + 30 + localNameLength + localExtraLength;
    if (
      data + compressed > directory ||
      view.getUint16(local + 4, true) > 20 ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method ||
      decoder.decode(
        bytes.subarray(local + 30, local + 30 + localNameLength),
      ) !== name
    )
      fail("archive local identity");
    for (const [localField, centralField] of [
      [14, 16],
      [18, 20],
      [22, 24],
    ]) {
      const value = view.getUint32(local + localField, true);
      if (
        value !== view.getUint32(offset + centralField, true) &&
        (!(flags & 8) || value !== 0)
      )
        fail("archive local size");
    }
    checkExtra(view, local + 30 + localNameLength, localExtraLength);
    spans.push([local, data + compressed]);
    offset = next;
  }
  if (offset !== end) fail("archive directory length");
  spans.sort((left, right) => left[0] - right[0]);
  if (spans.some((span, index) => index > 0 && span[0] < spans[index - 1][1]))
    fail("overlapping archive entry");
}

export function validXmlText(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (
      ![9, 10, 13].includes(code) &&
      !(code >= 32 && code <= 0xd7ff) &&
      !(code >= 0xe000 && code <= 0xfffd) &&
      !(code >= 0x10000 && code <= 0x10ffff)
    )
      return false;
  }
  return true;
}

export function checkXmlSource(source: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source) || !validXmlText(source))
    fail("XML declaration or character");
}

export function readXml(source: string): Document {
  checkXmlSource(source);
  const xml = new DOMParser().parseFromString(source, "application/xml");
  if (xml.getElementsByTagNameNS("*", "parsererror").length) fail("XML");
  return xml;
}

export function children(
  parent: Element,
  namespace: string,
  name: string,
): Element[] {
  return Array.from(parent.children).filter(
    (child) => child.namespaceURI === namespace && child.localName === name,
  );
}

export function one(
  parent: Element,
  namespace: string,
  name: string,
): Element | undefined {
  const matches = children(parent, namespace, name);
  if (matches.length > 1) fail(`duplicate ${name}`);
  return matches[0];
}

export function create(
  parent: Element,
  namespace: string,
  name: string,
): Element {
  return parent.ownerDocument.createElementNS(
    namespace,
    `${namespace === p ? "p" : "a"}:${name}`,
  );
}

export function numericId(
  value: string,
  minimum: number,
  maximum: number,
): boolean {
  return (
    /^(?:0|[1-9][0-9]*)$/.test(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
  );
}

export async function xmlPart(zip: JSZip, path: string): Promise<Document> {
  const entry = zip.file(path);
  if (!entry) fail(`missing part ${path}`);
  return readXml(await entry.async("string"));
}

export function slidePaths(
  presentation: Document,
  relations: Document,
): Map<string, string> {
  const root = presentation.documentElement;
  const relRoot = relations.documentElement;
  if (
    root.namespaceURI !== p ||
    root.localName !== "presentation" ||
    relRoot.namespaceURI !== relationships ||
    relRoot.localName !== "Relationships"
  )
    fail("root namespace");
  const list = one(root, p, "sldIdLst");
  if (!list || !list.children.length || list.children.length > 1000)
    fail("slide inventory");
  const rels = new Map<string, Element>();
  for (const relation of Array.from(relRoot.children)) {
    const id = relation.getAttribute("Id") ?? "";
    if (
      relation.namespaceURI !== relationships ||
      relation.localName !== "Relationship" ||
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id) ||
      rels.has(id)
    )
      fail("relationship identity");
    rels.set(id, relation);
  }
  const paths = new Map<string, string>(),
    relationIds = new Set<string>();
  for (const slide of Array.from(list.children)) {
    const id = slide.getAttribute("id") ?? "";
    const relationId = slide.getAttributeNS(r, "id") ?? "";
    const relation = rels.get(relationId);
    if (
      slide.namespaceURI !== p ||
      slide.localName !== "sldId" ||
      !numericId(id, 256, 2147483647) ||
      paths.has(id) ||
      relationIds.has(relationId) ||
      !relation ||
      relation.getAttribute("Type") !== `${r}/slide` ||
      (relation.getAttribute("TargetMode") ?? "Internal").toLowerCase() !==
        "internal"
    )
      fail("slide identity or external relationship");
    const target = relation.getAttribute("Target") ?? "";
    const path = resolvePartTarget("ppt/presentation.xml", target);
    if (!/\.xml$/i.test(path) || Array.from(paths.values()).includes(path))
      fail("slide relationship path");
    paths.set(id, path);
    relationIds.add(relationId);
  }
  return paths;
}

/** OPC Target 是源 part 的相对 URI；允许 ..，但不能越过包根或变成外部 URI。 */
export function resolvePartTarget(source: string, target: string): string {
  if (!target || target.startsWith("//") || /[\\:#?%]/u.test(target))
    fail("relationship path");
  const parts = target.startsWith("/") ? [] : source.split("/").slice(0, -1);
  for (const segment of target.replace(/^\//, "").split("/")) {
    if (!segment) fail("relationship path");
    if (segment === ".") continue;
    if (segment === "..") {
      if (!parts.length) fail("relationship path escapes package");
      parts.pop();
    } else parts.push(segment);
  }
  const path = parts.join("/");
  if (!packagePath(path) || path.endsWith("/")) fail("relationship path");
  return path;
}

export function relationPartPath(path: string): string {
  const split = path.lastIndexOf("/");
  return `${path.slice(0, split + 1)}_rels/${path.slice(split + 1)}.rels`;
}

export function relativePartTarget(source: string, target: string): string {
  const from = source.split("/").slice(0, -1),
    to = target.split("/");
  while (from.length && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  return [...from.map(() => ".."), ...to].join("/");
}

export async function loadPresentationPackage(
  bytes: Uint8Array,
): Promise<JSZip> {
  checkArchive(bytes);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  for (const [name, entry] of Object.entries(zip.files))
    if (!entry.dir && /\.(?:xml|rels)$/i.test(name))
      checkXmlSource(await entry.async("string"));
  return zip;
}

export async function savePresentationPackage(zip: JSZip): Promise<Uint8Array> {
  const output = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  checkArchive(output);
  return output;
}
