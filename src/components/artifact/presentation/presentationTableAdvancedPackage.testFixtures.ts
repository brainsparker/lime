import { a, children, one } from "./presentationPackageXml";
import {
  structureFixture,
  modifyStructure,
  emusPerPixel,
} from "./presentationTableStructurePackage.testFixtures";

/** 四行五列原生 OOXML；每格正文非空，含未知属性与扩展以验证无损重排。 */
export async function advancedFixture(options: { merged?: boolean } = {}) {
  return modifyStructure(
    await structureFixture(),
    ({ table, rows, columns, transform }) => {
      const grid = one(table, a, "tblGrid")!;
      const columnTemplate = columns[0];
      columns.forEach((column) => column.remove());
      for (let column = 0; column < 5; column++) {
        const node = columnTemplate.cloneNode(true) as Element;
        node.setAttribute("w", String((column + 1) * 40 * emusPerPixel));
        node.setAttributeNS("urn:keep", "keep:column", String(column));
        grid.append(node);
      }
      const rowTemplate = rows[0],
        cellTemplate = children(rowTemplate, a, "tc")[0];
      rows.forEach((row) => row.remove());
      for (let row = 0; row < 4; row++) {
        const node = rowTemplate.cloneNode(true) as Element;
        children(node, a, "tc").forEach((cell) => cell.remove());
        node.setAttribute("h", String((40 + row * 20) * emusPerPixel));
        node.setAttributeNS("urn:keep", "keep:row", String(row));
        for (let column = 0; column < 5; column++) {
          const cell = cellTemplate.cloneNode(true) as Element;
          cell.getElementsByTagNameNS(a, "t")[0].textContent =
            `ADV_R${row}C${column}`;
          cell.setAttributeNS("urn:keep", "keep:cell", `${row}:${column}`);
          if (
            options.merged &&
            row >= 1 &&
            row <= 2 &&
            column >= 1 &&
            column <= 2
          ) {
            if (column === 1) cell.setAttribute("gridSpan", "2");
            else cell.setAttribute("hMerge", "1");
            if (row === 1) cell.setAttribute("rowSpan", "2");
            else cell.setAttribute("vMerge", "1");
          }
          node.append(cell);
        }
        table.append(node);
      }
      one(transform, a, "ext")!.setAttribute("cx", String(600 * emusPerPixel));
      one(transform, a, "ext")!.setAttribute("cy", String(280 * emusPerPixel));
    },
  );
}
