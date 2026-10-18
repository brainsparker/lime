import {
  a,
  p,
  r,
  relationships,
  children,
  one,
  relationPartPath,
} from "./presentationPackageXml";
import { advancedFixture } from "./presentationTableAdvancedPackage.testFixtures";
import {
  readStructure,
  serialize,
} from "./presentationTableStructurePackage.testFixtures";
import { tableSlidePath } from "./presentationTablePackage.testFixtures";
import {
  lineNames,
  tableStyleContext,
  type Side,
} from "./presentationTableStyle";
import { tableGrid } from "./presentationTableGrid";
import { tableBorderStyle } from "./presentationTableBorderStyle";
import type { Structure } from "./presentationTableStructurePackage.testFixtures";

export const formatStyleId = "{A1200000-0000-4000-8000-000000000001}";
export const formatStylePath = "ppt/tableStyles.xml";
export const formatThemePath = "ppt/theme/table-format.xml";
const layoutPath = "ppt/slideLayouts/table-format.xml",
  masterPath = "ppt/slideMasters/table-format.xml";
const root = (body: string) =>
  `<Relationships xmlns="${relationships}">${body}</Relationships>`;
const relation = (id: string, type: string, target: string) =>
  `<Relationship Id="${id}" Type="${r}/${type}" Target="${target}"/>`;
const tree =
  '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>';

/** 独立真实 OPC：custom style 与 theme 均通过关系解析，不修改旧 fixture 的孤立 builtin style。 */
export async function formatFixture(
  options: { styled?: boolean; merged?: boolean } = {},
): Promise<Uint8Array> {
  const value = await readStructure(
    await advancedFixture({ merged: options.merged }),
  );
  const properties = one(value.table, a, "tblPr")!;
  one(properties, a, "tableStyleId")!.remove();
  for (const [name, flag] of Object.entries({
    firstRow: "0",
    firstCol: "0",
    lastRow: "0",
    lastCol: "0",
    bandRow: "0",
    bandCol: "0",
  }))
    properties.setAttribute(name, flag);
  properties.setAttributeNS("urn:keep", "keep:options", "retained");
  for (const cell of value.cells.flat()) {
    const properties = one(cell, a, "tcPr")!;
    for (const name of Object.values(lineNames))
      one(properties, a, name)?.remove();
  }
  if (options.styled !== false) {
    const id = value.xml.createElementNS(a, "a:tableStyleId");
    id.textContent = formatStyleId;
    properties.prepend(id);
    const border = (side: string) =>
      `<a:${side}><a:ln w="19050"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:${side}>`;
    value.zip.file(
      formatStylePath,
      `<a:tblStyleLst xmlns:a="${a}" def="${formatStyleId}"><a:tblStyle styleId="${formatStyleId}" styleName="Fixture custom"><a:wholeTbl><a:tcStyle><a:tcBdr>${["top", "bottom", "left", "right", "insideH", "insideV"].map(border).join("")}</a:tcBdr></a:tcStyle></a:wholeTbl><a:firstRow><a:tcStyle><a:tcBdr><a:bottom><a:ln w="38100"><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill><a:prstDash val="dash"/></a:ln></a:bottom></a:tcBdr></a:tcStyle></a:firstRow></a:tblStyle></a:tblStyleLst>`,
    );
    const themeColors: Record<string, string> = {
      dk1: "000000",
      lt1: "FFFFFF",
      dk2: "111111",
      lt2: "EEEEEE",
      accent1: "336699",
      accent2: "FF9900",
      accent3: "AA3399",
      accent4: "009966",
      accent5: "996633",
      accent6: "663399",
      hlink: "0000FF",
      folHlink: "800080",
    };
    value.zip.file(
      formatThemePath,
      `<a:theme xmlns:a="${a}" name="Fixture"><a:themeElements><a:clrScheme name="Fixture">${Object.entries(
        themeColors,
      )
        .map(
          ([key, color]) => `<a:${key}><a:srgbClr val="${color}"/></a:${key}>`,
        )
        .join(
          "",
        )}</a:clrScheme><a:fontScheme name="Fixture"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Fixture"><a:fillStyleLst/><a:lnStyleLst><a:ln w="28575"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="dot"/></a:ln></a:lnStyleLst><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`,
    );
    const relPath = "ppt/_rels/presentation.xml.rels",
      relXml = new DOMParser().parseFromString(
        await value.zip.file(relPath)!.async("string"),
        "application/xml",
      );
    for (const [id, type, target] of [
      ["rFormatStyles", "tableStyles", "tableStyles.xml"],
      ["rFormatTheme", "theme", "theme/table-format.xml"],
    ]) {
      for (const entry of children(
        relXml.documentElement,
        relationships,
        "Relationship",
      ))
        if (entry.getAttribute("Type") === `${r}/${type}`) entry.remove();
      const entry = relXml.createElementNS(relationships, "Relationship");
      entry.setAttribute("Id", id);
      entry.setAttribute("Type", `${r}/${type}`);
      entry.setAttribute("Target", target);
      relXml.documentElement.append(entry);
    }
    value.zip.file(relPath, serialize(relXml));
    const slideRelPath = relationPartPath(tableSlidePath),
      existing = value.zip.file(slideRelPath);
    const slideRels = new DOMParser().parseFromString(
      existing ? await existing.async("string") : root(""),
      "application/xml",
    );
    for (const entry of children(
      slideRels.documentElement,
      relationships,
      "Relationship",
    ))
      if (entry.getAttribute("Type") === `${r}/slideLayout`) entry.remove();
    const layoutRef = new DOMParser().parseFromString(
      root(
        relation(
          "rFormatLayout",
          "slideLayout",
          "../slideLayouts/table-format.xml",
        ),
      ),
      "application/xml",
    ).documentElement.firstElementChild!;
    slideRels.documentElement.append(slideRels.importNode(layoutRef, true));
    value.zip.file(slideRelPath, serialize(slideRels));
    value.zip.file(
      layoutPath,
      `<p:sldLayout xmlns:p="${p}" xmlns:a="${a}"><p:cSld>${tree}</p:cSld></p:sldLayout>`,
    );
    value.zip.file(
      relationPartPath(layoutPath),
      root(
        relation(
          "rFormatMaster",
          "slideMaster",
          "../slideMasters/table-format.xml",
        ),
      ),
    );
    value.zip.file(
      masterPath,
      `<p:sldMaster xmlns:p="${p}" xmlns:a="${a}"><p:cSld>${tree}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:sldMaster>`,
    );
    value.zip.file(
      relationPartPath(masterPath),
      root(relation("rFormatTheme", "theme", "../theme/table-format.xml")),
    );
    const contentPath = "[Content_Types].xml",
      content = new DOMParser().parseFromString(
        await value.zip.file(contentPath)!.async("string"),
        "application/xml",
      );
    for (const [path, type] of [
      [formatStylePath, "tableStyles"],
      [formatThemePath, "theme"],
      [layoutPath, "slideLayout"],
      [masterPath, "slideMaster"],
    ]) {
      const entry = content.createElementNS(
        content.documentElement.namespaceURI,
        "Override",
      );
      entry.setAttribute("PartName", `/${path}`);
      entry.setAttribute(
        "ContentType",
        `application/vnd.openxmlformats-officedocument.${type === "theme" ? "theme" : `presentationml.${type}`}+xml`,
      );
      content.documentElement.append(entry);
    }
    value.zip.file(contentPath, serialize(content));
  }
  value.zip.file(tableSlidePath, serialize(value.xml));
  return value.zip.generateAsync({ type: "uint8array" });
}

export function writeFormatLine(
  value: Structure,
  row: number,
  column: number,
  side: Side,
  body = '<a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:prstDash val="solid"/>',
  attrs = 'w="19050"',
) {
  const properties = one(value.cells[row][column], a, "tcPr")!;
  one(properties, a, lineNames[side])?.remove();
  const node = new DOMParser().parseFromString(
    `<a:${lineNames[side]} xmlns:a="${a}" xmlns:keep="urn:keep" ${attrs}>${body}</a:${lineNames[side]}>`,
    "application/xml",
  ).documentElement;
  properties.prepend(value.xml.importNode(node, true));
}
export function formatBorder(
  value: Structure,
  row: number,
  column: number,
  side: Side,
) {
  return one(one(value.cells[row][column], a, "tcPr")!, a, lineNames[side]);
}
export async function readFormatStyle(
  bytes: Uint8Array,
  selected = { row: 1, column: 1, rowCount: 2, columnCount: 3 },
) {
  const value = await readStructure(bytes);
  return tableBorderStyle(
    tableGrid(value.xml, "7"),
    selected,
    await tableStyleContext(value.zip, tableSlidePath, value.xml),
  );
}
