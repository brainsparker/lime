import { a, r, relationships, fail, readXml } from "./presentationPackageXml";

export interface PresentationTextHyperlink {
  id: string;
  url: string;
}

export function presentationTextHyperlinkUrl(
  value: string,
): string | undefined {
  if (
    typeof value !== "string" ||
    value.length > 8192 ||
    value !== value.trim() ||
    Array.from(value).some((character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || code === 127;
    })
  )
    return undefined;
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(value).protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export function presentationTextRelationships(source?: string): Document {
  const document = readXml(
    source ?? `<Relationships xmlns="${relationships}"/>`,
  );
  const root = document.documentElement,
    ids = new Set<string>();
  if (root.namespaceURI !== relationships || root.localName !== "Relationships")
    fail("text relationship namespace");
  for (const node of Array.from(root.children)) {
    const id = node.getAttribute("Id") ?? "";
    if (
      node.namespaceURI !== relationships ||
      node.localName !== "Relationship" ||
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/u.test(id) ||
      ids.has(id)
    )
      fail("text relationship identity");
    ids.add(id);
  }
  return document;
}

export function presentationTextHyperlinkResolver(
  source?: string,
): (id: string) => string | undefined {
  const document = presentationTextRelationships(source),
    urls = new Map<string, string>();
  for (const node of Array.from(document.documentElement.children)) {
    const value = presentationTextHyperlinkUrl(
      node.getAttribute("Target") ?? "",
    );
    if (
      value &&
      node.getAttribute("Type") === `${r}/hyperlink` &&
      node.getAttribute("TargetMode")?.toLowerCase() === "external"
    )
      urls.set(node.getAttribute("Id")!, value);
  }
  return (id) => urls.get(id);
}

/** 临时 fragment ID 只在此处 lower 为唯一 OPC ID，绝不覆盖已有关系。 */
export function appendPresentationTextHyperlinks(
  document: Document,
  body: Element,
  links: readonly PresentationTextHyperlink[] = [],
): boolean {
  if (!Array.isArray(links) || links.length > 10000) fail("text hyperlinks");
  const root = document.documentElement,
    existing = new Map(
      Array.from(root.children, (node) => [node.getAttribute("Id")!, node]),
    );
  const references = [
    ...Array.from(body.getElementsByTagNameNS(a, "hlinkClick")),
    ...Array.from(body.getElementsByTagNameNS(a, "hlinkMouseOver")),
  ];
  const temporary = new Set<string>(),
    mapping = new Map<string, string>();
  for (const link of links) {
    if (
      !link ||
      typeof link !== "object" ||
      Array.isArray(link) ||
      Reflect.ownKeys(link).some(
        (key) => !["id", "url"].includes(String(key)),
      ) ||
      typeof link.id !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/u.test(link.id) ||
      temporary.has(link.id) ||
      existing.has(link.id) ||
      !presentationTextHyperlinkUrl(link.url)
    )
      fail("text hyperlink input");
    if (
      !references.some(
        (node) =>
          node.localName === "hlinkClick" &&
          node.getAttributeNS(r, "id") === link.id,
      )
    )
      fail("unused text hyperlink");
    temporary.add(link.id);
  }
  let next = 1;
  for (const link of links) {
    while (existing.has(`rId${next}`) || temporary.has(`rId${next}`)) next++;
    const id = `rId${next++}`,
      relation = document.createElementNS(relationships, "Relationship");
    relation.setAttribute("Id", id);
    relation.setAttribute("Type", `${r}/hyperlink`);
    relation.setAttribute("Target", link.url);
    relation.setAttribute("TargetMode", "External");
    root.append(relation);
    existing.set(id, relation);
    mapping.set(link.id, id);
  }
  for (const node of references) {
    const id = node.getAttributeNS(r, "id");
    if (!id) continue;
    const mapped = node.localName === "hlinkClick" && mapping.get(id);
    if (mapped) node.setAttributeNS(r, "r:id", mapped);
    else {
      const relation = existing.get(id);
      const type = relation?.getAttribute("Type");
      const internalSlide =
        type === `${r}/slide` &&
        relation?.getAttribute("TargetMode")?.toLowerCase() !== "external";
      if (type !== `${r}/hyperlink` && !internalSlide)
        fail("missing text hyperlink relationship");
    }
  }
  return mapping.size > 0;
}
