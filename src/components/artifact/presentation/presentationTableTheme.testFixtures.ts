import JSZip from "jszip";
import {
  a,
  p,
  r,
  relationships,
  one,
  relationPartPath,
} from "./presentationPackageXml";
import {
  formatFixture,
  formatStylePath,
  formatThemePath,
} from "./presentationTableFormatPackage.testFixtures";
import { tableSlidePath } from "./presentationTablePackage.testFixtures";

export const themeSourcePaths = {
  master: "ppt/slideMasters/table-format.xml",
  layout: "ppt/slideLayouts/table-format.xml",
  slide: tableSlidePath,
};
export function themeComponents(options: {
  color?: string;
  font?: string;
  width?: number;
  dash?: string;
}): string {
  let result = "";
  if (options.color !== undefined) {
    const values: Record<string, string> = {
      dk1: "000000",
      lt1: "FFFFFF",
      dk2: "111111",
      lt2: "EEEEEE",
      accent1: options.color,
      accent2: "CC0099",
      accent3: "0099CC",
      accent4: "00CC99",
      accent5: "99CC00",
      accent6: "9900CC",
      hlink: "0000FF",
      folHlink: "800080",
    };
    result += `<a:clrScheme name="Override">${Object.entries(values)
      .map(
        ([name, value]) => `<a:${name}><a:srgbClr val="${value}"/></a:${name}>`,
      )
      .join("")}</a:clrScheme>`;
  }
  if (options.font !== undefined)
    result += `<a:fontScheme name="Override"><a:majorFont><a:latin typeface="${options.font}"/><a:ea typeface="Override EA"/><a:cs typeface="Override CS"/><a:font script="Jpan" typeface="Override JP"/></a:majorFont><a:minorFont><a:latin typeface="Courier New"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`;
  if (options.width !== undefined) {
    const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    const line = `<a:ln w="${Math.round(options.width * 9525)}">${fill}<a:prstDash val="${options.dash ?? "dot"}"/></a:ln>`;
    result += `<a:fmtScheme name="Override"><a:fillStyleLst>${fill.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${line.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${"<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fill.repeat(3)}</a:bgFillStyleLst></a:fmtScheme>`;
  }
  return result;
}

/** 各覆盖都以真实 OPC relationship 定位；根 themeOverride 的组件符合标准结构。 */
export async function addThemeOverride(
  bytes: Uint8Array,
  level: keyof typeof themeSourcePaths,
  components: string,
  options: {
    targetName?: string;
    sourcePath?: string;
    external?: boolean;
    duplicate?: boolean;
  } = {},
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes),
    source = options.sourcePath ?? themeSourcePaths[level],
    targetName = options.targetName ?? `themeOverride-${level}.xml`;
  const relPath = relationPartPath(source),
    relSource = zip.file(relPath)
      ? await zip.file(relPath)!.async("string")
      : `<Relationships xmlns="${relationships}"/>`;
  const xml = new DOMParser().parseFromString(relSource, "application/xml");
  const append = (id: string) => {
    const entry = xml.createElementNS(relationships, "Relationship");
    entry.setAttribute("Id", id);
    entry.setAttribute("Type", `${r}/themeOverride`);
    entry.setAttribute(
      "Target",
      options.external
        ? "https://invalid.example/theme.xml"
        : `../theme/${targetName}`,
    );
    if (options.external) entry.setAttribute("TargetMode", "External");
    xml.documentElement.append(entry);
  };
  append(`rOverride-${level}`);
  if (options.duplicate) append(`rOverride-${level}-2`);
  zip.file(relPath, new XMLSerializer().serializeToString(xml));
  zip.file(
    `ppt/theme/${targetName}`,
    `<a:themeOverride xmlns:a="${a}">${components}</a:themeOverride>`,
  );
  const types = new DOMParser().parseFromString(
      await zip.file("[Content_Types].xml")!.async("string"),
      "application/xml",
    ),
    entry = types.createElementNS(
      types.documentElement.namespaceURI,
      "Override",
    );
  entry.setAttribute("PartName", `/ppt/theme/${targetName}`);
  entry.setAttribute(
    "ContentType",
    "application/vnd.openxmlformats-officedocument.themeOverride+xml",
  );
  types.documentElement.append(entry);
  zip.file("[Content_Types].xml", new XMLSerializer().serializeToString(types));
  return zip.generateAsync({ type: "uint8array" });
}

export async function themeFixture(): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await formatFixture());
  zip.file(
    formatStylePath,
    (await zip.file(formatStylePath)!.async("string")).replace(
      /<a:ln w="19050">[\s\S]*?<\/a:ln>/g,
      '<a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef>',
    ),
  );
  zip.file(
    tableSlidePath,
    (await zip.file(tableSlidePath)!.async("string")).replace(
      /typeface="Arial"/g,
      'typeface="+mj-lt"',
    ),
  );
  return zip.generateAsync({ type: "uint8array" });
}

export async function addSharedThemeSlide(
  bytes: Uint8Array,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes),
    slide = "ppt/slides/second.xml";
  zip.file(slide, await zip.file(tableSlidePath)!.async("string"));
  const firstRels = await zip
    .file(relationPartPath(tableSlidePath))!
    .async("string");
  const rels = new DOMParser().parseFromString(firstRels, "application/xml");
  for (const entry of Array.from(rels.documentElement.children))
    if (entry.getAttribute("Type") === `${r}/themeOverride`) entry.remove();
  zip.file(
    relationPartPath(slide),
    new XMLSerializer().serializeToString(rels),
  );
  const presentation = new DOMParser().parseFromString(
      await zip.file("ppt/presentation.xml")!.async("string"),
      "application/xml",
    ),
    id = presentation.createElementNS(p, "p:sldId");
  id.setAttribute("id", "513");
  id.setAttributeNS(r, "r:id", "rSecond");
  one(presentation.documentElement, p, "sldIdLst")!.append(id);
  zip.file(
    "ppt/presentation.xml",
    new XMLSerializer().serializeToString(presentation),
  );
  const presentationRels = new DOMParser().parseFromString(
      await zip.file("ppt/_rels/presentation.xml.rels")!.async("string"),
      "application/xml",
    ),
    entry = presentationRels.createElementNS(relationships, "Relationship");
  entry.setAttribute("Id", "rSecond");
  entry.setAttribute("Type", `${r}/slide`);
  entry.setAttribute("Target", "slides/second.xml");
  presentationRels.documentElement.append(entry);
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    new XMLSerializer().serializeToString(presentationRels),
  );
  return zip.generateAsync({ type: "uint8array" });
}

export { formatThemePath };
