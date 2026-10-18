import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { readPresentationNavigationFile } from "./presentation-navigation-scenario.mjs";

export const richSlidePath = "ppt/slides/slide1.xml";
export const richRelationsPath = "ppt/slides/_rels/slide1.xml.rels";
export const richOriginalText = "Alpha 中😀文\ntail\nSecond 👩‍💻IME\nThird";
export const richEditedText =
  "Lime 中文\ntail\nSecond 👩‍💻IME\nThird\nHard\nSoft";
export const richPastedText = `${richOriginalText}\nHTML_BOLD HTML_ITALIC\nHTML_LIST\nHTML_LINK`;
export const richPasteUrl = "https://example.invalid/rich-paste";
export const richPastePlain = "HTML_BOLD HTML_ITALIC\nHTML_LIST\nHTML_LINK";
export const richPasteHtml = `<p><strong>HTML_BOLD</strong> <em>HTML_ITALIC</em></p><ul><li>HTML_LIST</li></ul><p><a href="${richPasteUrl}">HTML_LINK</a></p>`;
export const richParagraphShapeId = "11";
export const richParagraphOriginalText = "A\nB\nC\nD\nE";
const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rel = "http://schemas.openxmlformats.org/package/2006/relationships";
const xmlns = "http://www.w3.org/2000/xmlns/";
export const richDigest = (value) =>
  createHash("sha256").update(value).digest("hex");
const direct = (node, namespace, name) =>
  Array.from(node?.children ?? []).filter(
    (child) => child.namespaceURI === namespace && child.localName === name,
  );

// 独立手写 XML/期望；不调用生产 range/style/package writer 来产生验收答案。
function richBody(namespace) {
  return `<${namespace}:txBody keep:body="retained"><a:bodyPr wrap="square"/><a:lstStyle><a:lvl1pPr marL="42"/></a:lstStyle><a:p keep="first"><a:pPr lvl="2" marL="321" indent="-12"><a:spcBef><a:spcPts val="400"/></a:spcBef><a:spcAft><a:spcPct val="150000"/></a:spcAft><a:buChar char="•"/><a:extLst><a:ext uri="urn:rich-paragraph"><keep:paragraph value="retained"/></a:ext></a:extLst></a:pPr><a:r keep="latin"><a:rPr b="0" lang="en-US" sz="1400"><a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:hlinkClick r:id="rLink"/><a:latin typeface="Arial"/><a:extLst><a:ext uri="urn:rich-run"><keep:run value="retained"/></a:ext></a:extLst></a:rPr><a:t xml:space="preserve">Alpha </a:t></a:r><a:r keep="han"><a:rPr i="1" lang="zh-CN" custom="retained" sz="1400"><a:solidFill><a:srgbClr val="445566"/></a:solidFill></a:rPr><a:t>中😀文</a:t></a:r><a:br><a:rPr lang="ja-JP" sz="1400"/></a:br><a:r keep="tail"><a:rPr u="sng" lang="en-US" sz="1400"/><a:t>tail</a:t></a:r><a:endParaRPr lang="ko-KR" custom="end-first"/></a:p><a:p keep="second"><a:pPr algn="l" lvl="1"><a:buAutoNum type="arabicPeriod" startAt="4"/></a:pPr><a:r><a:rPr lang="fr-FR" sz="1400"/><a:t xml:space="preserve">Second </a:t></a:r><a:r><a:rPr sz="1400" lang="en-US"/><a:t>👩‍💻IME</a:t></a:r><a:endParaRPr lang="en-GB" custom="end-second"/></a:p><a:p keep="third"><a:pPr algn="l"/><a:r><a:rPr lang="ja-JP" sz="1400"/><a:t>Third</a:t></a:r><a:endParaRPr custom="end-third"/></a:p></${namespace}:txBody>`;
}

export async function writePresentationRichTextFixture(filePath) {
  const zip = await JSZip.loadAsync(
    fs.readFileSync(
      "src/components/artifact/presentation/__fixtures__/review.pptx",
    ),
  );
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Rich text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="381000" y="2000250"/><a:ext cx="4000500" cy="2476500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="F0F8F4"/></a:solidFill></p:spPr>${richBody("p")}</p:sp>`;
  const cell = (row, column) =>
    `<a:tc>${row === 0 && column === 0 ? richBody("a") : `<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1400"/><a:t>RICH_T${row}${column}</a:t></a:r><a:endParaRPr lang="ja-JP"/></a:p></a:txBody>`}<a:tcPr marL="45720" marR="45720"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:extLst><a:ext uri="urn:rich-cell:${row}:${column}"><keep:cell row="${row}" column="${column}" value="retained"/></a:ext></a:extLst></a:tcPr></a:tc>`;
  const table = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="Rich table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="4762500" y="2000250"/><a:ext cx="3810000" cy="2476500"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid><a:gridCol w="1905000"/><a:gridCol w="1905000"/></a:tblGrid>${[0, 1].map((row) => `<a:tr h="1238250">${[0, 1].map((column) => cell(row, column)).join("")}</a:tr>`).join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  // 独立探针不改变shape3/table7的exact正文；后续提交也必须原样保留本shape。
  const paragraphProbe = `<p:sp><p:nvSpPr><p:cNvPr id="${richParagraphShapeId}" name="Paragraph probe"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="381000" y="4524375"/><a:ext cx="8382000" cy="571500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody keep:body="paragraph-probe"><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:pPr lvl="0" marL="12700" marR="25400" indent="-6350"><a:lnSpc><a:spcPct val="175000"/></a:lnSpc><a:spcAft><a:spcPct val="150000"/></a:spcAft><a:buAutoNum type="arabicPeriod" startAt="4"/></a:pPr><a:r><a:rPr sz="1200"/><a:t>A</a:t></a:r></a:p><a:p><a:pPr lvl="0"><a:lnSpc><a:spcPts val="2400"/></a:lnSpc><a:spcBef><a:spcPct val="100000"/></a:spcBef><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:rPr sz="1200"/><a:t>B</a:t></a:r></a:p><a:p><a:pPr lvl="1"><a:buAutoNum type="alphaLcPeriod" startAt="3"/></a:pPr><a:r><a:rPr sz="1200"/><a:t>C</a:t></a:r></a:p><a:p><a:pPr lvl="1"><a:buAutoNum type="alphaLcPeriod"/></a:pPr><a:r><a:rPr sz="1200"/><a:t>D</a:t></a:r></a:p><a:p><a:pPr lvl="0"><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:rPr sz="1200"/><a:t>E</a:t></a:r></a:p></p:txBody></p:sp>`;
  zip.file(
    richSlidePath,
    (await zip.file(richSlidePath).async("string"))
      .replace("<p:sld ", '<p:sld xmlns:keep="urn:rich-keep" ')
      .replace("</p:spTree>", `${shape}${table}${paragraphProbe}</p:spTree>`),
  );
  zip.file(
    richRelationsPath,
    (await zip.file(richRelationsPath).async("string")).replace(
      "</Relationships>",
      `<Relationship Id="rLink" Type="${r}/hyperlink" Target="https://example.invalid/original-rich" TargetMode="External"/></Relationships>`,
    ),
  );
  zip.file(
    "customXml/rich-retained.xml",
    '<keep xmlns="urn:rich-keep" value="retained"/>',
  );
  zip.file("ppt/media/rich-retained.bin", new Uint8Array([0, 255, 128, 71]));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  fs.writeFileSync(filePath, bytes);
  fs.writeFileSync(
    path.join(path.dirname(filePath), "Broken.pptx"),
    "invalid presentation",
  );
  return {
    sha256: richDigest(bytes),
    slideSize: [960, 540],
    shapeId: "3",
    tableId: "7",
    cell: { row: 0, column: 0 },
    paragraphShapeId: richParagraphShapeId,
  };
}

function tree(node) {
  if (!node) return null;
  if (node.nodeType !== 1) return [node.nodeType, node.nodeValue];
  return [
    node.namespaceURI,
    node.localName,
    Array.from(node.attributes)
      .filter((attribute) => attribute.namespaceURI !== xmlns)
      .map((attribute) => [
        attribute.namespaceURI,
        attribute.localName,
        attribute.value,
      ])
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
    Array.from(node.childNodes, tree),
  ];
}
const signature = (node) => richDigest(JSON.stringify(tree(node)));
const attributes = (node) =>
  Object.fromEntries(
    Array.from(node?.attributes ?? [])
      .filter((attribute) => attribute.namespaceURI !== xmlns)
      .map((attribute) => [attribute.name, attribute.value]),
  );
const textRuns = (paragraph) =>
  Array.from(paragraph.children).filter(
    (node) => node.namespaceURI === a && ["r", "br"].includes(node.localName),
  );

function readBlock(body) {
  assert.ok(body, "rich target body exists");
  const paragraphs = direct(body, a, "p").map((paragraph) => {
    const properties = direct(paragraph, a, "pPr")[0];
    const runs = textRuns(paragraph).map((run) => {
      const property = direct(run, a, "rPr")[0],
        fill = direct(property, a, "solidFill")[0];
      return {
        kind: run.localName,
        text:
          run.localName === "br"
            ? "\n"
            : (direct(run, a, "t")[0]?.textContent ?? ""),
        attributes: attributes(run),
        properties: attributes(property),
        bold: ["true", "1"].includes(property?.getAttribute("b")),
        italic: ["true", "1"].includes(property?.getAttribute("i")),
        color: direct(fill, a, "srgbClr")[0]?.getAttribute("val") ?? null,
        hyperlink:
          direct(property, a, "hlinkClick")[0]?.getAttributeNS(r, "id") ?? null,
      };
    });
    return {
      text: runs.map((run) => run.text).join(""),
      signature: signature(paragraph),
      properties: signature(properties),
      end: signature(direct(paragraph, a, "endParaRPr")[0]),
      attributes: attributes(paragraph),
      bullet: direct(properties, a, "buChar")[0]?.getAttribute("char") ?? null,
      runs,
    };
  });
  return {
    text: paragraphs.map((paragraph) => paragraph.text).join("\n"),
    paragraphs,
    breaks: Array.from(body.getElementsByTagNameNS(a, "br")).length,
    signature: signature(body),
    unknown: Array.from(
      body.getElementsByTagNameNS("urn:rich-keep", "*"),
      signature,
    ),
  };
}

export async function readPresentationRichTextFile(filePath) {
  const bytes = fs.readFileSync(filePath),
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true }),
    navigation = await readPresentationNavigationFile(filePath);
  const dom = new JSDOM(await zip.file(richSlidePath).async("string"), {
      contentType: "application/xml",
    }),
    relationDom = new JSDOM(await zip.file(richRelationsPath).async("string"), {
      contentType: "application/xml",
    });
  try {
    const document = dom.window.document,
      shapeTree = document.getElementsByTagNameNS(p, "spTree")[0];
    const objects = new Map(
      Array.from(shapeTree.children)
        .filter((node) => ["sp", "graphicFrame"].includes(node.localName))
        .map((node) => [
          node.getElementsByTagNameNS(p, "cNvPr")[0].getAttribute("id"),
          node,
        ]),
    );
    const shape = direct(objects.get("3"), p, "txBody")[0],
      table = objects.get("7").getElementsByTagNameNS(a, "tbl")[0],
      cell = direct(direct(table, a, "tr")[0], a, "tc")[0],
      body = direct(cell, a, "txBody")[0];
    const blocks = { shape: readBlock(shape), cell: readBlock(body) };
    const paragraphProbe = readBlock(
      direct(objects.get(richParagraphShapeId), p, "txBody")[0],
    );
    for (const target of [shape, body])
      for (const paragraph of direct(target, a, "p")) paragraph.remove();
    const relations = Array.from(
      relationDom.window.document.getElementsByTagNameNS(rel, "Relationship"),
      (node) => ({
        id: node.getAttribute("Id"),
        type: node.getAttribute("Type"),
        target: node.getAttribute("Target"),
        mode: node.getAttribute("TargetMode"),
        signature: signature(node),
      }),
    );
    assert.equal(
      new Set(relations.map((node) => node.id)).size,
      relations.length,
      "unique same-slide relationship IDs",
    );
    return {
      sha256: richDigest(bytes),
      parts: navigation.parts,
      slideIds: navigation.slides.map((slide) => slide.id),
      slideText: navigation.slides.map((slide) => slide.text),
      order: Array.from(objects.keys()),
      outsideBodies: signature(document.documentElement),
      blocks,
      paragraphProbe,
      relations,
    };
  } finally {
    dom.window.close();
    relationDom.window.close();
  }
}

export function assertPresentationRichTextFixture(value) {
  assert.deepEqual(value.slideIds, ["512", "900", "300"]);
  assert.deepEqual(value.order, ["2", "3", "7", richParagraphShapeId]);
  assert.equal(value.paragraphProbe.text, richParagraphOriginalText);
  assert.equal(value.paragraphProbe.paragraphs.length, 5);
  for (const [index, text] of value.slideText.entries())
    assert.ok(
      text.includes(`SLIDE_PREVIEW_0${index + 1}`),
      "existing preview markers retained",
    );
  for (const block of Object.values(value.blocks)) {
    assert.equal(block.text, richOriginalText);
    assert.equal(block.paragraphs.length, 3);
    assert.equal(block.breaks, 1);
    assert.equal(block.paragraphs[0].bullet, "•");
    assert.equal(block.unknown.length, 2);
  }
  assert.equal(
    value.relations.find((node) => node.id === "rLink")?.target,
    "https://example.invalid/original-rich",
  );
  assert.ok(value.parts["customXml/rich-retained.xml"]);
  assert.ok(value.parts["ppt/media/rich-retained.bin"]);
}

const characters = (runs) =>
  runs
    .filter((run) => run.kind === "r")
    .flatMap((run) =>
      Array.from(run.text, (character) => ({
        character,
        bold: run.bold,
        italic: run.italic,
        color: run.color,
        hyperlink: run.hyperlink,
      })),
    );
const characterStyle = (text, style) =>
  Array.from(text, (character) => ({ character, ...style }));

/** 完全手写的正文/样式/段落与ZIP白名单；不能靠生产writer的输出生成期望。 */
export function assertPresentationRichTextSave(before, after, expected) {
  assert.ok(["original", "edited"].includes(expected.shape));
  assert.ok(["original", "pasted"].includes(expected.cell));
  assert.deepEqual(after.slideIds, before.slideIds);
  assert.deepEqual(after.order, before.order);
  assert.equal(
    after.paragraphProbe.signature,
    before.paragraphProbe.signature,
    "cancelled paragraph probe remains byte-semantic original XML across all unrelated text saves",
  );
  assert.equal(
    after.outsideBodies,
    before.outsideBodies,
    "all non-text geometry/cells/bodyPr/lstStyle/attributes stay intact",
  );
  assert.deepEqual(
    Object.keys(after.parts).sort(),
    Object.keys(before.parts).sort(),
  );
  let preservedParts = 0;
  for (const [part, hash] of Object.entries(before.parts)) {
    if (
      part === richSlidePath ||
      (part === richRelationsPath && expected.cell === "pasted")
    )
      continue;
    assert.equal(
      after.parts[part],
      hash,
      `non-target ZIP payload retained: ${part}`,
    );
    preservedParts++;
  }
  for (const old of before.relations)
    assert.deepEqual(
      after.relations.find((node) => node.id === old.id),
      old,
      `original relationship retained: ${old.id}`,
    );
  const shape = after.blocks.shape,
    cell = after.blocks.cell;
  assert.equal(
    shape.text,
    expected.shape === "edited" ? richEditedText : richOriginalText,
  );
  assert.equal(
    cell.text,
    expected.cell === "pasted" ? richPastedText : richOriginalText,
  );
  for (const key of ["shape", "cell"]) {
    const block = after.blocks[key],
      original = before.blocks[key];
    assert.deepEqual(
      block.unknown,
      original.unknown,
      `${key}: unknown XML retained`,
    );
    for (let index = 0; index < 3; index++) {
      assert.equal(
        block.paragraphs[index].properties,
        original.paragraphs[index].properties,
        `${key}:${index}: pPr/list/spacing retained`,
      );
      assert.equal(
        block.paragraphs[index].end,
        original.paragraphs[index].end,
        `${key}:${index}: endParaRPr retained`,
      );
      assert.deepEqual(
        block.paragraphs[index].attributes,
        original.paragraphs[index].attributes,
      );
    }
  }
  if (expected.shape === "original")
    assert.equal(
      shape.signature,
      before.blocks.shape.signature,
      "undo restores entire original shape body",
    );
  else {
    assert.equal(shape.paragraphs.length, 4);
    assert.equal(
      shape.breaks,
      2,
      "Shift+Enter is a real a:br, Enter is a new a:p",
    );
    assert.deepEqual(
      characters(shape.paragraphs[0].runs),
      [
        ...characterStyle("Lime ", {
          bold: false,
          italic: false,
          color: "112233",
          hyperlink: "rLink",
        }),
        ...characterStyle("中文", {
          bold: true,
          italic: true,
          color: "9B2C2C",
          hyperlink: null,
        }),
        ...characterStyle("tail", {
          bold: false,
          italic: false,
          color: null,
          hyperlink: null,
        }),
      ],
      "only selected Han text gains bold/color; adjacent Latin/softbreak tail retain style",
    );
    for (const index of [1, 2])
      assert.equal(
        shape.paragraphs[index].signature,
        before.blocks.shape.paragraphs[index].signature,
      );
    assert.equal(
      shape.paragraphs[0].runs.find((run) => run.text.includes("中"))
        ?.properties.custom,
      "retained",
    );
  }
  if (expected.cell === "original") {
    assert.equal(cell.signature, before.blocks.cell.signature);
    assert.deepEqual(
      after.relations,
      before.relations,
      "unrelated text commits do not touch relationship XML",
    );
  } else {
    assert.equal(cell.paragraphs.length, 6);
    assert.equal(cell.breaks, 1);
    for (let index = 0; index < 3; index++)
      assert.equal(
        cell.paragraphs[index].signature,
        before.blocks.cell.paragraphs[index].signature,
      );
    const pasted = cell.paragraphs.slice(3),
      bold = pasted[0].runs.find((run) => run.text === "HTML_BOLD"),
      italic = pasted[0].runs.find((run) => run.text === "HTML_ITALIC");
    assert.equal(bold?.bold, true, "HTML strong is persisted run bold");
    assert.equal(italic?.italic, true, "HTML em is persisted run italic");
    assert.equal(
      pasted[1].bullet,
      "•",
      "HTML ul/li becomes a DrawingML bullet",
    );
    const added = after.relations.filter(
      (node) => !before.relations.some((old) => old.id === node.id),
    );
    assert.equal(
      added.length,
      1,
      "one new hyperlink relationship is atomically added",
    );
    assert.equal(added[0].type, `${r}/hyperlink`);
    assert.equal(added[0].mode, "External");
    assert.equal(added[0].target, richPasteUrl);
    assert.equal(
      pasted[2].runs.find((run) => run.text === "HTML_LINK")?.hyperlink,
      added[0].id,
    );
  }
  return {
    preservedParts,
    shapeParagraphs: shape.paragraphs.length,
    shapeBreaks: shape.breaks,
    cellParagraphs: cell.paragraphs.length,
    cellBreaks: cell.breaks,
  };
}

export function assertPresentationRichTextCommit(before, after, label) {
  const delta = {
    read: after.read - before.read,
    write: after.write - before.write,
  };
  assert.deepEqual(
    delta,
    { read: 2, write: 1 },
    `${label}: one commit has exactly two source checks and one write`,
  );
  return delta;
}

/** Chromium实际CSS/Selection合同；JSDOM不支持lh，不能将其当作布局证据。 */
export function assertPresentationRichParagraphDom(state) {
  assert.equal(state.active, true);
  assert.equal(state.focused, true);
  assert.equal(state.text, richParagraphOriginalText);
  assert.equal(
    state.editorTextContent,
    "ABCDE",
    "CSS markers never become text nodes",
  );
  assert.equal(state.editorChildCount, 5);
  assert.equal(
    state.markerMarkupCount,
    0,
    "numbering uses CSS marker without injected list/prefix DOM",
  );
  assert.equal(
    state.selectedPlainText,
    richParagraphOriginalText,
    "native selection excludes generated list numbers",
  );
  assert.equal(state.anchor?.offset, 0);
  assert.equal(state.caret?.offset, 9);
  const paragraphs = state.paragraphs;
  assert.equal(paragraphs.length, 5);
  for (const [index, paragraph] of paragraphs.entries()) {
    const expectedType = [
      "decimal",
      "decimal",
      "lower-alpha",
      "lower-alpha",
      "decimal",
    ][index];
    const expectedCounter = `list-item ${[4, 5, 3, 4, 6][index]}`;
    assert.equal(
      paragraph.runs.map((run) => run.text).join(""),
      "ABCDE"[index],
    );
    for (const style of [paragraph.inlineStyle, paragraph.computedStyle]) {
      assert.equal(style.display, "list-item");
      assert.equal(style.listStyleType, expectedType);
      assert.equal(style.listStylePosition, "inside");
      assert.equal(
        style.counterSet,
        expectedCounter,
        `paragraph ${index}: list continuation/nested return`,
      );
    }
    assert.equal(paragraph.computedStyle.fontSize, "16px");
  }
  assert.equal(paragraphs[0].inlineStyle.lineHeight, "1.75");
  assert.equal(paragraphs[0].computedStyle.lineHeight, "28px");
  assert.equal(paragraphs[0].inlineStyle.marginBottom, "1.5lh");
  assert.equal(paragraphs[0].computedStyle.marginBottom, "42px");
  assert.equal(paragraphs[1].inlineStyle.lineHeight, "24pt");
  assert.equal(paragraphs[1].computedStyle.lineHeight, "32px");
  assert.equal(paragraphs[1].inlineStyle.marginTop, "1lh");
  assert.equal(paragraphs[1].computedStyle.marginTop, "32px");
  return {
    shapeId: richParagraphShapeId,
    inlineLineHeights: ["1.75", "24pt"],
    computedLineHeights: ["28px", "32px"],
    relativeMargin: { inline: "1.5lh", computed: "42px" },
    counters: [4, 5, 3, 4, 6],
    nativeTextOffsets: [0, 9],
    generatedMarkerText: false,
  };
}
