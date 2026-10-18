import { readFileSync } from "node:fs";
import JSZip from "jszip";

export const slideId = "512";
export const tableId = "7";
export const tableSlidePath = "ppt/slides/slide1.xml";

function cell(row: number, column: number, merged: boolean): string {
  const joined = merged && column < 2;
  const continuation = joined && (row > 0 || column > 0);
  const attributes = joined
    ? `${column > 0 ? ' hMerge="1"' : ' gridSpan="2"'}${row > 0 ? ' vMerge="1"' : ' rowSpan="2"'}`
    : "";
  return `<a:tc${attributes}><a:txBody><a:bodyPr wrap="square"/><a:lstStyle><a:lvl1pPr marL="42"/></a:lstStyle><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="zh-CN" sz="1500"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${continuation ? "" : `TABLE_R${row + 1}C${column + 1}`}</a:t></a:r><a:endParaRPr lang="zh-CN"/></a:p></a:txBody><a:tcPr marL="91440" marR="91440" anchor="ctr"><a:lnL w="12700"><a:solidFill><a:srgbClr val="112233"/></a:solidFill></a:lnL><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:extLst><a:ext uri="urn:cell:${row}:${column}"><keep:cell xmlns:keep="urn:keep" value="retained"/></a:ext></a:extLst></a:tcPr></a:tc>`;
}

/** 真实 OPC 包；默认两行三列，merged 版本左上四个格网位置合并为一格。 */
export async function tableFixture(
  options: { merged?: boolean } = {},
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(
    readFileSync(
      "src/components/artifact/presentation/__fixtures__/review.pptx",
    ),
  );
  const rows = [0, 1]
    .map(
      (row) =>
        `<a:tr h="914400">${[0, 1, 2].map((column) => cell(row, column, options.merged ?? false)).join("")}</a:tr>`,
    )
    .join("");
  const table = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${tableId}" name="Fixture table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm rot="60000"><a:off x="914400" y="1828800"/><a:ext cx="5486400" cy="1828800"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr><a:tblGrid><a:gridCol w="1828800"/><a:gridCol w="1828800"/><a:gridCol w="1828800"/></a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  zip.file(
    tableSlidePath,
    (await zip.file(tableSlidePath)!.async("string")).replace(
      "</p:spTree>",
      `${table}</p:spTree>`,
    ),
  );
  zip.file(
    "customXml/table-retained.xml",
    '<keep xmlns="urn:keep">retained</keep>',
  );
  zip.file("ppt/media/table-retained.bin", new Uint8Array([0, 255, 128, 19]));
  return zip.generateAsync({ type: "uint8array" });
}
