import { a, children, create, fail, one } from "./presentationPackageXml";

export function tableStyleLine(
  border: Element,
  context: { lineStyles: readonly Element[] },
): Element | null | undefined {
  const line = one(border, a, "ln");
  if (line && one(border, a, "lnRef"))
    fail("ambiguous table border line reference");
  if (line) return line;
  const ref = one(border, a, "lnRef");
  if (!ref) return undefined;
  const raw = ref.getAttribute("idx") ?? "";
  if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    fail("table border line reference");
  const index = Number(raw);
  if (!index) return null;
  const template = context.lineStyles[index - 1];
  if (!template) fail("unresolved table border line reference");
  const clone = template.cloneNode(true) as Element,
    referenceColor = Array.from(ref.children).find(
      (child) => child.namespaceURI === a,
    );
  if (referenceColor) {
    for (const color of Array.from(
      clone.getElementsByTagNameNS(a, "schemeClr"),
    ))
      if (color.getAttribute("val") === "phClr") {
        const replacement = referenceColor.cloneNode(true) as Element;
        for (const transform of Array.from(color.children))
          replacement.append(transform.cloneNode(true));
        color.replaceWith(replacement);
      }
    if (
      !Array.from(clone.children).some(
        (child) =>
          child.namespaceURI === a &&
          [
            "solidFill",
            "gradFill",
            "noFill",
            "pattFill",
            "blipFill",
            "grpFill",
          ].includes(child.localName),
      )
    ) {
      const fill = create(clone, a, "solidFill");
      fill.append(referenceColor.cloneNode(true));
      clone.prepend(fill);
    }
  }
  return clone;
}

/** public renderer 会忽略 lnRef 模板的 dash；只在该次渲染的样式副本中展开引用。 */
export function materializeTableStyleLines(
  root: Element | undefined,
  lineStyles: readonly Element[],
): Element | undefined {
  if (!root || !root.getElementsByTagNameNS(a, "lnRef").length)
    return undefined;
  const clone = root.cloneNode(true) as Element;
  for (const reference of Array.from(
    clone.getElementsByTagNameNS(a, "lnRef"),
  )) {
    const border = reference.parentElement;
    if (!border) fail("missing table border line reference parent");
    const resolved = tableStyleLine(border, { lineStyles });
    if (resolved === undefined) fail("unresolved table border style line");
    const line =
      resolved === null
        ? create(border, a, "ln")
        : clone.ownerDocument.importNode(resolved, true);
    if (resolved === null) line.append(create(border, a, "noFill"));
    for (const child of children(border, a, "lnRef")) child.replaceWith(line);
  }
  return clone;
}
