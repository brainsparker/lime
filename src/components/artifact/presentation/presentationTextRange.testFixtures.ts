import { a, p, r, children, readXml } from "./presentationPackageXml";

export const textBlockId = "shape:2";
export const richParagraphs = [
  `<a:p keep="first"><a:pPr lvl="2" marL="321" indent="-12"><a:spcBef><a:spcPts val="400"/></a:spcBef><a:spcAft><a:spcPct val="150000"/></a:spcAft><a:buChar char="•"/><a:extLst><a:ext uri="urn:paragraph"><keep:paragraph keep="yes"/></a:ext></a:extLst></a:pPr><a:r keep="latin"><a:rPr b="1" lang="en-US"><a:hlinkClick r:id="rLink"/><a:latin typeface="Aptos"/><a:extLst><a:ext uri="urn:run"><keep:run keep="yes"/></a:ext></a:extLst></a:rPr><a:t xml:space="preserve">Alpha </a:t></a:r><a:r keep="han"><a:rPr i="1" lang="zh-CN" custom="retained"/><a:t>中😀文</a:t></a:r><a:br><a:rPr lang="ja-JP"/></a:br><a:r keep="tail"><a:rPr u="sng"/><a:t>tail</a:t></a:r><a:endParaRPr lang="ko-KR" custom="end-first"/></a:p>`,
  `<a:p keep="second"><a:pPr algn="r" lvl="1"><a:buAutoNum type="arabicPeriod" startAt="4"/></a:pPr><a:r><a:rPr lang="fr-FR"/><a:t xml:space="preserve">Second </a:t></a:r><a:r><a:rPr sz="2300"><a:hlinkClick r:id="rOther"/></a:rPr><a:t>👩‍💻IME</a:t></a:r><a:endParaRPr lang="en-GB" custom="end-second"/></a:p>`,
  `<a:p keep="third"><a:pPr algn="ctr"/><a:r><a:rPr lang="ja-JP"/><a:t>Third</a:t></a:r><a:endParaRPr custom="end-third"/></a:p>`,
];

export function textBodyFixture(
  options: { cell?: boolean; paragraphs?: string[] } = {},
): Element {
  return readXml(
    `<${options.cell ? "a" : "p"}:txBody xmlns:a="${a}" xmlns:p="${p}" xmlns:r="${r}" xmlns:keep="urn:keep"><a:bodyPr wrap="square"/><a:lstStyle><a:lvl1pPr marL="42"/></a:lstStyle>${(options.paragraphs ?? richParagraphs).join("")}</${options.cell ? "a" : "p"}:txBody>`,
  ).documentElement;
}

export const textParagraphs = (body: Element) => children(body, a, "p");
export const serializeText = (node: Node) =>
  new XMLSerializer().serializeToString(node);
