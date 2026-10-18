import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import JSZip from "jszip";
import { expect } from "vitest";

export const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
export const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
export const r =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const rel =
  "http://schemas.openxmlformats.org/package/2006/relationships";
export const ct =
  "http://schemas.openxmlformats.org/package/2006/content-types";
export const ep =
  "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties";
export const presentationPath = "ppt/presentation.xml";
export const presentationRels = "ppt/_rels/presentation.xml.rels";
export const sourcePath = "ppt/slides/slide1.xml";
export const titleLayout = "ppt/slideLayouts/slideLayout1.xml";
export const blankLayout = "ppt/slideLayouts/slideLayout2.xml";
export const chart = "ppt/charts/chart1.xml";
export const note = "ppt/notesSlides/notesSlide1.xml";
export const image = "ppt/media/image1.png";
const overrides = {
  [titleLayout]:
    "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  [blankLayout]:
    "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  "ppt/slideMasters/slideMaster1.xml":
    "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
};
const chartOverrides = {
  [chart]: "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
  [note]:
    "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml",
  "ppt/notesMasters/notesMaster1.xml":
    "application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml",
  "ppt/charts/style1.xml": "application/vnd.ms-office.chartstyle+xml",
  "ppt/charts/colors1.xml": "application/vnd.ms-office.chartcolorstyle+xml",
  "ppt/drawings/drawing1.xml":
    "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml",
  "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const xml = (source: string) =>
  new DOMParser().parseFromString(source, "application/xml");
const serialize = (document: Document) =>
  new XMLSerializer().serializeToString(document);
export const original = () =>
  new Uint8Array(
    readFileSync(
      "src/components/artifact/presentation/__fixtures__/review.pptx",
    ),
  );
export const rels = (entries: readonly [string, string, string, boolean?][]) =>
  `<Relationships xmlns="${rel}">${entries.map(([id, type, target, external]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"${external ? ' TargetMode="External"' : ""}/>`).join("")}</Relationships>`;
const shape = (id: number, type: string, text: string, extra = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${type}"${extra}/><p:cNvSpPr/><p:nvPr><p:ph type="${type}" idx="${id}"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="12" y="34"/><a:ext cx="123" cy="456"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="2400" b="1"><a:hlinkClick r:id="templateLink"/></a:rPr><a:t>${text}</a:t></a:r><a:fld id="field" type="slidenum"><a:t>7</a:t></a:fld></a:p><a:p><a:r><a:t>discard</a:t></a:r></a:p></p:txBody></p:sp>`;
const tree = (shapes = "") =>
  `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree>`;

export async function setXml(
  zip: JSZip,
  path: string,
  edit: (document: Document) => void,
) {
  const document = xml(await zip.file(path)!.async("string"));
  edit(document);
  zip.file(path, serialize(document));
}

export function addOverrides(zip: JSZip, entries: Record<string, string>) {
  return setXml(zip, "[Content_Types].xml", (document) => {
    for (const [path, type] of Object.entries(entries)) {
      const node = document.createElementNS(ct, "Override");
      node.setAttribute("PartName", `/${path}`);
      node.setAttribute("ContentType", type);
      document.documentElement.append(node);
    }
  });
}

export async function fixture(
  options: {
    privateParts?: boolean;
    sharedChart?: boolean;
    noBlank?: boolean;
  } = {},
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(original());
  await setXml(zip, presentationPath, (document) => {
    const masters = document.createElementNS(p, "p:sldMasterIdLst"),
      master = document.createElementNS(p, "p:sldMasterId");
    master.setAttribute("id", "2147483648");
    master.setAttributeNS(r, "r:id", "master");
    masters.append(master);
    document.documentElement.insertBefore(
      masters,
      document.documentElement.firstChild,
    );
  });
  await setXml(zip, presentationRels, (document) => {
    const node = document.createElementNS(rel, "Relationship");
    node.setAttribute("Id", "master");
    node.setAttribute("Type", `${r}/slideMaster`);
    node.setAttribute("Target", "slideMasters/slideMaster1.xml");
    document.documentElement.append(node);
  });
  zip.file(
    "ppt/slideMasters/slideMaster1.xml",
    `<p:sldMaster xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld name="Office master">${tree()}</p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="title"/><p:sldLayoutId id="2147483650" r:id="blank"/></p:sldLayoutIdLst></p:sldMaster>`,
  );
  zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    rels([
      ["title", `${r}/slideLayout`, "../slideLayouts/slideLayout1.xml"],
      ["blank", `${r}/slideLayout`, "../slideLayouts/slideLayout2.xml"],
    ]),
  );
  const placeholder = shape(2, "title", "Template text").replace(
    "</p:spPr>",
    '<a:blipFill><a:blip r:embed="templateImage"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></p:spPr>',
  );
  zip.file(
    titleLayout,
    `<p:sldLayout xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}" type="title"><p:cSld name="Title layout">${tree(placeholder + shape(3, "ftr", "Footer") + shape(4, "body", "Hidden", ' hidden="1"'))}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  );
  zip.file(
    blankLayout,
    `<p:sldLayout xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}" type="${options.noBlank ? "obj" : "blank"}"><p:cSld name="Blank layout">${tree()}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  );
  zip.file(
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    rels([
      ["master", `${r}/slideMaster`, "../slideMasters/slideMaster1.xml"],
      ["templateImage", `${r}/image`, "../media/image1.png"],
      [
        "templateLink",
        `${r}/hyperlink`,
        "https://example.invalid/not-fetched",
        true,
      ],
    ]),
  );
  zip.file(
    "ppt/slideLayouts/_rels/slideLayout2.xml.rels",
    rels([["master", `${r}/slideMaster`, "../slideMasters/slideMaster1.xml"]]),
  );
  zip.file(
    image,
    new Uint8Array(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWz8AAAAASUVORK5CYII=",
        "base64",
      ),
    ),
  );
  await addOverrides(zip, { ...overrides, [image]: "image/png" });
  for (let index = 1; index <= 3; index++) {
    const path = `ppt/slides/_rels/slide${index}.xml.rels`;
    await setXml(zip, path, (document) => {
      const relation = document.createElementNS(rel, "Relationship");
      relation.setAttribute("Id", "layout");
      relation.setAttribute("Type", `${r}/slideLayout`);
      relation.setAttribute(
        "Target",
        `../slideLayouts/slideLayout${index === 1 ? 1 : 2}.xml`,
      );
      document.documentElement.append(relation);
    });
  }
  if (options.privateParts) {
    await addOverrides(zip, chartOverrides);
    zip.file(
      note,
      `<p:notes xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld>${tree(shape(2, "body", "Private speaker note").replace(/<a:hlinkClick r:id="templateLink"\/>/g, ""))}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`,
    );
    zip.file(
      "ppt/notesSlides/_rels/notesSlide1.xml.rels",
      rels([
        ["slide", `${r}/slide`, "../slides/slide1.xml"],
        ["master", `${r}/notesMaster`, "../notesMasters/notesMaster1.xml"],
        ["image", `${r}/image`, "../media/image1.png"],
      ]),
    );
    zip.file(
      "ppt/notesMasters/notesMaster1.xml",
      `<p:notesMaster xmlns:p="${p}"><p:cSld>${tree()}</p:cSld></p:notesMaster>`,
    );
    zip.file(
      chart,
      `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${r}"><c:chart><c:plotArea><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="1"/><c:pt idx="0"><c:v>7</c:v></c:pt></c:numLit></c:val></c:ser></c:barChart></c:plotArea></c:chart><c:externalData r:id="workbook"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`,
    );
    zip.file(
      "ppt/charts/style1.xml",
      '<cs:chartStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle" id="201"/>',
    );
    zip.file(
      "ppt/charts/colors1.xml",
      '<cs:colorStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle" meth="cycle" id="10"/>',
    );
    zip.file(
      "ppt/drawings/drawing1.xml",
      `<cdr:userShapes xmlns:cdr="http://schemas.openxmlformats.org/drawingml/2006/chartDrawing" xmlns:a="${a}" xmlns:r="${r}"><cdr:relSizeAnchor><cdr:from><cdr:x>0</cdr:x><cdr:y>0</cdr:y></cdr:from><cdr:to><cdr:x>1</cdr:x><cdr:y>1</cdr:y></cdr:to><cdr:pic><cdr:nvPicPr><cdr:cNvPr id="1" name="chart image"/><cdr:cNvPicPr/></cdr:nvPicPr><cdr:blipFill><a:blip r:embed="image"/></cdr:blipFill><cdr:spPr/></cdr:pic></cdr:relSizeAnchor></cdr:userShapes>`,
    );
    zip.file(
      "ppt/drawings/_rels/drawing1.xml.rels",
      rels([["image", `${r}/image`, "../media/image1.png"]]),
    );
    const workbook = new JSZip();
    workbook.file(
      "[Content_Types].xml",
      `<Types xmlns="${ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    );
    workbook.file(
      "_rels/.rels",
      rels([["office", `${r}/officeDocument`, "xl/workbook.xml"]]),
    );
    workbook.file(
      "xl/workbook.xml",
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${r}"><sheets><sheet name="Data" sheetId="1" r:id="data"/></sheets></workbook>`,
    );
    workbook.file(
      "xl/_rels/workbook.xml.rels",
      rels([["data", `${r}/worksheet`, "worksheets/sheet1.xml"]]),
    );
    workbook.file(
      "xl/worksheets/sheet1.xml",
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>7</v></c></row></sheetData></worksheet>',
    );
    zip.file(
      "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx",
      await workbook.generateAsync({ type: "uint8array" }),
    );
    zip.file(
      "ppt/charts/_rels/chart1.xml.rels",
      rels([
        [
          "workbook",
          `${r}/package`,
          "../embeddings/Microsoft_Excel_Worksheet1.xlsx",
        ],
        [
          "style",
          "http://schemas.microsoft.com/office/2011/relationships/chartStyle",
          "style1.xml",
        ],
        [
          "colors",
          "http://schemas.microsoft.com/office/2011/relationships/chartColorStyle",
          "colors1.xml",
        ],
        ["drawing", `${r}/chartUserShapes`, "../drawings/drawing1.xml"],
      ]),
    );
    for (const index of options.sharedChart ? [1, 2] : [1]) {
      await setXml(
        zip,
        `ppt/slides/_rels/slide${index}.xml.rels`,
        (document) => {
          for (const [id, type, target] of [
            ["chart", `${r}/chart`, "../charts/chart1.xml"],
            ...(index === 1
              ? [["notes", `${r}/notesSlide`, "../notesSlides/notesSlide1.xml"]]
              : []),
          ]) {
            const node = document.createElementNS(rel, "Relationship");
            node.setAttribute("Id", id);
            node.setAttribute("Type", type);
            node.setAttribute("Target", target);
            document.documentElement.append(node);
          }
        },
      );
      const path = `ppt/slides/slide${index}.xml`;
      zip.file(
        path,
        (await zip.file(path)!.async("string")).replace(
          "</p:spTree>",
          `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="9" name="Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="chart"/></a:graphicData></a:graphic></p:graphicFrame></p:spTree>`,
        ),
      );
    }
  }
  zip.file(
    "customXml/retained.xml",
    '<keep xmlns="urn:unknown">unchanged</keep>',
  );
  return zip.generateAsync({ type: "uint8array" });
}

export function relPath(path: string) {
  return posix.join(
    posix.dirname(path),
    "_rels",
    `${posix.basename(path)}.rels`,
  );
}

export async function relationships(zip: JSZip, path: string) {
  const entry = zip.file(relPath(path));
  return entry
    ? Array.from(
        xml(await entry.async("string")).getElementsByTagNameNS(
          rel,
          "Relationship",
        ),
      )
    : [];
}

export async function target(
  zip: JSZip,
  source: string,
  type: string,
): Promise<string> {
  const relation = (await relationships(zip, source)).find(
    (node) => node.getAttribute("Type") === type,
  )!;
  const raw = relation.getAttribute("Target")!;
  return posix.normalize(
    raw.startsWith("/") ? raw.slice(1) : posix.join(posix.dirname(source), raw),
  );
}

export async function slidePath(zip: JSZip, id: string): Promise<string> {
  const document = xml(await zip.file(presentationPath)!.async("string"));
  const entry = Array.from(document.getElementsByTagNameNS(p, "sldId")).find(
    (node) => node.getAttribute("id") === id,
  )!;
  const relation = (await relationships(zip, presentationPath)).find(
    (node) => node.getAttribute("Id") === entry.getAttributeNS(r, "id"),
  )!;
  return posix.normalize(posix.join("ppt", relation.getAttribute("Target")!));
}

export async function assertAllTargetsExist(zip: JSZip) {
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.endsWith(".rels")) continue;
    const sourceDirectory =
      path === "_rels/.rels" ? "" : posix.dirname(posix.dirname(path));
    for (const relation of Array.from(
      xml(await entry.async("string")).getElementsByTagNameNS(
        rel,
        "Relationship",
      ),
    )) {
      if (relation.getAttribute("TargetMode") === "External") continue;
      const raw = relation.getAttribute("Target")!,
        destination = posix.normalize(
          raw.startsWith("/") ? raw.slice(1) : posix.join(sourceDirectory, raw),
        );
      expect(zip.file(destination), `${path} -> ${raw}`).not.toBeNull();
    }
  }
  const types = xml(await zip.file("[Content_Types].xml")!.async("string"));
  for (const node of Array.from(types.getElementsByTagNameNS(ct, "Override")))
    expect(zip.file(node.getAttribute("PartName")!.slice(1))).not.toBeNull();
}
