import JSZip from "jszip";
import {
  a,
  one,
  r,
  relationships,
  relationPartPath,
} from "./presentationPackageXml";
import {
  formatFixture,
  formatStyleId,
  formatStylePath,
} from "./presentationTableFormatPackage.testFixtures";
import { tableSlidePath } from "./presentationTablePackage.testFixtures";
import { presentationTableBuiltinStyle } from "./presentationTableBuiltinStyle";

export const builtinStyleId = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}";
export const unknownStyleId = "{FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF}";
export const tableStyleList = (body: string) =>
  `<a:tblStyleLst xmlns:a="${a}">${body}</a:tblStyleLst>`;

export async function builtinIntegrationBase(): Promise<Uint8Array> {
  return formatFixture();
}

export async function builtinIntegrationFixture(
  base: Uint8Array,
  id = builtinStyleId,
  mode: "missing" | "empty" | "builtin" | "custom" = "missing",
  options: { noTheme?: boolean; definitionId?: string } = {},
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(base);
  const slide = new DOMParser().parseFromString(
    await zip.file(tableSlidePath)!.async("string"),
    "application/xml",
  );
  const table = slide.getElementsByTagNameNS(a, "tbl")[0],
    properties = one(table, a, "tblPr")!;
  one(properties, a, "tableStyleId")!.textContent = id;
  for (const name of [
    "firstRow",
    "lastRow",
    "firstCol",
    "lastCol",
    "bandRow",
    "bandCol",
  ])
    properties.setAttribute(name, "1");
  for (const cell of Array.from(table.getElementsByTagNameNS(a, "tc"))) {
    const properties = one(cell, a, "tcPr")!;
    for (const node of Array.from(properties.children))
      if (
        node.namespaceURI === a &&
        ["solidFill", "noFill"].includes(node.localName)
      )
        node.remove();
    for (const run of Array.from(cell.getElementsByTagNameNS(a, "r")))
      one(run, a, "rPr")?.remove();
  }
  zip.file(tableSlidePath, new XMLSerializer().serializeToString(slide));
  if (mode === "missing") zip.remove(formatStylePath);
  else if (mode === "empty") zip.file(formatStylePath, tableStyleList(""));
  else if (mode === "builtin")
    zip.file(
      formatStylePath,
      tableStyleList(presentationTableBuiltinStyle(id)!),
    );
  else
    zip.file(
      formatStylePath,
      (await zip.file(formatStylePath)!.async("string")).replaceAll(
        formatStyleId,
        options.definitionId ?? id,
      ),
    );
  for (const path of [
    "ppt/presentation.xml",
    "ppt/slideMasters/table-format.xml",
  ]) {
    const relPath = relationPartPath(path),
      rels = new DOMParser().parseFromString(
        await zip.file(relPath)!.async("string"),
        "application/xml",
      );
    for (const entry of Array.from(rels.documentElement.children))
      if (
        entry.namespaceURI === relationships &&
        ((mode === "missing" &&
          entry.getAttribute("Type") === `${r}/tableStyles`) ||
          (options.noTheme && entry.getAttribute("Type") === `${r}/theme`))
      )
        entry.remove();
    zip.file(relPath, new XMLSerializer().serializeToString(rels));
  }
  return zip.generateAsync({ type: "uint8array" });
}
