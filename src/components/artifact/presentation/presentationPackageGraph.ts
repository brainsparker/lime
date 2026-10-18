import type JSZip from "jszip";
import {
  children,
  fail,
  loadPresentationPackage,
  packagePath,
  p,
  r,
  readXml,
  relationPartPath,
  relationships,
  relativePartTarget,
  resolvePartTarget,
  xmlPart,
} from "./presentationPackageXml";

const contentTypes =
  "http://schemas.openxmlformats.org/package/2006/content-types";
const relationshipContentType =
  "application/vnd.openxmlformats-package.relationships+xml";
const privateTypes = new Map<string, string | undefined>([
  [
    `${r}/notesSlide`,
    "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml",
  ],
  [
    `${r}/chart`,
    "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
  ],
  [
    `${r}/chartUserShapes`,
    "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml",
  ],
  [
    "http://schemas.microsoft.com/office/2011/relationships/chartStyle",
    "application/vnd.ms-office.chartstyle+xml",
  ],
  [
    "http://schemas.microsoft.com/office/2011/relationships/chartColorStyle",
    "application/vnd.ms-office.chartcolorstyle+xml",
  ],
  [`${r}/package`, undefined],
  [`${r}/oleObject`, undefined],
  [
    `${r}/vmlDrawing`,
    "application/vnd.openxmlformats-officedocument.vmlDrawing",
  ],
]);
const sharedTypes = new Set([
  ...[
    "image",
    "audio",
    "video",
    "hyperlink",
    "slide",
    "slideLayout",
    "slideMaster",
    "notesMaster",
    "theme",
    "themeOverride",
    "font",
  ].map((type) => `${r}/${type}`),
  "http://schemas.microsoft.com/office/2007/relationships/media",
]);

export interface PartRelationship {
  id: string;
  type: string;
  external: boolean;
  target: string;
  path?: string;
  node: Element;
}

/** OPC 图只负责包与关系，不拥有页序或用户选区。 */
export class PresentationPackageGraph {
  readonly relationDocuments = new Map<string, Document>();
  readonly types: Document;
  private readonly originalRelations = new Map<string, string>();
  private readonly originalTypes: string;

  private constructor(
    readonly zip: JSZip,
    types: Document,
  ) {
    this.types = types;
    this.originalTypes = new XMLSerializer().serializeToString(types);
  }

  static async load(bytes: Uint8Array): Promise<PresentationPackageGraph> {
    const zip = await loadPresentationPackage(bytes);
    const names = new Set<string>();
    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const key = path.toLowerCase();
      if (names.has(key)) fail("case-ambiguous part");
      names.add(key);
    }
    const types = await xmlPart(zip, "[Content_Types].xml");
    const graph = new PresentationPackageGraph(zip, types);
    graph.validateTypes();
    for (const [path, entry] of Object.entries(zip.files))
      if (!entry.dir && path !== "[Content_Types].xml") {
        const type = graph.contentType(path);
        if (path.endsWith(".rels") && type !== relationshipContentType)
          fail("relationship content type");
      }
    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir || !path.endsWith(".rels")) continue;
      const match = /^(?:(.*)\/)?_rels\/([^/]+)\.rels$/.exec(path);
      const source =
        path === "_rels/.rels"
          ? ""
          : match
            ? `${match[1] ? `${match[1]}/` : ""}${match[2]}`
            : fail("relationship part path");
      if (source && !zip.file(source)) fail("orphan relationship part");
      const document = readXml(await entry.async("string"));
      graph.relationDocuments.set(source, document);
      graph.originalRelations.set(
        source,
        new XMLSerializer().serializeToString(document),
      );
      for (const relation of graph.relations(source))
        if (!relation.external && !zip.file(relation.path!))
          fail("missing relationship target");
    }
    return graph;
  }

  private validateTypes() {
    const root = this.types.documentElement;
    if (root.namespaceURI !== contentTypes || root.localName !== "Types")
      fail("content types root");
    const defaults = new Set<string>(),
      overrides = new Set<string>();
    for (const node of Array.from(root.children)) {
      if (
        node.namespaceURI !== contentTypes ||
        !node.getAttribute("ContentType")
      )
        fail("content type declaration");
      if (node.localName === "Default") {
        const key = node.getAttribute("Extension")?.toLowerCase() ?? "";
        if (!/^[a-z0-9]+$/i.test(key) || defaults.has(key))
          fail("content type default");
        defaults.add(key);
      } else if (node.localName === "Override") {
        const name = node.getAttribute("PartName") ?? "";
        if (
          !name.startsWith("/") ||
          !packagePath(name.slice(1)) ||
          overrides.has(name.toLowerCase()) ||
          !this.zip.file(name.slice(1))
        )
          fail("content type override");
        overrides.add(name.toLowerCase());
      } else fail("content type declaration");
    }
  }

  private lookupContentType(path: string): string | undefined {
    const root = this.types.documentElement;
    return (
      children(root, contentTypes, "Override")
        .find((node) => node.getAttribute("PartName") === `/${path}`)
        ?.getAttribute("ContentType") ??
      children(root, contentTypes, "Default")
        .find(
          (node) =>
            node.getAttribute("Extension")?.toLowerCase() ===
            path.split(".").pop()?.toLowerCase(),
        )
        ?.getAttribute("ContentType") ??
      undefined
    );
  }

  contentType(path: string): string {
    return this.lookupContentType(path) ?? fail("missing content type");
  }

  setContentType(path: string, type: string) {
    const node = this.types.createElementNS(contentTypes, "Override");
    node.setAttribute("PartName", `/${path}`);
    node.setAttribute("ContentType", type);
    this.types.documentElement.append(node);
  }

  relations(source: string): PartRelationship[] {
    const document = this.relationDocuments.get(source);
    if (!document) return [];
    const root = document.documentElement;
    if (
      root.namespaceURI !== relationships ||
      root.localName !== "Relationships"
    )
      fail("relationship root");
    const ids = new Set<string>();
    return Array.from(root.children, (node) => {
      const id = node.getAttribute("Id") ?? "",
        type = node.getAttribute("Type") ?? "",
        target = node.getAttribute("Target") ?? "";
      const mode = node.getAttribute("TargetMode") ?? "Internal";
      if (
        node.namespaceURI !== relationships ||
        node.localName !== "Relationship" ||
        !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id) ||
        ids.has(id) ||
        !type ||
        !target ||
        !/^(internal|external)$/i.test(mode)
      )
        fail("relationship identity");
      ids.add(id);
      const external = mode.toLowerCase() === "external";
      const path = external ? undefined : resolvePartTarget(source, target);
      if (path === "[Content_Types].xml" || path?.endsWith(".rels"))
        fail("relationship targets reserved part");
      return {
        id,
        type,
        target,
        external,
        path,
        node,
      };
    });
  }

  relationDocument(source: string): Document {
    let document = this.relationDocuments.get(source);
    if (!document) {
      document = readXml(`<Relationships xmlns="${relationships}"/>`);
      this.relationDocuments.set(source, document);
    }
    return document;
  }

  addRelation(
    source: string,
    type: string,
    path: string,
    external = false,
  ): string {
    const document = this.relationDocument(source),
      ids = new Set(this.relations(source).map((relation) => relation.id));
    let index = 1;
    while (ids.has(`rId${index}`)) index++;
    const id = `rId${index}`,
      node = document.createElementNS(relationships, "Relationship");
    node.setAttribute("Id", id);
    node.setAttribute("Type", type);
    node.setAttribute(
      "Target",
      external ? path : relativePartTarget(source, path),
    );
    if (external) node.setAttribute("TargetMode", "External");
    document.documentElement.append(node);
    return id;
  }

  allocate(path: string, reserved = new Set<string>()): string {
    const match = /^(.*?)(\d*)(\.[^/.]+)$/.exec(path);
    if (!match) fail("clone part name");
    const existing = new Set(
      [...Object.keys(this.zip.files), ...reserved].map((name) =>
        name.toLowerCase(),
      ),
    );
    let index = 1,
      candidate: string;
    do {
      candidate = `${match[1]}${index++}${match[3]}`;
    } while (
      existing.has(candidate.toLowerCase()) ||
      existing.has(relationPartPath(candidate).toLowerCase())
    );
    return candidate;
  }

  /** 可编辑子图独立复制；媒体、master、layout 和普通跳转继续共享。 */
  async duplicateSlide(source: string): Promise<string> {
    const mapping = new Map<string, string>(),
      reserved = new Set<string>();
    const allocate = (path: string) => {
      const result = this.allocate(path, reserved);
      reserved.add(result);
      mapping.set(path, result);
    };
    allocate(source);
    const queue = [source];
    for (let index = 0; index < queue.length; index++) {
      if (queue.length > 1000) fail("clone graph size");
      for (const relation of this.relations(queue[index])) {
        if (relation.external) continue;
        if (privateTypes.has(relation.type)) {
          const expected = privateTypes.get(relation.type);
          if (expected && this.contentType(relation.path!) !== expected)
            fail("private relationship content type");
          if (relation.type === `${r}/notesSlide`) {
            const notes = await xmlPart(this.zip, relation.path!);
            const backlinks = this.relations(relation.path!).filter(
              (item) => item.type === `${r}/slide`,
            );
            if (
              queue[index] !== source ||
              notes.documentElement.namespaceURI !== p ||
              notes.documentElement.localName !== "notes" ||
              backlinks.length !== 1 ||
              backlinks[0].external ||
              backlinks[0].path !== source
            )
              fail("notes slide backlink");
          }
          if (!mapping.has(relation.path!)) {
            allocate(relation.path!);
            queue.push(relation.path!);
          }
        } else if (!sharedTypes.has(relation.type))
          fail("unsupported slide clone relationship");
      }
    }
    for (const [path, target] of mapping) {
      const bytes = await this.zip.file(path)!.async("uint8array");
      if (/\.xml$/i.test(path))
        readXml(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      this.zip.file(target, bytes);
      this.setContentType(target, this.contentType(path));
    }
    for (const [path, target] of mapping) {
      const original = this.relationDocuments.get(path);
      if (!original) continue;
      const copy = original.cloneNode(true) as Document;
      this.relationDocuments.set(target, copy);
      for (const relation of this.relations(path)) {
        if (relation.external) continue;
        const node = Array.from(copy.documentElement.children).find(
          (child) => child.getAttribute("Id") === relation.id,
        )!;
        node.setAttribute(
          "Target",
          relativePartTarget(
            target,
            mapping.get(relation.path!) ?? relation.path!,
          ),
        );
      }
    }
    return mapping.get(source)!;
  }

  privateParts(source: string): Set<string> {
    const candidates = new Set([source]),
      queue = [source];
    for (let index = 0; index < queue.length; index++)
      for (const relation of this.relations(queue[index]))
        if (
          !relation.external &&
          privateTypes.has(relation.type) &&
          !candidates.has(relation.path!)
        ) {
          candidates.add(relation.path!);
          queue.push(relation.path!);
        }
    return candidates;
  }

  /** 仅移除没有剩余入边的私有闭包；被其他页使用的子图完整保留。 */
  removeSlide(source: string) {
    const candidates = this.privateParts(source);
    const retained = new Set<string>();
    for (const owner of this.relationDocuments.keys())
      if (!candidates.has(owner))
        for (const relation of this.relations(owner))
          if (!relation.external && candidates.has(relation.path!))
            retained.add(relation.path!);
    const live = [...retained];
    for (let index = 0; index < live.length; index++)
      for (const relation of this.relations(live[index]))
        if (
          !relation.external &&
          candidates.has(relation.path!) &&
          !retained.has(relation.path!)
        ) {
          retained.add(relation.path!);
          live.push(relation.path!);
        }
    if (retained.has(source)) fail("slide has remaining references");
    for (const path of candidates) {
      if (retained.has(path)) continue;
      this.zip.remove(path);
      this.zip.remove(relationPartPath(path));
      this.relationDocuments.delete(path);
      for (const node of children(
        this.types.documentElement,
        contentTypes,
        "Override",
      ))
        if (
          [`/${path}`, `/${relationPartPath(path)}`].includes(
            node.getAttribute("PartName") ?? "",
          )
        )
          node.remove();
    }
  }

  write() {
    for (const source of this.relationDocuments.keys()) {
      if (source && !this.zip.file(source)) fail("orphan relationship part");
      for (const relation of this.relations(source))
        if (!relation.external && !this.zip.file(relation.path!))
          fail("missing relationship target");
    }
    const serialize = new XMLSerializer();
    for (const [source, document] of this.relationDocuments) {
      const xml = serialize.serializeToString(document);
      const path = source ? relationPartPath(source) : "_rels/.rels";
      if (xml !== this.originalRelations.get(source)) this.zip.file(path, xml);
      if (!this.lookupContentType(path))
        this.setContentType(path, relationshipContentType);
    }
    this.validateTypes();
    const types = serialize.serializeToString(this.types);
    if (types !== this.originalTypes)
      this.zip.file("[Content_Types].xml", types);
  }
}
