import {
  a,
  children,
  create,
  fail,
  megabyte,
  one,
  validXmlText,
} from "./presentationPackageXml";

const math = "http://schemas.openxmlformats.org/officeDocument/2006/math";

function validateElementContent(element: Element) {
  if (
    Array.from(element.childNodes).some(
      (node) =>
        (node.nodeType === 3 || node.nodeType === 4) &&
        (node.textContent ?? "").trim(),
    )
  )
    fail("unsupported text content");
}

export function validateTextBody(body: Element): Element {
  validateElementContent(body);
  if (!one(body, a, "bodyPr")) fail("text body properties");
  one(body, a, "lstStyle");
  for (const node of Array.from(body.getElementsByTagNameNS("*", "*")))
    if (
      node.namespaceURI === math ||
      (node.namespaceURI === a && node.localName === "fld")
    )
      fail("unsupported field or text content");
  for (const child of Array.from(body.children)) {
    if (
      child.namespaceURI !== a ||
      !["bodyPr", "lstStyle", "p"].includes(child.localName)
    )
      fail("unsupported text body");
    if (child.localName !== "p") continue;
    validateElementContent(child);
    one(child, a, "pPr");
    one(child, a, "endParaRPr");
    for (const run of Array.from(child.children)) {
      if (
        run.namespaceURI !== a ||
        !["pPr", "r", "br", "endParaRPr"].includes(run.localName)
      )
        fail("unsupported field or text content");
      if (!["r", "br"].includes(run.localName)) continue;
      validateElementContent(run);
      one(run, a, "rPr");
      const texts = children(run, a, "t");
      if (
        Array.from(run.children).some(
          (item) =>
            item.namespaceURI !== a ||
            !["rPr", ...(run.localName === "r" ? ["t"] : [])].includes(
              item.localName,
            ),
        ) ||
        (run.localName === "r" &&
          (texts.length !== 1 ||
            texts[0].children.length > 0 ||
            !validXmlText(texts[0].textContent ?? "")))
      )
        fail("unsupported text run");
    }
  }
  return body;
}

export function textRuns(paragraph: Element): Element[] {
  return Array.from(paragraph.children).filter(
    (node) => node.namespaceURI === a && ["r", "br"].includes(node.localName),
  );
}

export function runText(run: Element): string {
  return run.localName === "br" ? "\n" : (one(run, a, "t")?.textContent ?? "");
}

export function paragraphText(paragraph: Element): string {
  return textRuns(paragraph).map(runText).join("");
}

export function presentationTextContent(body: Element): string {
  validateTextBody(body);
  return children(body, a, "p").map(paragraphText).join("\n");
}

export function validateTextInput(value: string): string {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).length > megabyte ||
    !validXmlText(value)
  )
    fail("text input");
  return value.replace(/\r\n?/g, "\n");
}

/** DOM selection 使用 UTF-16；拒绝代理对中点，不更改组合字符或 IME 文本。 */
export function validTextBoundary(value: string, index: number): boolean {
  return (
    Number.isSafeInteger(index) &&
    index >= 0 &&
    index <= value.length &&
    !(
      index > 0 &&
      index < value.length &&
      /[\uD800-\uDBFF]/u.test(value[index - 1]) &&
      /[\uDC00-\uDFFF]/u.test(value[index])
    )
  );
}

export function cloneElement(element: Element): Element {
  return element.cloneNode(true) as Element;
}

export function textRun(
  parent: Element,
  text: string,
  source?: Element,
): Element {
  const run =
    source?.localName === "r" ? cloneElement(source) : create(parent, a, "r");
  if (source?.localName === "br") {
    const properties = one(source, a, "rPr");
    if (properties) run.append(cloneElement(properties));
  }
  let target = one(run, a, "t");
  if (!target) {
    target = create(parent, a, "t");
    run.append(target);
  }
  target.setAttributeNS(
    "http://www.w3.org/XML/1998/namespace",
    "xml:space",
    "preserve",
  );
  target.textContent = text;
  return run;
}

export function paragraphWithRuns(source: Element, runs: Element[]): Element {
  const result = cloneElement(source);
  for (const run of textRuns(result)) run.remove();
  const end = one(result, a, "endParaRPr") ?? null;
  for (const run of runs) result.insertBefore(run, end);
  return result;
}
