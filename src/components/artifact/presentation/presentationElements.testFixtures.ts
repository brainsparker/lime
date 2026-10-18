import JSZip from "jszip";
import { editPresentationPackage } from "./presentationPackage";
import { editPresentationTablePackage } from "./presentationTablePackage";
import {
  tableFixture,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";
import { a } from "./presentationPackageXml";

/** 非均匀 shape/table 真实 OPC 夹具；两行三列，每条轨道20px。 */
export async function elementFixture(): Promise<Uint8Array> {
  const tableFrame = { x: 100, y: 50, width: 60, height: 40 };
  const bytes = await editPresentationPackage(
    await editPresentationTablePackage(await tableFixture(), [
      {
        type: "resize-table",
        slideId: "512",
        tableId: "7",
        frame: { left: 100, top: 50, width: 60, height: 40 },
        rowHeights: [20, 20],
        columnWidths: [20, 20, 20],
      },
    ]),
    [
      {
        slideId: "512",
        elementId: "2",
        frame: { x: 0, y: 0, width: 40, height: 20, rotation: 0 },
      },
      { slideId: "512", elementId: "7", frame: { ...tableFrame, rotation: 0 } },
    ],
  );
  const zip = await JSZip.loadAsync(bytes);
  const xml = new DOMParser().parseFromString(
    await zip.file(tableSlidePath)!.async("string"),
    "application/xml",
  );
  for (const transform of Array.from(
    xml.getElementsByTagNameNS(a, "xfrm"),
  ).filter((element) => element.parentElement?.localName === "spPr")) {
    transform.setAttribute("flipH", "1");
    transform.setAttribute("flipV", "1");
  }
  zip.file(tableSlidePath, new XMLSerializer().serializeToString(xml));
  return zip.generateAsync({ type: "uint8array" });
}
