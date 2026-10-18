import JSZip from "jszip";
import { a, p, children, one } from "./presentationPackageXml";
import {
  tableFixture,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";

export const emusPerPixel = 9525;
export const widths = [80, 160, 240];
export const heights = [72, 120];
export const serialize = (node: Node) =>
  new XMLSerializer().serializeToString(node);

export async function readStructure(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const xml = new DOMParser().parseFromString(
    await zip.file(tableSlidePath)!.async("string"),
    "application/xml",
  );
  if (xml.querySelector("parsererror"))
    throw new Error(`Invalid fixture XML: ${xml.documentElement.textContent}`);
  const table = xml.getElementsByTagNameNS(a, "tbl")[0];
  const frame = xml.getElementsByTagNameNS(p, "graphicFrame")[0];
  const transform = one(frame, p, "xfrm")!;
  const columns = children(one(table, a, "tblGrid")!, a, "gridCol");
  const rows = children(table, a, "tr");
  return {
    zip,
    xml,
    table,
    frame,
    transform,
    columns,
    rows,
    cells: rows.map((row) => children(row, a, "tc")),
  };
}

export type Structure = Awaited<ReturnType<typeof readStructure>>;

export async function modifyStructure(
  bytes: Uint8Array,
  change: (value: Structure) => void,
): Promise<Uint8Array> {
  const value = await readStructure(bytes);
  change(value);
  value.zip.file(tableSlidePath, serialize(value.xml));
  return value.zip.generateAsync({ type: "uint8array" });
}

/** 非均匀轨道、旋转/翻转、未知纯payload均来自真实 OPC 包中的明确 XML 修改。 */
export async function structureFixture(
  options: { merged?: boolean } = {},
): Promise<Uint8Array> {
  return modifyStructure(
    await tableFixture(options),
    ({ columns, rows, transform, xml }) => {
      xml.documentElement.setAttributeNS(
        "http://www.w3.org/2000/xmlns/",
        "xmlns:keep",
        "urn:keep",
      );
      xml.documentElement.setAttributeNS(
        "http://www.w3.org/2000/xmlns/",
        "xmlns:a16",
        "http://schemas.microsoft.com/office/drawing/2014/main",
      );
      columns.forEach((column, index) => {
        column.setAttribute("w", String(widths[index] * emusPerPixel));
        column.setAttributeNS("urn:keep", "keep:column", String(index));
      });
      rows.forEach((row, index) => {
        row.setAttribute("h", String(heights[index] * emusPerPixel));
        row.setAttributeNS("urn:keep", "keep:row", String(index));
      });
      one(transform, a, "ext")!.setAttribute("cx", String(480 * emusPerPixel));
      transform.setAttribute("flipH", "1");
      transform.setAttribute("flipV", "1");
      transform.setAttributeNS("urn:keep", "keep:transform", "retained");
    },
  );
}

export function cellText(cell: Element) {
  return Array.from(cell.getElementsByTagNameNS(a, "p"), (paragraph) =>
    Array.from(
      paragraph.getElementsByTagNameNS(a, "t"),
      (run) => run.textContent,
    ).join(""),
  ).join("\n");
}

export function dimensions(value: Structure) {
  const extent = one(value.transform, a, "ext")!;
  return {
    widths: value.columns.map(
      (column) => Number(column.getAttribute("w")) / emusPerPixel,
    ),
    heights: value.rows.map(
      (row) => Number(row.getAttribute("h")) / emusPerPixel,
    ),
    width: Number(extent.getAttribute("cx")) / emusPerPixel,
    height: Number(extent.getAttribute("cy")) / emusPerPixel,
  };
}
