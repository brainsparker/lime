import { describe, expect, it } from "vitest";
import { a, one } from "./presentationPackageXml";
import { editPresentationTablePackage } from "./presentationTablePackage";
import {
  formatFixture,
  writeFormatLine as line,
  formatBorder as border,
  readFormatStyle as style,
} from "./presentationTableFormatPackage.testFixtures";
import {
  readStructure,
  modifyStructure,
} from "./presentationTableStructurePackage.testFixtures";
import { slideId, tableId } from "./presentationTablePackage.testFixtures";
const identity = { slideId, tableId };
const full = { row: 0, column: 0, rowCount: 4, columnCount: 5 };
const single = { row: 1, column: 1, rowCount: 1, columnCount: 1 };

describe("PPTX authoring border color", () => {
  it.each([
    ["red", "000000"],
    ["red-500", "FB2C36"],
    ["#AbC", "AABBCC"],
    ["aabbcc80", "AABBCC"],
    ["rgb(999, 0, 2)", "FF0002"],
    ["rgba(1 2 3 / 50%)", "010203"],
    ["blue-500/50", "2B7FFF"],
    ["not-a-color", "000000"],
    ["accent1", "336699"],
  ])("color constructor %s → %s", async (color, hex) => {
    const output = await editPresentationTablePackage(await formatFixture(), [
      { ...identity, type: "format-existing-borders", range: full, color },
    ]);
    expect((await style(output, full)).borderColor).toBe(`#${hex}`);
  });
  it("blank existing color不改；none写noFill；gradient保留stops且snapshot不冒充solid", async () => {
    const input = await formatFixture(),
      blank = await editPresentationTablePackage(input, [
        {
          ...identity,
          type: "format-existing-borders",
          range: full,
          color: "  ",
        },
      ]);
    expect((await style(blank, full)).borderColor).toBe("#336699");
    const none = await editPresentationTablePackage(input, [
      {
        ...identity,
        type: "format-existing-borders",
        range: full,
        color: "none",
      },
    ]);
    expect((await style(none, full)).borderWidth).toBe(0);
    const gradient = await editPresentationTablePackage(input, [
      {
        ...identity,
        type: "format-existing-borders",
        range: full,
        color: "linear(90deg, #FF0000 10%, rgba(0, 0, 255, 0.5) 90%)",
      },
    ]);
    const line = border(await readStructure(gradient), 0, 0, "top")!;
    expect(
      one(line, a, "gradFill")?.getElementsByTagNameNS(a, "gs"),
    ).toHaveLength(2);
    expect((await style(gradient, full)).borderEdges).toBe("none");
  });
  it("authoring alpha/lighten与hex丢alpha语义通过真实OOXML落盘", async () => {
    const output = await editPresentationTablePackage(await formatFixture(), [
      {
        ...identity,
        type: "format-existing-borders",
        range: full,
        color: "#000000+50/25",
      },
    ]);
    const color = border(
      await readStructure(output),
      0,
      0,
      "top",
    )!.getElementsByTagNameNS(a, "srgbClr")[0];
    expect(one(color, a, "alpha")?.getAttribute("val")).toBe("25000");
    expect(one(color, a, "lumMod")?.getAttribute("val")).toBe("50000");
    expect(one(color, a, "lumOff")?.getAttribute("val")).toBe("50000");
    expect((await style(output, full)).borderColor).toBe("#808080");
  });
  it("全表有线但选区无有色边时，不提前执行gradient fill setter", async () => {
    const input = await modifyStructure(
      await formatFixture({ styled: false }),
      (value) => line(value, 0, 0, "top"),
    );
    expect(
      await editPresentationTablePackage(input, [
        {
          ...identity,
          type: "format-existing-borders",
          range: single,
          color: "linear(#FF0000)",
        },
      ]),
    ).toEqual(input);
  });
});
