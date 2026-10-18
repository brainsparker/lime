import {
  materializeSlideNodes,
  type SlideNode,
  type TextBody,
} from "@aiden0z/pptx-renderer";
import type { PresentationSnapshot } from "./presentationDocument";

export function presentationElements(
  document: PresentationSnapshot,
  slideId: string,
): readonly SlideNode[] {
  const slide = document.model.slides[document.slideIds.indexOf(slideId)];
  if (!slide) return [];
  materializeSlideNodes(document.model, slide);
  return slide.nodes.filter((node) => node.nodeType !== "group");
}

export function presentationElementText(node: SlideNode): string | undefined {
  if (node.nodeType !== "shape" || !node.textBody) return undefined;
  return presentationTextBodyText(node.textBody);
}

export function presentationTextBodyText(body: TextBody): string | undefined {
  if (
    body.paragraphs.some((paragraph) =>
      paragraph.runs.some((run) => run.fieldType || run.math),
    )
  )
    return undefined;
  return body.paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n");
}

export function presentationElementFrame(node: SlideNode) {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.size.w,
    height: node.size.h,
  };
}

export function presentationElementStyle(node: SlideNode) {
  return presentationTextBodyStyle(
    node.nodeType === "shape" ? node.textBody : undefined,
  );
}

export function presentationTextBodyStyle(body?: TextBody) {
  const paragraph = body?.paragraphs[0];
  const properties =
    paragraph?.runs[0]?.properties ??
    paragraph?.properties?.child("defRPr") ??
    paragraph?.endParaRPr;
  return {
    bold: ["1", "true"].includes(properties?.attr("b") ?? ""),
    italic: ["1", "true"].includes(properties?.attr("i") ?? ""),
    fontSize: properties?.numAttr("sz") ? properties.numAttr("sz")! / 75 : 20,
    color:
      properties?.child("solidFill").child("srgbClr").attr("val") ?? "000000",
  };
}
