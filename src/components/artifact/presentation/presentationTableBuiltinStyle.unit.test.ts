import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
  renderSlide,
  type PptxFiles,
} from "@aiden0z/pptx-renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { a, one, children } from "./presentationPackageXml";
import {
  presentationTableBuiltinStyle,
  presentationTableBuiltinStyleIds,
} from "./presentationTableBuiltinStyle";
import { formatFixture } from "./presentationTableFormatPackage.testFixtures";
import { readStructure } from "./presentationTableStructurePackage.testFixtures";
import { tableSlidePath } from "./presentationTablePackage.testFixtures";

const defaultId = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}";
const unknownId = "{FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF}";
const root = (body: string) =>
  `<a:tblStyleLst xmlns:a="${a}">${body}</a:tblStyleLst>`;
const profiles = {
  plain: {},
  rows: { firstRow: true, lastRow: true, bandRow: true },
  columns: { firstCol: true, lastCol: true, bandCol: true },
  all: {
    firstRow: true,
    lastRow: true,
    firstCol: true,
    lastCol: true,
    bandRow: true,
    bandCol: true,
  },
} as const;
type Profile = Partial<
  Record<
    "firstRow" | "lastRow" | "firstCol" | "lastCol" | "bandRow" | "bandCol",
    boolean
  >
>;
let files: PptxFiles;
let slideSource: string;

beforeAll(async () => {
  // Separate genuine OPC fixture: complete slide/layout/master/theme relations.
  // Remove direct authoring fill/run color so inherited styles remain observable.
  const bytes = await formatFixture();
  const value = await readStructure(bytes);
  for (const cell of value.cells.flat()) {
    const properties = one(cell, a, "tcPr")!;
    for (const node of Array.from(properties.children))
      if (
        node.namespaceURI === a &&
        [
          "solidFill",
          "noFill",
          "gradFill",
          "pattFill",
          "blipFill",
          "grpFill",
        ].includes(node.localName)
      )
        node.remove();
    for (const run of Array.from(cell.getElementsByTagNameNS(a, "r")))
      one(run, a, "rPr")?.remove();
  }
  slideSource = new XMLSerializer().serializeToString(value.xml);
  files = await parseZip(bytes.slice().buffer as ArrayBuffer);
});

function targetSlide(id: string, profile: Profile, direct = false) {
  const xml = new DOMParser().parseFromString(slideSource, "application/xml");
  const table = xml.getElementsByTagNameNS(a, "tbl")[0];
  const properties = one(table, a, "tblPr")!;
  one(properties, a, "tableStyleId")!.textContent = id;
  for (const name of [
    "firstRow",
    "lastRow",
    "firstCol",
    "lastCol",
    "bandRow",
    "bandCol",
  ] as const)
    properties.setAttribute(name, profile[name] ? "1" : "0");
  if (direct) {
    const cell = children(children(table, a, "tr")[1], a, "tc")[2];
    const source = new DOMParser().parseFromString(
      `<a:tcPr xmlns:a="${a}"><a:lnB w="47625"><a:solidFill><a:srgbClr val="EEDDCC"/></a:solidFill><a:prstDash val="dash"/></a:lnB><a:solidFill><a:srgbClr val="112233"/></a:solidFill></a:tcPr>`,
      "application/xml",
    ).documentElement;
    const properties = one(cell, a, "tcPr")!;
    for (const node of Array.from(source.children))
      properties.insertBefore(
        xml.importNode(node, true),
        one(properties, a, "extLst") ?? null,
      );
    const run = cell.getElementsByTagNameNS(a, "r")[0];
    const runProperties = new DOMParser().parseFromString(
      `<a:rPr xmlns:a="${a}" b="0" i="1"><a:solidFill><a:srgbClr val="654321"/></a:solidFill></a:rPr>`,
      "application/xml",
    ).documentElement;
    run.prepend(xml.importNode(runProperties, true));
  }
  return new XMLSerializer().serializeToString(xml);
}

async function render(id: string, source: string, definition?: string) {
  const model = buildPresentation({
    ...files,
    slides: new Map(files.slides).set(tableSlidePath, source),
    // Empty list enters the renderer's real builtin fallback. Explicit mode
    // supplies only our independent definition through its supported public API.
    tableStyles: root(definition ?? ""),
  });
  expect(model.themes.size).toBe(1);
  expect(model.layouts.size).toBe(1);
  expect(model.masters.size).toBe(1);
  const slide = model.slides[0];
  materializeSlideNodes(model, slide);
  const table = slide.nodes.find((node) => node.id === "7");
  expect(table?.nodeType).toBe("table");
  if (table?.nodeType !== "table") throw new Error("Missing fixture table");
  expect(table.tableStyleId).toBe(id);
  const errors: unknown[] = [];
  const handle = renderSlide(model, slide, {
    onNodeError: (_id, error) => errors.push(error),
  });
  try {
    await handle.ready;
    expect(errors).toEqual([]);
    const element = handle.element.querySelector("table");
    expect(element).not.toBeNull();
    const cells = Array.from(element!.querySelectorAll("td"));
    expect(cells).toHaveLength(20);
    return {
      table: element!.getAttribute("style"),
      cells: cells.map((cell) => ({
        text: cell.textContent,
        style: cell.getAttribute("style"),
        content: cell.innerHTML,
        bottom: cell.style.borderBottom,
        fill: cell.style.backgroundColor,
      })),
    };
  } finally {
    handle.dispose();
  }
}

describe("完整Office builtin定义与公开renderer回退的逐格parity", () => {
  it.each(presentationTableBuiltinStyleIds)(
    "%s 的fill/text/header/band和border一致",
    async (id) => {
      const definition = presentationTableBuiltinStyle(id);
      expect(definition).toBeDefined();
      for (const [profile, flags] of Object.entries(profiles)) {
        const source = targetSlide(id, flags);
        const expected = await render(id, source);
        const actual = await render(id, source, definition);
        expect(actual, `${id}: ${profile}`).toEqual(expected);
      }
    },
  );

  it.each(presentationTableBuiltinStyleIds)(
    "%s 的原格direct border/fill/text优先级保持",
    async (id) => {
      const source = targetSlide(id, profiles.all, true);
      const expected = await render(id, source);
      const actual = await render(
        id,
        source,
        presentationTableBuiltinStyle(id),
      );
      expect(actual).toEqual(expected);
      expect(actual.cells[7].bottom).toContain("5px dashed");
      expect(actual.cells[7].bottom).toContain("#EEDDCC");
      expect(actual.cells[7].fill).toBe("rgb(17, 34, 51)");
      expect(actual.cells[7].content).toContain("color: rgb(101, 67, 33)");
      expect(actual.cells[7].content).toContain("font-style: italic");
    },
  );

  it("大小写与空白规范化不改变原ID清单，未知或注入文本不生成XML", () => {
    expect(
      presentationTableBuiltinStyle(`  ${defaultId.toLowerCase()}  `),
    ).toBe(presentationTableBuiltinStyle(defaultId));
    for (const id of [
      unknownId,
      "",
      "Medium-Style-2",
      '<a:tblStyle styleId="injected"/>',
      defaultId.slice(1, -1),
    ])
      expect(presentationTableBuiltinStyle(id)).toBeUndefined();
    expect(Object.isFrozen(presentationTableBuiltinStyleIds)).toBe(true);
    expect(presentationTableBuiltinStyleIds).toHaveLength(74);
    expect(new Set(presentationTableBuiltinStyleIds).size).toBe(74);
    expect(presentationTableBuiltinStyleIds).toContain(defaultId);
  });

  it("未知UUID保持renderer无builtin投影，不能回退默认样式", async () => {
    const source = targetSlide(unknownId, profiles.all);
    const actual = await render(unknownId, source);
    expect(presentationTableBuiltinStyle(unknownId)).toBeUndefined();
    expect(actual.cells.every((cell) => !cell.bottom)).toBe(true);
    const known = await render(defaultId, targetSlide(defaultId, profiles.all));
    expect(actual).not.toEqual(known);
  });
});
