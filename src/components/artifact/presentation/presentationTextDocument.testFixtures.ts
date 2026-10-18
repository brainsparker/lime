import { buildPresentation, parseZip } from "@aiden0z/pptx-renderer";
import JSZip from "jszip";
import type { PresentationSnapshot } from "./presentationDocument";
import {
  a,
  p,
  children,
  one,
  readXml,
  slidePaths,
} from "./presentationPackageXml";
import {
  tableFixture,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";
import { textBodyFixture } from "./presentationTextRange.testFixtures";
import { registerPresentationTextSources } from "./presentationTextDocument";

export const textSlidePath = tableSlidePath;
export const textRelationsPath = "ppt/slides/_rels/slide1.xml.rels";
export const serializeTextBody = (node: Node) =>
  new XMLSerializer().serializeToString(node);

export async function textPackagePart(
  bytes: Uint8Array,
  path = textSlidePath,
): Promise<Document> {
  return readXml(
    await (await JSZip.loadAsync(bytes)).file(path)!.async("string"),
  );
}
export async function modifyTextPackage(
  bytes: Uint8Array,
  edit: (document: Document, zip: JSZip) => void | Promise<void>,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes),
    document = await textPackagePart(bytes);
  await edit(document, zip);
  zip.file(textSlidePath, serializeTextBody(document));
  return zip.generateAsync({ type: "uint8array" });
}
export async function textPackageFixture(merged = false): Promise<Uint8Array> {
  return modifyTextPackage(
    await tableFixture({ merged }),
    async (document, zip) => {
      const shape = document.getElementsByTagNameNS(p, "sp")[0];
      one(shape, p, "txBody")!.replaceWith(
        document.importNode(textBodyFixture(), true),
      );
      const row = document.getElementsByTagNameNS(a, "tr")[0];
      for (const index of merged ? [0] : [0, 1]) {
        const cell = children(row, a, "tc")[index];
        one(cell, a, "txBody")!.replaceWith(
          document.importNode(textBodyFixture({ cell: true }), true),
        );
      }
      zip.file(
        textRelationsPath,
        (await zip.file(textRelationsPath)!.async("string")).replace(
          "</Relationships>",
          '<Relationship Id="rLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/rich" TargetMode="External"/><Relationship Id="rOther" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="mailto:rich@example.invalid" TargetMode="External"/></Relationships>',
        ),
      );
    },
  );
}
export async function textSnapshot(bytes: Uint8Array, register = true) {
  const files = await parseZip(bytes.slice().buffer as ArrayBuffer);
  const slideIds = [
    ...slidePaths(
      readXml(files.presentation),
      readXml(files.presentationRels),
    ).keys(),
  ];
  const snapshot: PresentationSnapshot = {
    sourceSha256: "f".repeat(64),
    sourceBytes: bytes.slice(),
    slideIds,
    model: buildPresentation(files),
  };
  if (register) registerPresentationTextSources(snapshot, files);
  return { snapshot, files };
}
