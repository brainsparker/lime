import { a, fail, children, one, create } from "./presentationPackageXml";
import { createPresentationTextRangeAdapter } from "./presentationTextRange";
import {
  presentationTextContent,
  textRun,
  validateTextInput,
  validTextBoundary,
} from "./presentationTextRangeXml";
export { validateTextBody } from "./presentationTextRangeXml";

export interface PresentationTextStyle {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

const fills = new Set([
  "noFill",
  "solidFill",
  "gradFill",
  "blipFill",
  "pattFill",
  "grpFill",
]);

export function replaceText(body: Element, value: string) {
  const next = validateTextInput(value),
    previous = presentationTextContent(body);
  if (previous === next && children(body, a, "p").length) return;
  let start = 0,
    previousEnd = previous.length,
    nextEnd = next.length;
  while (
    start < previousEnd &&
    start < nextEnd &&
    previous[start] === next[start]
  )
    start++;
  while (!validTextBoundary(previous, start) || !validTextBoundary(next, start))
    start--;
  while (
    previousEnd > start &&
    nextEnd > start &&
    previous[previousEnd - 1] === next[nextEnd - 1]
  ) {
    previousEnd--;
    nextEnd--;
  }
  while (
    !validTextBoundary(previous, previousEnd) ||
    !validTextBoundary(next, nextEnd)
  ) {
    previousEnd++;
    nextEnd++;
  }
  const adapter = createPresentationTextRangeAdapter(body, "text");
  adapter.replaceRange(
    adapter.positionAtOffset(start),
    adapter.positionAtOffset(previousEnd),
    next.slice(start, nextEnd),
  );
  if (!children(body, a, "p").length) {
    const paragraph = create(body, a, "p");
    paragraph.append(textRun(body, ""));
    body.append(paragraph);
  }
}

export function replaceFill(element: Element, color: string) {
  for (const child of Array.from(element.children))
    if (child.namespaceURI === a && fills.has(child.localName)) child.remove();
  const solid = create(element, a, "solidFill"),
    rgb = create(element, a, "srgbClr");
  rgb.setAttribute("val", color);
  solid.append(rgb);
  const before =
    element.localName === "rPr" ||
    element.localName === "defRPr" ||
    element.localName === "endParaRPr"
      ? ["ln"]
      : element.localName === "tcPr"
        ? ["lnL", "lnR", "lnT", "lnB", "lnTlToBr", "lnBlToTr", "cell3D"]
        : ["xfrm", "prstGeom", "custGeom"];
  element.insertBefore(
    solid,
    Array.from(element.children).find(
      (child) => child.namespaceURI !== a || !before.includes(child.localName),
    ) ?? null,
  );
}

export function rgb(value: string): string {
  if (typeof value !== "string" || !/^#?[0-9a-f]{6}$/i.test(value))
    fail("RGB color");
  return value.replace(/^#/, "").toUpperCase();
}

/** fontSize 使用 CSS px，与 renderer 一致；OOXML sz 使用百分之一 pt。 */
export function applyTextStyle(body: Element, style: PresentationTextStyle) {
  const { fontSize, bold, italic, color } = style;
  const size = fontSize === undefined ? undefined : Math.round(fontSize * 75);
  if (
    (fontSize !== undefined &&
      (typeof fontSize !== "number" ||
        !Number.isFinite(fontSize) ||
        size! < 1 ||
        size! > 400000)) ||
    (bold !== undefined && typeof bold !== "boolean") ||
    (italic !== undefined && typeof italic !== "boolean")
  )
    fail("text style");
  const textColor = color === undefined ? undefined : rgb(color);
  for (const paragraph of children(body, a, "p")) {
    let properties = one(paragraph, a, "pPr");
    if (!properties) {
      properties = create(paragraph, a, "pPr");
      paragraph.insertBefore(properties, paragraph.firstChild);
    }
    let defaults = one(properties, a, "defRPr");
    if (!defaults) {
      defaults = create(properties, a, "defRPr");
      properties.insertBefore(defaults, one(properties, a, "extLst") ?? null);
    }
    for (const run of children(paragraph, a, "r").concat(
      children(paragraph, a, "br"),
    )) {
      if (!one(run, a, "rPr"))
        run.insertBefore(create(run, a, "rPr"), run.firstChild);
    }
  }
  for (const name of ["rPr", "defRPr", "endParaRPr"])
    for (const properties of Array.from(body.getElementsByTagNameNS(a, name))) {
      if (size !== undefined) properties.setAttribute("sz", String(size));
      if (bold !== undefined) properties.setAttribute("b", bold ? "1" : "0");
      if (italic !== undefined)
        properties.setAttribute("i", italic ? "1" : "0");
      if (textColor !== undefined) replaceFill(properties, textColor);
    }
}
