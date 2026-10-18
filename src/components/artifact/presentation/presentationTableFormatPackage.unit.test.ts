import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
  renderSlide,
} from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import { a, r, one } from "./presentationPackageXml";
import { tableGrid } from "./presentationTableGrid";
import {
  tableEdges,
  mergedTableRange,
} from "./presentationTableBorderGeometry";
import {
  readPresentationTableBorderStyle,
  type PresentationTableBorderPreset,
} from "./presentationTableBorderStyle";
import {
  tableStyleContext,
  resolvedTableLines,
} from "./presentationTableStyle";
import {
  editPresentationTablePackage,
  type PresentationTableEdit,
} from "./presentationTablePackage";
import {
  formatFixture,
  writeFormatLine as line,
  formatBorder as border,
  readFormatStyle as style,
  formatStylePath,
} from "./presentationTableFormatPackage.testFixtures";
import {
  readStructure,
  modifyStructure,
  serialize,
  dimensions,
  cellText,
} from "./presentationTableStructurePackage.testFixtures";
import {
  slideId,
  tableId,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";
import { tableFixture } from "./presentationTablePackage.testFixtures";

const identity = { slideId, tableId };
const range = { row: 1, column: 1, rowCount: 2, columnCount: 3 };
const full = { row: 0, column: 0, rowCount: 4, columnCount: 5 };
const single = { row: 1, column: 1, rowCount: 1, columnCount: 1 };
async function rebuild(bytes: Uint8Array) {
  const model = buildPresentation(
    await parseZip(bytes.slice().buffer as ArrayBuffer),
  );
  const slide = model.slides[0];
  materializeSlideNodes(model, slide);
  const table = slide.nodes.find((node) => node.id === tableId);
  if (table?.nodeType !== "table") throw new Error("Missing rebuilt table");
  return { model, slide, table };
}
const edit = (
  type: "set-border-preset",
  preset: PresentationTableBorderPreset,
  selected = range,
): PresentationTableEdit => ({ ...identity, type, preset, range: selected });

describe("PPTX 边框 preset 与共边", () => {
  it.each(["all", "outside", "inside", "columns", "rows", "none"] as const)(
    "真实无样式原包应用 %s 并重建精确 snapshot",
    async (preset) => {
      const bytes = await editPresentationTablePackage(
        await formatFixture({ styled: false }),
        [edit("set-border-preset", preset)],
      );
      expect(await style(bytes)).toEqual({
        borderEdges: preset,
        borderWidth: preset === "none" ? 0 : 1,
        borderColor: preset === "none" ? undefined : "#000000",
        borderStyle: preset === "none" ? undefined : "solid",
      });
      const { table, model, slide } = await rebuild(bytes);
      expect(
        readPresentationTableBorderStyle(table, range, model, slide),
      ).toEqual({ status: "ready", style: await style(bytes) });
    },
  );

  it("raw 未知 preset 沿参考 all 分支；不增设 membership guard", async () => {
    const output = await editPresentationTablePackage(
      await formatFixture({ styled: false }),
      [
        {
          ...edit("set-border-preset", "all"),
          preset: "unknown",
        } as unknown as PresentationTableEdit,
      ],
    );
    expect((await style(output)).borderEdges).toBe("all");
  });

  it("清理闭区间内的选区外 coincident side，保留其另一侧", async () => {
    const input = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) => {
        line(value, 0, 1, "bottom");
        line(value, 1, 0, "right");
        line(value, 3, 1, "top");
        line(value, 1, 4, "left");
        line(value, 0, 1, "top");
      },
    );
    const value = await readStructure(
      await editPresentationTablePackage(input, [
        edit("set-border-preset", "inside"),
      ]),
    );
    for (const [row, column, side] of [
      [0, 1, "bottom"],
      [1, 0, "right"],
      [3, 1, "top"],
      [1, 4, "left"],
    ] as const) {
      const node = border(value, row, column, side)!;
      expect(one(node, a, "noFill")).toBeDefined();
      expect(node.getAttribute("w")).toBe("0");
    }
    expect(one(border(value, 0, 1, "top")!, a, "solidFill")).toBeDefined();
  });

  it("preset 混色不会任取第一条线；清理后使用灰色 fallback", async () => {
    const input = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) => {
        line(value, 1, 1, "bottom");
        line(
          value,
          1,
          2,
          "bottom",
          '<a:solidFill><a:srgbClr val="445566"/></a:solidFill><a:prstDash val="solid"/>',
        );
      },
    );
    expect((await style(input)).borderColor).toBeUndefined();
    const output = await editPresentationTablePackage(input, [
      edit("set-border-preset", "all"),
    ]);
    expect((await style(output)).borderColor).toBe("#D1D5DB");
  });

  it("raw partial merged range 的赋值仍是物理格，snapshot 才扩到 merged closure", async () => {
    const input = await formatFixture({ styled: false, merged: true });
    const before = await readStructure(input),
      grid = tableGrid(before.xml, tableId);
    expect(mergedTableRange(grid, single)).toEqual({
      row: 1,
      column: 1,
      rowCount: 2,
      columnCount: 2,
    });
    expect([...tableEdges(grid, single)].map(({ side }) => side)).toEqual(
      expect.arrayContaining(["top", "left"]),
    );
    const after = await readStructure(
      await editPresentationTablePackage(input, [
        edit("set-border-preset", "all", single),
      ]),
    );
    expect(border(after, 1, 1, "right")).toBeDefined();
    expect(border(after, 2, 2, "right")).toBeUndefined();
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 5; x++)
        for (const key of ["gridSpan", "rowSpan", "hMerge", "vMerge"])
          expect(after.cells[y][x].getAttribute(key)).toBe(
            before.cells[y][x].getAttribute(key),
          );
  });

  it("保留正文、合并、轨道、frame、非目标ZIP成员与 unknown line/cell payload", async () => {
    const input = await modifyStructure(await formatFixture(), (value) =>
      line(
        value,
        1,
        1,
        "top",
        '<a:solidFill><a:srgbClr val="336699"/></a:solidFill><a:prstDash val="solid"/><keep:edge value="retained"/><a:extLst><a:ext uri="urn:keep"/></a:extLst>',
        'w="19050" cap="rnd" cmpd="dbl" keep:edge="retained"',
      ),
    );
    const before = await readStructure(input),
      after = await readStructure(
        await editPresentationTablePackage(input, [
          edit("set-border-preset", "outside"),
        ]),
      );
    expect(dimensions(after)).toEqual(dimensions(before));
    expect(serialize(after.transform)).toBe(serialize(before.transform));
    expect(after.cells.map((row) => row.map(cellText))).toEqual(
      before.cells.map((row) => row.map(cellText)),
    );
    const top = border(after, 1, 1, "top")!;
    expect(top.getAttributeNS("urn:keep", "edge")).toBe("retained");
    expect(top.getElementsByTagNameNS("urn:keep", "edge")).toHaveLength(1);
    expect(one(top, a, "extLst")).toBeDefined();
    expect(top.hasAttribute("cmpd")).toBe(false);
    for (const [path, entry] of Object.entries(before.zip.files))
      if (!entry.dir && path !== tableSlidePath)
        expect(await after.zip.file(path)!.async("uint8array"), path).toEqual(
          await entry.async("uint8array"),
        );
  });
});

describe("PPTX inherited 与 existing border 格式", () => {
  it("真实 custom style/theme 解析后只将命中边拷贝成 direct line，原 style part 保留", async () => {
    const input = await formatFixture();
    expect(await style(input)).toEqual({
      borderEdges: "all",
      borderWidth: 2,
      borderColor: "#336699",
      borderStyle: "solid",
    });
    const output = await editPresentationTablePackage(input, [
      {
        ...identity,
        type: "format-existing-borders",
        range: single,
        color: "#123abc",
        width: 5,
      },
    ]);
    const after = await readStructure(output),
      before = await readStructure(input);
    expect(border(after, 1, 1, "right")?.getAttribute("w")).toBe("47625");
    expect(border(after, 1, 2, "left")).toBeUndefined();
    expect(border(after, 1, 0, "right")?.getAttribute("w")).toBe("47625");
    expect(await after.zip.file(formatStylePath)!.async("string")).toBe(
      await before.zip.file(formatStylePath)!.async("string"),
    );
    const { table, model, slide } = await rebuild(output);
    expect(
      readPresentationTableBorderStyle(table, single, model, slide),
    ).toEqual({ status: "ready", style: await style(output, single) });
  });

  it("全表无线时 fallback all；别处有 diagonal 也禁止选区 fallback", async () => {
    const fallback = await editPresentationTablePackage(
      await formatFixture({ styled: false }),
      [
        {
          ...identity,
          type: "format-existing-borders",
          range: single,
          color: "#FF0000",
          width: 3,
        },
      ],
    );
    expect(await style(fallback, single)).toEqual({
      borderEdges: "all",
      borderWidth: 3,
      borderColor: "#FF0000",
      borderStyle: "solid",
    });
    const input = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) => {
        const diagonal = value.xml.createElementNS(a, "a:lnTlToBr");
        diagonal.setAttribute("w", "19050");
        one(value.cells[0][0], a, "tcPr")!.prepend(diagonal);
      },
    );
    expect(
      await editPresentationTablePackage(input, [
        {
          ...identity,
          type: "format-existing-borders",
          range: single,
          color: "#FF0000",
          width: 3,
        },
      ]),
    ).toEqual(input);
  });

  it("width0 隐藏但保留原 w/dash/compound/未知数据；正width不恢复无色线", async () => {
    const input = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) =>
        line(
          value,
          1,
          1,
          "top",
          '<a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:prstDash val="dashDot"/><a:round/><keep:payload/>',
          'w="38100" cmpd="dbl" cap="rnd" keep:marker="yes"',
        ),
    );
    const hidden = await editPresentationTablePackage(input, [
        {
          ...identity,
          type: "format-existing-borders",
          range: single,
          width: 0,
        },
      ]),
      value = await readStructure(hidden),
      node = border(value, 1, 1, "top")!;
    expect(node.getAttribute("w")).toBe("38100");
    expect(node.getAttribute("cmpd")).toBe("dbl");
    expect(node.getAttribute("cap")).toBe("rnd");
    expect(one(node, a, "prstDash")?.getAttribute("val")).toBe("dashDot");
    expect(one(node, a, "noFill")).toBeDefined();
    expect(node.getElementsByTagNameNS("urn:keep", "payload")).toHaveLength(1);
    expect(
      await editPresentationTablePackage(hidden, [
        {
          ...identity,
          type: "format-existing-borders",
          range: single,
          width: 7,
        },
      ]),
    ).toEqual(hidden);
  });

  it("existing 格式包括交界两侧但不改 diagonal、非命中side或无色line", async () => {
    const input = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) => {
        line(value, 0, 1, "bottom");
        line(value, 1, 1, "top");
        line(value, 1, 1, "left", "<a:noFill/>");
        line(value, 0, 1, "top");
        const diagonal = value.xml.createElementNS(a, "a:lnTlToBr");
        diagonal.setAttribute("w", "19050");
        one(value.cells[1][1], a, "tcPr")!.append(diagonal);
      },
    );
    const before = await readStructure(input),
      after = await readStructure(
        await editPresentationTablePackage(input, [
          {
            ...identity,
            type: "format-existing-borders",
            range: single,
            width: 6,
          },
        ]),
      );
    expect(border(after, 0, 1, "bottom")?.getAttribute("w")).toBe("57150");
    expect(border(after, 1, 1, "top")?.getAttribute("w")).toBe("57150");
    for (const [row, column, side] of [
      [0, 1, "top"],
      [1, 1, "left"],
    ] as const)
      expect(serialize(border(after, row, column, side)!)).toBe(
        serialize(border(before, row, column, side)!),
      );
    expect(
      serialize(one(one(after.cells[1][1], a, "tcPr")!, a, "lnTlToBr")!),
    ).toBe(serialize(one(one(before.cells[1][1], a, "tcPr")!, a, "lnTlToBr")!));
  });

  it("snapshot 共边取最宽线，tie 保留row-major第一条；零宽可见线最小.25", async () => {
    const input = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) => {
        line(value, 0, 1, "bottom", undefined, 'w="38100"');
        line(
          value,
          1,
          1,
          "top",
          '<a:solidFill><a:srgbClr val="445566"/></a:solidFill><a:prstDash val="solid"/>',
          'w="38100"',
        );
      },
    );
    expect((await style(input, single)).borderColor).toBe("#112233");
    expect((await style(input, single)).borderWidth).toBe(4);
    const thin = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) => line(value, 1, 1, "top", undefined, 'w="0"'),
    );
    expect((await style(thin, single)).borderWidth).toBe(0.25);
  });

  it("同宽共边用native style/compound权重决定胜出，透明色仍有可见边语义", async () => {
    const input = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) => {
        line(value, 0, 1, "bottom", undefined, 'w="19050" cmpd="sng"');
        line(
          value,
          1,
          1,
          "top",
          '<a:solidFill><a:srgbClr val="445566"><a:alpha val="0"/></a:srgbClr></a:solidFill><a:prstDash val="solid"/>',
          'w="19050" cmpd="dbl"',
        );
      },
    );
    expect(await style(input, single)).toEqual({
      borderEdges: undefined,
      borderWidth: 2,
      borderColor: "#445566",
      borderStyle: "solid",
    });
  });

  it("conditional firstRow 与 table-options 改变 resolved style 且保留原flags", async () => {
    const input = await formatFixture();
    const output = await editPresentationTablePackage(input, [
      {
        ...identity,
        type: "set-table-options",
        headerRow: true,
        headerColumn: true,
      },
    ]);
    expect((await style(output, full)).borderWidth).toBeUndefined();
    expect((await style(output, full)).borderColor).toBeUndefined();
    const value = await readStructure(output),
      context = await tableStyleContext(value.zip, tableSlidePath, value.xml);
    const resolved = resolvedTableLines(tableGrid(value.xml, tableId), context);
    expect(
      resolved.get(value.cells[0][0])?.get("bottom")?.getAttribute("w"),
    ).toBe("38100");
    const { table, model, slide } = await rebuild(output);
    expect(readPresentationTableBorderStyle(table, full, model, slide)).toEqual(
      { status: "ready", style: await style(output, full) },
    );
  });

  it("lnRef使用同一theme line及phClr替换，后续编辑可安全写入slide", async () => {
    const value = await readStructure(await formatFixture());
    value.zip.file(
      formatStylePath,
      (await value.zip.file(formatStylePath)!.async("string")).replace(
        /<a:ln w="19050">[\s\S]*?<\/a:ln>/g,
        '<a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef>',
      ),
    );
    const input = await value.zip.generateAsync({ type: "uint8array" });
    expect(await style(input)).toEqual({
      borderEdges: "all",
      borderWidth: 3,
      borderColor: "#336699",
      borderStyle: "dotted",
    });
    const output = await editPresentationTablePackage(input, [
      { ...identity, type: "format-existing-borders", range: single, width: 5 },
    ]);
    expect((await style(output, single)).borderWidth).toBe(5);
  });

  it("真实renderer DOM重建保留custom style，并呈现direct改色与宽度", async () => {
    const output = await editPresentationTablePackage(await formatFixture(), [
      {
        ...identity,
        type: "format-existing-borders",
        range: full,
        color: "#AA3344",
        width: 5,
      },
    ]);
    const { model, slide, table } = await rebuild(output),
      errors: unknown[] = [];
    const handle = renderSlide(model, slide, {
      onNodeError: (_id, error) => errors.push(error),
    });
    try {
      await handle.ready;
      expect(errors).toEqual([]);
      const cells = handle.element.querySelectorAll("td");
      expect(cells).toHaveLength(20);
      expect((cells[0] as HTMLElement).style.borderTop).toContain("5px");
      expect((cells[0] as HTMLElement).style.borderTop).toContain("#AA3344");
      expect(table.properties?.attr("firstRow")).toBe("0");
    } finally {
      handle.dispose();
    }
  });
});

describe("PPTX options 与不安全继承边界", () => {
  it("false关闭header，null/omitted不覆盖，保留所有flags/styleId/未知属性与children", async () => {
    const input = await modifyStructure(await formatFixture(), (value) => {
      const properties = one(value.table, a, "tblPr")!;
      for (const key of [
        "firstRow",
        "firstCol",
        "lastRow",
        "lastCol",
        "bandRow",
        "bandCol",
      ])
        properties.setAttribute(key, "1");
    });
    const output = await editPresentationTablePackage(input, [
      {
        ...identity,
        type: "set-table-options",
        headerRow: false,
        headerColumn: false,
      },
    ]);
    const before = await readStructure(input),
      after = await readStructure(output),
      props = one(after.table, a, "tblPr")!;
    expect(props.getAttribute("firstRow")).toBe("0");
    expect(props.getAttribute("firstCol")).toBe("0");
    for (const key of ["lastRow", "lastCol", "bandRow", "bandCol"])
      expect(props.getAttribute(key)).toBe("1");
    props.setAttribute("firstRow", "1");
    props.setAttribute("firstCol", "1");
    expect(serialize(props)).toBe(serialize(one(before.table, a, "tblPr")!));
    expect(
      await editPresentationTablePackage(output, [
        {
          ...identity,
          type: "set-table-options",
          headerRow: null,
          headerColumn: null,
        } as unknown as PresentationTableEdit,
      ]),
    ).toEqual(output);
    expect(
      await editPresentationTablePackage(output, [
        { ...identity, type: "set-table-options" },
      ]),
    ).toEqual(output);
  });

  it.each([-1, Infinity, NaN, Number.MAX_VALUE])(
    "拒绝非法width %s且输入不变",
    async (width) => {
      const input = await formatFixture(),
        copy = input.slice();
      await expect(
        editPresentationTablePackage(input, [
          {
            ...identity,
            type: "format-existing-borders",
            range: single,
            width,
          },
        ]),
      ).rejects.toThrow("border width");
      expect(input).toEqual(copy);
    },
  );
  it("孤立builtin style明确拒绝/unavailable，不假装为无线条", async () => {
    const input = await tableFixture(),
      copy = input.slice();
    await expect(
      editPresentationTablePackage(input, [
        edit("set-border-preset", "all", {
          row: 0,
          column: 0,
          rowCount: 1,
          columnCount: 1,
        }),
      ]),
    ).rejects.toThrow("unresolved table border style");
    expect(input).toEqual(copy);
    const { table, model, slide } = await rebuild(input);
    expect(
      readPresentationTableBorderStyle(
        table,
        { row: 0, column: 0, rowCount: 1, columnCount: 1 },
        model,
        slide,
      ).status,
    ).toBe("unavailable");
  });
  it("跨part关系、缺失lineRef、缺失theme颜色与未知变换均明确失败并保留输入", async () => {
    for (const kind of [
      "relationship",
      "reference",
      "theme",
      "transform",
    ] as const) {
      const value = await readStructure(await formatFixture());
      let source = await value.zip.file(formatStylePath)!.async("string");
      if (kind === "relationship")
        source = source.replace(
          '<a:ln w="19050">',
          `<a:ln xmlns:r="${r}" w="19050" r:embed="rForeign">`,
        );
      if (kind === "reference")
        source = source.replace(
          /<a:ln w="19050">[\s\S]*?<\/a:ln>/g,
          '<a:lnRef idx="99"/>',
        );
      if (kind === "theme") source = source.replace(/accent1/g, "unresolved");
      if (kind === "transform")
        source = source.replace(
          /<a:schemeClr val="accent1"\/>/g,
          '<a:schemeClr val="accent1"><a:inv/></a:schemeClr>',
        );
      value.zip.file(formatStylePath, source);
      const input = await value.zip.generateAsync({ type: "uint8array" }),
        copy = input.slice();
      const request: PresentationTableEdit =
        kind === "relationship"
          ? {
              ...identity,
              type: "format-existing-borders",
              range: full,
              width: 3,
            }
          : edit("set-border-preset", "all");
      await expect(
        editPresentationTablePackage(input, [request]),
      ).rejects.toThrow();
      expect(input).toEqual(copy);
    }
  });
  it("拒绝无authoring context的var颜色、畸形gradient和非boolean header", async () => {
    const input = await formatFixture();
    for (const color of ["var(--accent)", "linear(#FF0000)"])
      await expect(
        editPresentationTablePackage(input, [
          {
            ...identity,
            type: "format-existing-borders",
            range: single,
            color,
          },
        ]),
      ).rejects.toThrow();
    await expect(
      editPresentationTablePackage(input, [
        {
          ...identity,
          type: "set-table-options",
          headerRow: "true",
        } as unknown as PresentationTableEdit,
      ]),
    ).rejects.toThrow("table header option");
  });
  it("不支持的basedOn、缺失themeOverride目标和歧义ln/lnRef失败时不重写原包", async () => {
    for (const kind of ["basedOn", "themeOverride", "ambiguous"] as const) {
      const value = await readStructure(await formatFixture());
      let source = await value.zip.file(formatStylePath)!.async("string");
      if (kind === "basedOn")
        source = source.replace(
          'styleName="Fixture custom"',
          'styleName="Fixture custom" basedOn="other"',
        );
      if (kind === "ambiguous")
        source = source.replace("</a:top>", '<a:lnRef idx="1"/></a:top>');
      value.zip.file(formatStylePath, source);
      if (kind === "themeOverride") {
        const path = "ppt/slides/_rels/slide1.xml.rels",
          rels = await value.zip.file(path)!.async("string");
        value.zip.file(
          path,
          rels.replace(
            "</Relationships>",
            `<Relationship Id="rThemeOverride" Type="${r}/themeOverride" Target="../theme/override.xml"/></Relationships>`,
          ),
        );
      }
      const input = await value.zip.generateAsync({ type: "uint8array" }),
        copy = input.slice();
      await expect(
        editPresentationTablePackage(input, [edit("set-border-preset", "all")]),
      ).rejects.toThrow();
      expect(input).toEqual(copy);
    }
  });
});
