import { a, children, fail } from "./presentationPackageXml";
import { presentationTableBuiltinStyle } from "./presentationTableBuiltinStyle";

/** custom 优先；builtin 只消费唯一 owner，且必须有真实主题关系链。 */
export function presentationTableStyleDefinition(
  styles: Element | undefined,
  id: string | undefined,
  themeAvailable: boolean,
): { definition?: Element; builtin: boolean } {
  if (!id?.trim()) return { builtin: false };
  if (
    styles &&
    (styles.namespaceURI !== a || styles.localName !== "tblStyleLst")
  )
    fail("invalid table style list");
  const canonical = id.trim().toUpperCase();
  const definitions = styles
    ? children(styles, a, "tblStyle").filter(
        (style) =>
          style.getAttribute("styleId")?.trim().toUpperCase() === canonical,
      )
    : [];
  if (definitions.length > 1) fail("ambiguous table style identity");
  let definition = definitions[0];
  const builtin = !definition;
  if (!definition) {
    const source = presentationTableBuiltinStyle(canonical);
    if (!source) fail("unresolved table border style identity");
    if (!themeAvailable) fail("unresolved table border style theme");
    definition = new DOMParser().parseFromString(
      source,
      "application/xml",
    ).documentElement;
    if (
      definition.namespaceURI !== a ||
      definition.localName !== "tblStyle" ||
      definition.ownerDocument.querySelector("parsererror")
    )
      fail("invalid builtin table style definition");
  }
  if (
    Array.from(definition.attributes).some(
      (attribute) => attribute.localName === "basedOn",
    ) ||
    Array.from(definition.children).some(
      (child) => child.localName === "basedOn",
    )
  )
    fail("unsupported table border style inheritance");
  return { definition, builtin };
}

/** 仅补当前 slide 所需定义/大小写别名；源列表不改，renderer 按原 ID 精确匹配。 */
export function presentationTableStyleProjection(
  styles: Element | undefined,
  ids: Iterable<string>,
  themeAvailable: boolean,
): Element | undefined {
  let projection: Element | undefined;
  for (const id of new Set(ids)) {
    let selected: ReturnType<typeof presentationTableStyleDefinition>;
    try {
      selected = presentationTableStyleDefinition(styles, id, themeAvailable);
    } catch {
      // authoring 的 unavailable 不阻断只读预览；保留原 renderer 可观察的 fallback。
      continue;
    }
    const { definition, builtin } = selected;
    if (!definition || (!builtin && definition.getAttribute("styleId") === id))
      continue;
    projection ??= styles
      ? (styles.cloneNode(true) as Element)
      : new DOMParser().parseFromString(
          `<a:tblStyleLst xmlns:a="${a}"/>`,
          "application/xml",
        ).documentElement;
    const alias = projection.ownerDocument.importNode(definition, true);
    alias.setAttribute("styleId", id);
    projection.append(alias);
  }
  return projection;
}
