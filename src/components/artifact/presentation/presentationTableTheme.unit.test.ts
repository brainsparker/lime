import JSZip from "jszip";
import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
  renderSlide,
  type PresentationData,
  type SlideData,
} from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import { a, one } from "./presentationPackageXml";
import {
  importPresentationDocument,
  renderPresentationSlide,
} from "./presentationDocument";
import { tableGrid } from "./presentationTableGrid";
import { tableStyleContext } from "./presentationTableStyle";
import {
  tableBorderStyle,
  readPresentationTableBorderStyle,
} from "./presentationTableBorderStyle";
import { editPresentationTablePackage } from "./presentationTablePackage";
import {
  registerPresentationTableThemeSources,
  presentationThemeModel,
  modelPresentationTheme,
} from "./presentationTableTheme";
import {
  themeFixture,
  themeComponents,
  addThemeOverride,
  addSharedThemeSlide,
  formatThemePath,
} from "./presentationTableTheme.testFixtures";
import { readStructure } from "./presentationTableStructurePackage.testFixtures";
import {
  slideId,
  tableId,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";

const full = { row: 0, column: 0, rowCount: 4, columnCount: 5 };
async function load(bytes: Uint8Array, register = true) {
  const files = await parseZip(bytes.slice().buffer as ArrayBuffer),
    model = buildPresentation(files);
  if (register) registerPresentationTableThemeSources(model, files);
  const slide = model.slides[0];
  materializeSlideNodes(model, slide);
  const table = slide.nodes.find((node) => node.id === tableId);
  if (table?.nodeType !== "table") throw Error("Missing table");
  return { model, slide, table, files };
}
async function nativeStyle(bytes: Uint8Array) {
  const value = await readStructure(bytes);
  return tableBorderStyle(
    tableGrid(value.xml, tableId),
    full,
    await tableStyleContext(value.zip, tableSlidePath, value.xml),
  );
}
function theme(model: PresentationData, slide: SlideData) {
  const master = model.layoutToMaster.get(slide.layoutIndex)!,
    path = model.masterToTheme.get(master)!;
  return model.themes.get(path)!;
}

describe("PPTX theme override 源XML与统一上下文", () => {
  it.each(["master", "layout", "slide"] as const)(
    "%s clrScheme覆盖同时作用于原包与同步reader",
    async (level) => {
      const bytes = await addThemeOverride(
        await themeFixture(),
        level,
        themeComponents({ color: "993355" }),
      );
      const { model, slide, table } = await load(bytes),
        expected = {
          borderEdges: "all",
          borderWidth: 3,
          borderColor: "#993355",
          borderStyle: "dotted",
        };
      expect(await nativeStyle(bytes)).toEqual(expected);
      expect(
        readPresentationTableBorderStyle(table, full, model, slide),
      ).toEqual({ status: "ready", style: expected });
      expect(
        theme(presentationThemeModel(model, slide), slide).colorScheme.get(
          "accent1",
        ),
      ).toBe("993355");
    },
  );
  it("组件按base→master→layout→slide覆盖，缺失组件继承，三个完整组件均不丢失", async () => {
    let bytes = await addThemeOverride(
      await themeFixture(),
      "master",
      themeComponents({
        color: "882244",
        font: "Master Font",
        width: 5,
        dash: "dash",
      }),
    );
    bytes = await addThemeOverride(
      bytes,
      "layout",
      themeComponents({ width: 7, dash: "solid" }),
    );
    bytes = await addThemeOverride(
      bytes,
      "slide",
      themeComponents({ font: "Times New Roman" }),
    );
    const { model, slide, table } = await load(bytes),
      projected = presentationThemeModel(model, slide),
      resolved = theme(projected, slide);
    expect(await nativeStyle(bytes)).toEqual({
      borderEdges: "all",
      borderWidth: 7,
      borderColor: "#882244",
      borderStyle: "solid",
    });
    expect(readPresentationTableBorderStyle(table, full, model, slide)).toEqual(
      { status: "ready", style: await nativeStyle(bytes) },
    );
    expect(resolved.majorFont).toEqual({
      latin: "Times New Roman",
      ea: "Override EA",
      cs: "Override CS",
      scripts: { Jpan: "Override JP" },
    });
    expect(resolved.minorFont.latin).toBe("Courier New");
    expect(resolved.lineStyles).toHaveLength(3);
    expect(resolved.fillStyles).toHaveLength(3);
    expect(resolved.effectStyles).toHaveLength(3);
    expect(resolved.bgFillStyles).toHaveLength(3);
    expect(theme(model, slide).majorFont.latin).toBe("Arial");
    expect(theme(model, slide).lineStyles).toHaveLength(1);
    expect(theme(model, slide).colorScheme.get("accent1")).toBe("336699");
  });
  it("更靠近slide的完整clr/fmt组件替换祖先组件，不对单项拼接", async () => {
    let bytes = await addThemeOverride(
      await themeFixture(),
      "master",
      themeComponents({ color: "112233", width: 5 }),
    );
    bytes = await addThemeOverride(
      bytes,
      "layout",
      themeComponents({ color: "445566", width: 8, dash: "dash" }),
    );
    bytes = await addThemeOverride(
      bytes,
      "slide",
      themeComponents({ color: "AABBCC" }),
    );
    const { model, slide } = await load(bytes);
    expect((await nativeStyle(bytes)).borderColor).toBe("#AABBCC");
    expect((await nativeStyle(bytes)).borderWidth).toBe(8);
    const resolved = theme(presentationThemeModel(model, slide), slide);
    expect(resolved.lineStyles[0].numAttr("w")).toBe(8 * 9525);
    expect(resolved.lineStyles[0].child("prstDash").attr("val")).toBe("dash");
  });
  it("clrScheme颜色变换同步归一到public theme色板，与原包reader和实际DOM一致", async () => {
    const component = themeComponents({ color: "000000" }).replace(
      '<a:accent1><a:srgbClr val="000000"/></a:accent1>',
      '<a:accent1><a:srgbClr val="000000"><a:lumMod val="50000"/><a:lumOff val="50000"/></a:srgbClr></a:accent1>',
    );
    const bytes = await addThemeOverride(
      await themeFixture(),
      "slide",
      component,
    );
    const snapshot = await importPresentationDocument(
        bytes,
        new AbortController().signal,
      ),
      handle = renderPresentationSlide(snapshot, 0);
    try {
      await handle.ready;
      expect((await nativeStyle(bytes)).borderColor).toBe("#808080");
      expect(handle.element.querySelector("td")?.style.borderTop).toBe(
        "3px dotted #808080",
      );
    } finally {
      handle.dispose();
    }
  });
  it("无override且无需展开lnRef返回同一个model；注册仅保留源字符串快照", async () => {
    const { model, slide, files } = await load(await themeFixture());
    const styles = model.tableStyles;
    model.tableStyles = undefined;
    expect(presentationThemeModel(model, slide)).toBe(model);
    model.tableStyles = styles;
    files.themes.clear();
    expect(modelPresentationTheme(model, slide).root).toBeDefined();
  });
  it("非标准override文件名仍按relationship定位，不依赖themeOverride前缀", async () => {
    const bytes = await addThemeOverride(
      await themeFixture(),
      "slide",
      themeComponents({ color: "AA6600" }),
      { targetName: "renamed.xml" },
    );
    const { model, slide, table } = await load(bytes);
    expect(readPresentationTableBorderStyle(table, full, model, slide)).toEqual(
      { status: "ready", style: await nativeStyle(bytes) },
    );
  });
  it("未登记原XML时override不能从已丢失信息推断", async () => {
    const bytes = await addThemeOverride(
        await themeFixture(),
        "slide",
        themeComponents({ color: "AA6600" }),
      ),
      { model, slide, table } = await load(bytes, false);
    expect(() => presentationThemeModel(model, slide)).toThrow(
      "registered table theme XML",
    );
    expect(
      readPresentationTableBorderStyle(table, full, model, slide).status,
    ).toBe("unavailable");
  });
});

describe("PPTX override 实际文档入口与显示", () => {
  it("真实import/render入口显示override颜色、线宽、字体，原model与共享master其他slide保持base", async () => {
    let bytes = await addThemeOverride(
      await themeFixture(),
      "slide",
      themeComponents({ color: "AA3344", font: "Times New Roman", width: 6 }),
    );
    bytes = await addSharedThemeSlide(bytes);
    const snapshot = await importPresentationDocument(
        bytes,
        new AbortController().signal,
      ),
      model = snapshot.model,
      originalThemes = model.themes,
      originalMasterMap = model.masterToTheme,
      firstTheme = theme(model, model.slides[0]);
    const secondIndex = snapshot.slideIds.indexOf("513");
    expect(model.slides[secondIndex].layoutIndex).toBe(
      model.slides[0].layoutIndex,
    );
    const first = renderPresentationSlide(snapshot, 0),
      second = renderPresentationSlide(snapshot, secondIndex);
    try {
      await Promise.all([first.ready, second.ready]);
      const firstCells = first.element.querySelectorAll("td"),
        secondCells = second.element.querySelectorAll("td");
      expect(firstCells).toHaveLength(20);
      expect((firstCells[0] as HTMLElement).style.borderTop).toBe(
        "6px dotted #AA3344",
      );
      expect((secondCells[0] as HTMLElement).style.borderTop).toBe(
        "3px dotted #336699",
      );
      expect(firstCells[0].innerHTML).toContain("Times New Roman");
      expect(secondCells[0].innerHTML).toContain("Arial");
      expect(model.themes).toBe(originalThemes);
      expect(model.masterToTheme).toBe(originalMasterMap);
      expect(theme(model, model.slides[0])).toBe(firstTheme);
      expect(firstTheme.majorFont.latin).toBe("Arial");
    } finally {
      first.dispose();
      second.dispose();
    }
  });
  it("原包width修改不改theme/override成员，重开后reader与渲染保持同一主题", async () => {
    const input = await addThemeOverride(
      await themeFixture(),
      "slide",
      themeComponents({ color: "AA5500", font: "Times New Roman", width: 6 }),
    );
    const output = await editPresentationTablePackage(input, [
      {
        slideId,
        tableId,
        type: "format-existing-borders",
        range: full,
        width: 9,
      },
    ]);
    const before = await JSZip.loadAsync(input),
      after = await JSZip.loadAsync(output);
    for (const path of [formatThemePath, "ppt/theme/themeOverride-slide.xml"])
      expect(await after.file(path)!.async("uint8array")).toEqual(
        await before.file(path)!.async("uint8array"),
      );
    const snapshot = await importPresentationDocument(
        output,
        new AbortController().signal,
      ),
      handle = renderPresentationSlide(snapshot, 0);
    try {
      await handle.ready;
      expect(handle.element.querySelector("td")?.style.borderTop).toBe(
        "9px dotted #AA5500",
      );
      expect((await nativeStyle(output)).borderWidth).toBe(9);
    } finally {
      handle.dispose();
    }
  });
  it("公开renderSlide也可直接消费派生主题model", async () => {
    const bytes = await addThemeOverride(
        await themeFixture(),
        "layout",
        themeComponents({ color: "118855", width: 4 }),
      ),
      { model, slide } = await load(bytes),
      errors: unknown[] = [];
    const handle = renderSlide(presentationThemeModel(model, slide), slide, {
      onNodeError: (_id, error) => errors.push(error),
    });
    try {
      await handle.ready;
      expect(errors).toEqual([]);
      expect(handle.element.querySelector("td")?.style.borderTop).toBe(
        "4px dotted #118855",
      );
    } finally {
      handle.dispose();
    }
  });
  it("原public renderer的lnRef忽略dash可复现，派生样式展开后与codec一致", async () => {
    const bytes = await addThemeOverride(
      await themeFixture(),
      "slide",
      themeComponents({ color: "AA3344", width: 6 }),
    );
    const { model, slide } = await load(bytes);
    const projected = presentationThemeModel(model, slide);
    const unexpanded = renderSlide(
      { ...projected, tableStyles: model.tableStyles },
      slide,
    );
    const expanded = renderSlide(projected, slide);
    try {
      await Promise.all([unexpanded.ready, expanded.ready]);
      expect(unexpanded.element.querySelector("td")?.style.borderTop).toBe(
        "6px solid #AA3344",
      );
      expect(expanded.element.querySelector("td")?.style.borderTop).toBe(
        "6px dotted #AA3344",
      );
      expect((await nativeStyle(bytes)).borderStyle).toBe("dotted");
      expect(
        model.tableStyles?.element?.getElementsByTagNameNS(a, "lnRef"),
      ).toHaveLength(6);
    } finally {
      unexpanded.dispose();
      expanded.dispose();
    }
  });
});

describe("PPTX override fail closed", () => {
  it.each(["font", "color", "format", "root", "duplicate"])(
    "非法%s组件整段拒绝，原包不变且同步reader不可用",
    async (kind) => {
      let component = themeComponents({
        color: "AA6600",
        font: "Times New Roman",
        width: 5,
      });
      if (kind === "font")
        component = component.replace(
          '<a:latin typeface="Times New Roman"/>',
          "",
        );
      if (kind === "color")
        component = component.replace(/<a:accent6>[\s\S]*?<\/a:accent6>/, "");
      if (kind === "format")
        component = component.replace(
          /<a:lnStyleLst>[\s\S]*?<\/a:lnStyleLst>/,
          "",
        );
      if (kind === "root") component += "<a:unknownComponent/>";
      if (kind === "duplicate")
        component += themeComponents({ color: "AA6600" });
      const bytes = await addThemeOverride(
          await themeFixture(),
          "slide",
          component,
        ),
        copy = bytes.slice(),
        { model, slide, table } = await load(bytes);
      await expect(nativeStyle(bytes)).rejects.toThrow();
      expect(
        readPresentationTableBorderStyle(table, full, model, slide).status,
      ).toBe("unavailable");
      expect(() => presentationThemeModel(model, slide)).toThrow();
      await expect(
        editPresentationTablePackage(bytes, [
          {
            slideId,
            tableId,
            type: "set-border-preset",
            range: full,
            preset: "all",
          },
        ]),
      ).rejects.toThrow();
      expect(bytes).toEqual(copy);
    },
  );
  it.each([{ external: true }, { duplicate: true }])(
    "拒绝external/歧义关系%j，原XML不存在也不回退base",
    async (options) => {
      const bytes = await addThemeOverride(
          await themeFixture(),
          "slide",
          themeComponents({ color: "AA6600" }),
          options,
        ),
        { model, slide, table } = await load(bytes);
      await expect(nativeStyle(bytes)).rejects.toThrow();
      expect(
        readPresentationTableBorderStyle(table, full, model, slide).status,
      ).toBe("unavailable");
      expect(() => presentationThemeModel(model, slide)).toThrow();
    },
  );
  it("丢失target/root错误/DOCTYPE不产生近似theme", async () => {
    for (const kind of ["missing", "root", "doctype"]) {
      const zip = await JSZip.loadAsync(
          await addThemeOverride(
            await themeFixture(),
            "slide",
            themeComponents({ color: "AA6600" }),
          ),
        ),
        path = "ppt/theme/themeOverride-slide.xml";
      if (kind === "missing") zip.remove(path);
      else if (kind === "root") zip.file(path, `<a:theme xmlns:a="${a}"/>`);
      else
        zip.file(
          path,
          `<!DOCTYPE themeOverride><a:themeOverride xmlns:a="${a}"/>`,
        );
      const bytes = await zip.generateAsync({ type: "uint8array" }),
        { model, slide, table } = await load(bytes);
      await expect(nativeStyle(bytes)).rejects.toThrow();
      expect(
        readPresentationTableBorderStyle(table, full, model, slide).status,
      ).toBe("unavailable");
    }
  });
  it("font-only合法override不改变色板/line，空override继承全部组件", async () => {
    let bytes = await addThemeOverride(
      await themeFixture(),
      "master",
      themeComponents({ font: "Times New Roman" }),
    );
    bytes = await addThemeOverride(bytes, "slide", "");
    const { model, slide } = await load(bytes),
      resolved = theme(presentationThemeModel(model, slide), slide);
    expect(resolved.majorFont.latin).toBe("Times New Roman");
    expect((await nativeStyle(bytes)).borderColor).toBe("#336699");
    expect(resolved.lineStyles).toHaveLength(1);
    const root = modelPresentationTheme(model, slide).root!;
    expect(one(one(root, a, "themeElements")!, a, "fontScheme")).toBeDefined();
  });
  it("theme色板透明度无法由public ThemeData完整表示时整段明确拒绝", async () => {
    const component = themeComponents({ color: "AA6600" }).replace(
      '<a:accent1><a:srgbClr val="AA6600"/></a:accent1>',
      '<a:accent1><a:srgbClr val="AA6600"><a:alpha val="50000"/></a:srgbClr></a:accent1>',
    );
    const bytes = await addThemeOverride(
        await themeFixture(),
        "slide",
        component,
      ),
      { model, slide, table } = await load(bytes);
    await expect(nativeStyle(bytes)).rejects.toThrow("table theme color alpha");
    expect(
      readPresentationTableBorderStyle(table, full, model, slide).status,
    ).toBe("unavailable");
    expect(() => presentationThemeModel(model, slide)).toThrow(
      "table theme color alpha",
    );
  });
});
