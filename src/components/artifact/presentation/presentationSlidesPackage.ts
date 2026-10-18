import { PresentationPackageGraph } from "./presentationPackageGraph";
import {
  a,
  children,
  create,
  fail,
  numericId,
  one,
  p,
  r,
  readXml,
  savePresentationPackage,
  slidePaths,
  xmlPart,
} from "./presentationPackageXml";

const presentationPath = "ppt/presentation.xml";
const slideContentType =
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const layoutContentType =
  "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml";
const extendedProperties =
  "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties";

export type PresentationSlideEdit =
  | { type: "add"; afterSlideId?: string; layoutId?: string }
  | { type: "duplicate"; slideId: string }
  | { type: "move"; slideId: string; toIndex: number }
  | { type: "delete"; slideId: string };

export interface PresentationSlideTemplate {
  /** Lime 的 OPC part 路径；不是恢复出的上游 proto layout id。 */
  id: string;
  name: string;
  masterName: string;
}

export interface PresentationSlidesPackageResult {
  bytes: Uint8Array;
  slideIds: string[];
  /** 按 add/duplicate 操作顺序；选中状态仍由 Controller 持有。 */
  createdSlideIds: string[];
}

interface Layout extends PresentationSlideTemplate {
  xml: Document;
}

function assertRoot(xml: Document, name: string) {
  if (
    xml.documentElement.namespaceURI !== p ||
    xml.documentElement.localName !== name
  )
    fail(`${name} root`);
}

async function layouts(
  graph: PresentationPackageGraph,
  presentation: Document,
): Promise<Layout[]> {
  const result: Layout[] = [],
    seen = new Set<string>();
  const list = one(presentation.documentElement, p, "sldMasterIdLst");
  const masterRelations = graph.relations(presentationPath);
  for (const entry of Array.from(list?.children ?? [])) {
    const relation = masterRelations.find(
      (item) => item.id === entry.getAttributeNS(r, "id"),
    );
    if (
      entry.namespaceURI !== p ||
      entry.localName !== "sldMasterId" ||
      !relation ||
      relation.external ||
      relation.type !== `${r}/slideMaster`
    )
      fail("slide master inventory");
    const masterPath = relation.path!,
      master = await xmlPart(graph.zip, masterPath);
    assertRoot(master, "sldMaster");
    const masterName =
      one(master.documentElement, p, "cSld")?.getAttribute("name") ||
      masterPath.split("/").pop()!;
    const layoutList = one(master.documentElement, p, "sldLayoutIdLst"),
      masterRels = graph.relations(masterPath);
    for (const item of Array.from(layoutList?.children ?? [])) {
      const layoutRelation = masterRels.find(
        (candidate) => candidate.id === item.getAttributeNS(r, "id"),
      );
      if (
        item.namespaceURI !== p ||
        item.localName !== "sldLayoutId" ||
        !layoutRelation ||
        layoutRelation.external ||
        layoutRelation.type !== `${r}/slideLayout`
      )
        fail("layout inventory");
      const path = layoutRelation.path!;
      if (seen.has(path) || graph.contentType(path) !== layoutContentType)
        fail("layout identity or content type");
      seen.add(path);
      const xml = await xmlPart(graph.zip, path);
      assertRoot(xml, "sldLayout");
      const backlink = graph
        .relations(path)
        .filter((candidate) => candidate.type === `${r}/slideMaster`);
      if (
        backlink.length !== 1 ||
        backlink[0].external ||
        backlink[0].path !== masterPath
      )
        fail("layout master backlink");
      const name =
        one(xml.documentElement, p, "cSld")?.getAttribute("name") ||
        xml.documentElement.getAttribute("matchingName") ||
        xml.documentElement.getAttribute("type") ||
        path.split("/").pop()!;
      result.push({ id: path, name, masterName, xml });
    }
  }
  return result;
}

/** 模板来自真实 master/layout 关系序列，孤立 ZIP 成员不会变成可选模板。 */
export async function readPresentationSlideTemplates(
  bytes: Uint8Array,
): Promise<PresentationSlideTemplate[]> {
  const graph = await PresentationPackageGraph.load(bytes),
    presentation = await xmlPart(graph.zip, presentationPath);
  assertRoot(presentation, "presentation");
  return (await layouts(graph, presentation)).map(
    ({ id, name, masterName }) => ({ id, name, masterName }),
  );
}

function shapeTree(xml: Document): Element {
  const content = one(xml.documentElement, p, "cSld"),
    tree = content && one(content, p, "spTree");
  return tree ?? fail("slide shape tree");
}

function removeHyperlinks(element: Element) {
  for (const name of ["hlinkClick", "hlinkMouseOver"])
    for (const link of Array.from(element.getElementsByTagNameNS(a, name)))
      link.remove();
}

function emptyPlaceholder(shape: Element, id: number): Element {
  const copy = shape.cloneNode(true) as Element;
  const properties = one(copy, p, "nvSpPr"),
    identity = properties && one(properties, p, "cNvPr");
  if (!identity) fail("layout placeholder identity");
  identity.setAttribute("id", String(id));
  const frame = one(copy, p, "spPr");
  if (frame) one(frame, a, "xfrm")?.remove();
  const body = one(copy, p, "txBody");
  if (body) {
    const firstParagraph = children(body, a, "p")[0],
      firstProperties = firstParagraph && one(firstParagraph, a, "pPr");
    const firstRun = firstParagraph?.getElementsByTagNameNS(a, "rPr")[0];
    for (const paragraph of children(body, a, "p")) paragraph.remove();
    const paragraph = create(body, a, "p"),
      run = create(body, a, "r"),
      text = create(body, a, "t");
    if (firstProperties) paragraph.append(firstProperties.cloneNode(true));
    if (firstRun) run.append(firstRun.cloneNode(true));
    run.append(text);
    paragraph.append(run);
    body.append(paragraph);
  }
  removeHyperlinks(copy);
  return copy;
}

async function addSlide(
  graph: PresentationPackageGraph,
  available: Layout[],
  afterPath: string | undefined,
  requested: string | undefined,
): Promise<string> {
  if (requested !== undefined && typeof requested !== "string")
    fail("layout id");
  const inherited = afterPath
    ? graph
        .relations(afterPath)
        .filter((item) => item.type === `${r}/slideLayout`)
    : [];
  if (inherited.length > 1 || inherited.some((item) => item.external))
    fail("slide layout relationship");
  const id = requested || inherited[0]?.path;
  const layout = id
    ? available.find((item) => item.id === id)
    : available.find(
        (item) => item.xml.documentElement.getAttribute("type") === "blank",
      );
  // 与可不绑定 layout 的 proto 模型不同，原包新增必须有真实可解析的版式。
  if (!layout) fail(id ? "missing layout identity" : "missing blank layout");
  const path = graph.allocate("ppt/slides/slide1.xml");
  const slide = readXml(
    `<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
  );
  const tree = shapeTree(slide),
    templateTree = shapeTree(layout.xml),
    relationIds = new Map<string, string>();
  const sourceRelations = graph.relations(layout.id);
  let nextId = 2;
  for (const shape of Array.from(templateTree.children)) {
    const placeholders = Array.from(shape.getElementsByTagNameNS(p, "ph"));
    if (!placeholders.length) continue;
    const identity = shape.getElementsByTagNameNS(p, "cNvPr")[0];
    if (
      identity?.getAttribute("hidden") === "1" ||
      identity?.getAttribute("hidden") === "true"
    )
      continue;
    const eligible = placeholders.filter(
      (node) =>
        !["hdr", "ftr", "dt", "sldNum"].includes(
          node.getAttribute("type") ?? "obj",
        ),
    );
    if (!eligible.length) continue;
    if (
      shape.namespaceURI !== p ||
      shape.localName !== "sp" ||
      placeholders.length !== 1
    )
      fail("unsupported layout placeholder");
    const copy = emptyPlaceholder(shape, nextId++);
    for (const element of [copy, ...Array.from(copy.getElementsByTagName("*"))])
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.namespaceURI !== r) continue;
        let replacement = relationIds.get(attribute.value);
        if (!replacement) {
          const relation = sourceRelations.find(
            (candidate) => candidate.id === attribute.value,
          );
          if (
            !relation ||
            ![`${r}/image`, `${r}/hyperlink`, `${r}/slide`].includes(
              relation.type,
            )
          )
            fail("unsupported placeholder relationship");
          replacement = graph.addRelation(
            path,
            relation.type,
            relation.external ? relation.target : relation.path!,
            relation.external,
          );
          relationIds.set(attribute.value, replacement);
        }
        attribute.value = replacement;
      }
    tree.append(slide.importNode(copy, true));
  }
  graph.zip.file(path, new XMLSerializer().serializeToString(slide));
  graph.setContentType(path, slideContentType);
  graph.addRelation(path, `${r}/slideLayout`, layout.id);
  return path;
}

function newSlideId(paths: Map<string, string>): string {
  const maximum = Math.max(255, ...Array.from(paths.keys(), Number));
  if (maximum < 2147483647) return String(maximum + 1);
  let next = 256;
  while (paths.has(String(next))) next++;
  return String(next);
}

function removeCustomShowReferences(
  presentation: Document,
  relationshipId: string,
) {
  const list = one(presentation.documentElement, p, "custShowLst");
  for (const show of Array.from(list?.children ?? [])) {
    const slides = one(show, p, "sldLst");
    for (const slide of Array.from(slides?.children ?? []))
      if (slide.getAttributeNS(r, "id") === relationshipId) slide.remove();
    if (slides && !slides.children.length) {
      const removedId = show.getAttribute("id");
      const properties = one(presentation.documentElement, p, "showPr");
      const selectedShow = properties && one(properties, p, "custShow");
      if (selectedShow?.getAttribute("id") === removedId) selectedShow.remove();
      show.remove();
    }
  }
  if (list && !list.children.length) list.remove();
}

async function removeIncomingLinks(
  graph: PresentationPackageGraph,
  deletedPath: string,
) {
  const privateParts = graph.privateParts(deletedPath);
  for (const owner of graph.relationDocuments.keys()) {
    if (privateParts.has(owner)) continue;
    const incoming = graph
      .relations(owner)
      .filter((item) => !item.external && item.path === deletedPath);
    if (!incoming.length) continue;
    if (!owner) fail("unsupported incoming slide relationship");
    const xml = await xmlPart(graph.zip, owner);
    assertRoot(xml, "sld");
    for (const relation of incoming) {
      if (relation.type !== `${r}/slide`)
        fail("unsupported incoming slide relationship");
      for (const element of Array.from(xml.getElementsByTagName("*")))
        for (const attribute of Array.from(element.attributes))
          if (attribute.namespaceURI === r && attribute.value === relation.id) {
            if (
              element.namespaceURI !== a ||
              !["hlinkClick", "hlinkMouseOver"].includes(element.localName)
            )
              fail("unsupported incoming slide reference");
            element.remove();
          }
      relation.node.remove();
    }
    graph.zip.file(owner, new XMLSerializer().serializeToString(xml));
  }
}

async function updateSlideMetadata(
  graph: PresentationPackageGraph,
  count: number,
) {
  for (const relation of graph.relations("")) {
    if (relation.type !== `${r}/extended-properties` || relation.external)
      continue;
    const xml = await xmlPart(graph.zip, relation.path!),
      root = xml.documentElement;
    if (
      root.namespaceURI !== extendedProperties ||
      root.localName !== "Properties"
    )
      fail("extended properties root");
    const slides = one(root, extendedProperties, "Slides");
    if (slides) slides.textContent = String(count);
    // 页标题/主题分组是可选派生缓存；结构修改后交由 Office 重建，避免保留陈旧序列。
    for (const name of ["HeadingPairs", "TitlesOfParts"])
      one(root, extendedProperties, name)?.remove();
    graph.zip.file(relation.path!, new XMLSerializer().serializeToString(xml));
  }
}

/** 修改真实 sldId/关系/私有子图；失败只抛错，调用者原字节与稿件不变。 */
export async function editPresentationSlidesPackage(
  bytes: Uint8Array,
  edits: readonly PresentationSlideEdit[],
): Promise<PresentationSlidesPackageResult> {
  const graph = await PresentationPackageGraph.load(bytes),
    presentation = await xmlPart(graph.zip, presentationPath);
  const relations = graph.relationDocument(presentationPath);
  let paths = slidePaths(presentation, relations);
  for (const path of paths.values())
    if (graph.contentType(path) !== slideContentType)
      fail("slide content type");
  const createdSlideIds: string[] = [];
  if (!edits.length)
    return {
      bytes: bytes.slice(),
      slideIds: [...paths.keys()],
      createdSlideIds,
    };
  // section 的跨节移动合同尚未由参考证明，不能生成看似成功但分节不一致的包。
  if (
    Array.from(presentation.getElementsByTagName("*")).some(
      (node) => node.localName === "sectionLst",
    )
  )
    fail("unsupported presentation sections");
  let available: Layout[] | undefined;
  for (const edit of edits) {
    const list = one(presentation.documentElement, p, "sldIdLst")!;
    if (!["add", "duplicate", "move", "delete"].includes(edit.type))
      fail("slide operation");
    const id = edit.type === "add" ? edit.afterSlideId : edit.slideId;
    if (id !== undefined && (!numericId(id, 256, 2147483647) || !paths.has(id)))
      fail("missing slide identity");
    const entries = Array.from(list.children),
      index =
        id === undefined
          ? entries.length - 1
          : entries.findIndex((node) => node.getAttribute("id") === id);
    if (edit.type === "add" || edit.type === "duplicate") {
      if (paths.size >= 1000) fail("slide inventory limit");
      let path: string;
      if (edit.type === "duplicate") {
        const source = paths.get(edit.slideId)!;
        const xml = await xmlPart(graph.zip, source);
        assertRoot(xml, "sld");
        shapeTree(xml);
        path = await graph.duplicateSlide(source);
      } else {
        available ??= await layouts(graph, presentation);
        path = await addSlide(
          graph,
          available,
          id === undefined ? undefined : paths.get(id),
          edit.layoutId,
        );
      }
      const newId = newSlideId(paths),
        node = presentation.createElementNS(p, "p:sldId");
      node.setAttribute("id", newId);
      node.setAttributeNS(
        r,
        "r:id",
        graph.addRelation(presentationPath, `${r}/slide`, path),
      );
      list.insertBefore(node, entries[index + 1] ?? null);
      createdSlideIds.push(newId);
    } else if (edit.type === "move") {
      if (typeof edit.toIndex !== "number") fail("slide destination index");
      const target = Math.max(
        0,
        Math.min(
          entries.length - 1,
          Number.isFinite(edit.toIndex) ? Math.trunc(edit.toIndex) : 0,
        ),
      );
      const [source] = entries.splice(index, 1);
      source.remove();
      list.insertBefore(source, entries[target] ?? null);
    } else {
      if (paths.size <= 1) fail("cannot delete last slide");
      const node = entries[index],
        relationshipId = node.getAttributeNS(r, "id")!;
      removeCustomShowReferences(presentation, relationshipId);
      for (const relation of graph.relations(presentationPath))
        if (
          !relation.external &&
          relation.path === paths.get(edit.slideId) &&
          relation.type === `${r}/slide`
        ) {
          removeCustomShowReferences(presentation, relation.id);
          relation.node.remove();
        }
      await removeIncomingLinks(graph, paths.get(edit.slideId)!);
      graph.removeSlide(paths.get(edit.slideId)!);
      node.remove();
    }
    paths = slidePaths(presentation, relations);
  }
  await updateSlideMetadata(graph, paths.size);
  graph.zip.file(
    presentationPath,
    new XMLSerializer().serializeToString(presentation),
  );
  graph.write();
  return {
    bytes: await savePresentationPackage(graph.zip),
    slideIds: [...paths.keys()],
    createdSlideIds,
  };
}
