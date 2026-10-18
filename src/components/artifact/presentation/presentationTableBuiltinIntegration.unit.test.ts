import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";
import {
  importPresentationDocument,
  renderPresentationSlide,
  type PresentationSnapshot,
} from "./presentationDocument";
import { hashFileBytes } from "@/lib/artifact/fileRevision";
import {
  readPresentationTableBorderStyle,
  tableBorderStyle,
} from "./presentationTableBorderStyle";
import { presentationTableBuiltinStyleIds } from "./presentationTableBuiltinStyle";
import { tableStyleContext } from "./presentationTableStyle";
import { tableGrid } from "./presentationTableGrid";
import { editPresentationTablePackage } from "./presentationTablePackage";
import { readStructure } from "./presentationTableStructurePackage.testFixtures";
import {
  slideId,
  tableId,
  tableSlidePath,
  tableFixture,
} from "./presentationTablePackage.testFixtures";
import {
  formatStylePath,
  formatThemePath,
} from "./presentationTableFormatPackage.testFixtures";
import {
  addThemeOverride,
  themeComponents,
} from "./presentationTableTheme.testFixtures";
import {
  builtinIntegrationBase,
  builtinIntegrationFixture,
  builtinStyleId,
  unknownStyleId,
} from "./presentationTableBuiltinIntegration.testFixtures";
import { presentationThemeModel } from "./presentationTableTheme";

const full = { row: 0, column: 0, rowCount: 4, columnCount: 5 };
let base: Uint8Array;
beforeAll(async () => {
  base = await builtinIntegrationBase();
});

async function load(bytes: Uint8Array) {
  return importPresentationDocument(bytes, new AbortController().signal);
}
function snapshotStyle(snapshot: PresentationSnapshot, range = full) {
  const slide = snapshot.model.slides[0],
    table = slide.nodes.find((node) => node.id === tableId);
  if (table?.nodeType !== "table") throw Error("Missing table");
  return readPresentationTableBorderStyle(table, range, snapshot.model, slide);
}
async function packageStyle(bytes: Uint8Array) {
  const value = await readStructure(bytes);
  return tableBorderStyle(
    tableGrid(value.xml, tableId),
    full,
    await tableStyleContext(value.zip, tableSlidePath, value.xml),
  );
}
async function render(snapshot: PresentationSnapshot, cellCount = 20) {
  const styles = snapshot.model.tableStyles,
    themes = snapshot.model.themes,
    masterToTheme = snapshot.model.masterToTheme;
  const sourceStyles = styles?.element?.outerHTML;
  const handle = renderPresentationSlide(snapshot, 0);
  try {
    await handle.ready;
    const cells = Array.from(handle.element.querySelectorAll("td"));
    expect(cells).toHaveLength(cellCount);
    return cells.map((cell) => ({
      text: cell.textContent,
      css: cell.getAttribute("style"),
      html: cell.innerHTML,
    }));
  } finally {
    handle.dispose();
    expect(snapshot.model.tableStyles).toBe(styles);
    expect(snapshot.model.tableStyles?.element?.outerHTML).toBe(sourceStyles);
    expect(snapshot.model.themes).toBe(themes);
    expect(snapshot.model.masterToTheme).toBe(masterToTheme);
  }
}

describe("builtin production codec/snapshot/render同源接线", () => {
  it.each(
    presentationTableBuiltinStyleIds.map((id, index) => ({
      id,
      mode: index % 2 ? ("empty" as const) : ("missing" as const),
    })),
  )(
    "$id ($mode) 原包reader、同步snapshot和真实渲染与显式定义一致",
    async ({ id, mode }) => {
      const input = await builtinIntegrationFixture(base, id, mode),
        original = input.slice(),
        snapshot = await load(input),
        explicit = await load(
          await builtinIntegrationFixture(base, id, "builtin"),
        );
      const native = await packageStyle(input);
      expect(snapshotStyle(snapshot)).toEqual({
        status: "ready",
        style: native,
      });
      expect(await packageStyle(explicit.sourceBytes)).toEqual(native);
      expect(await render(snapshot)).toEqual(await render(explicit));
      expect(snapshot.sourceBytes).toEqual(original);
      expect(snapshot.sourceSha256).toBe(await hashFileBytes(original));
      expect(input).toEqual(original);
    },
  );

  it.each(["missing", "empty"] as const)(
    "%s样式列表经真实import/build补定义，保存重开不写入builtin原件",
    async (mode) => {
      const input = await builtinIntegrationFixture(base, builtinStyleId, mode),
        snapshot = await load(input),
        before = await packageStyle(input);
      expect(snapshotStyle(snapshot)).toEqual({
        status: "ready",
        style: before,
      });
      expect(await render(snapshot)).toEqual(
        await render(
          await load(
            await builtinIntegrationFixture(base, builtinStyleId, "builtin"),
          ),
        ),
      );
      const output = await editPresentationTablePackage(input, [
        {
          slideId,
          tableId,
          type: "set-border-preset",
          range: full,
          preset: "all",
        },
      ]);
      const reopened = await load(output),
        native = await packageStyle(output);
      expect(snapshotStyle(reopened)).toEqual({
        status: "ready",
        style: native,
      });
      expect(native.borderEdges).toBe("all");
      expect(
        (await render(reopened)).every((cell) => cell.css?.includes("border")),
      ).toBe(true);
      const a = await JSZip.loadAsync(input),
        b = await JSZip.loadAsync(output);
      expect(Object.keys(b.files)).toEqual(Object.keys(a.files));
      for (const path of Object.keys(a.files))
        if (!a.files[path].dir && path !== tableSlidePath)
          expect(await b.file(path)!.async("uint8array"), path).toEqual(
            await a.file(path)!.async("uint8array"),
          );
      expect(!!b.file(formatStylePath)).toBe(mode === "empty");
    },
  );

  it("builtin现有边界格式编辑写回直接line，codec/snapshot/render重开保持宽度和颜色", async () => {
    const input = await builtinIntegrationFixture(base),
      output = await editPresentationTablePackage(input, [
        {
          slideId,
          tableId,
          type: "format-existing-borders",
          range: full,
          width: 7,
          color: "#123456",
        },
      ]),
      snapshot = await load(output),
      native = await packageStyle(output);
    expect(native.borderWidth).toBe(7);
    expect(native.borderColor).toBe("#123456");
    expect(snapshotStyle(snapshot)).toEqual({ status: "ready", style: native });
    const cells = await render(snapshot);
    expect(cells.some((cell) => cell.css?.includes("7px solid #123456"))).toBe(
      true,
    );
  });

  it("builtin ID存在custom定义时三个入口始终采用custom，大小写别名只进入渲染副本", async () => {
    const input = await builtinIntegrationFixture(
        base,
        builtinStyleId,
        "custom",
        { definitionId: builtinStyleId.toLowerCase() },
      ),
      snapshot = await load(input),
      native = await packageStyle(input);
    expect(native.borderEdges).toBe("all");
    expect(native.borderWidth).toBeUndefined();
    expect(snapshotStyle(snapshot)).toEqual({ status: "ready", style: native });
    const cells = await render(snapshot);
    expect(cells[0].css).toContain("2px solid #336699");
    expect(cells[0].css).toContain("4px dashed #ABCDEF");
  });

  it("builtin按规范化ID查找，renderer用原ID匹配同一定义且不修改共享样式", async () => {
    const lower = await load(
        await builtinIntegrationFixture(base, builtinStyleId.toLowerCase()),
      ),
      upper = await load(await builtinIntegrationFixture(base));
    expect(snapshotStyle(lower)).toEqual(snapshotStyle(upper));
    expect(await render(lower)).toEqual(await render(upper));
  });

  it("builtin和themeOverride共用真实主题，codec/snapshot/render不回退base主题", async () => {
    const source = await builtinIntegrationFixture(base),
      input = await addThemeOverride(
        source,
        "slide",
        themeComponents({ color: "CC2244" }),
      ),
      explicit = await addThemeOverride(
        await builtinIntegrationFixture(base, builtinStyleId, "builtin"),
        "slide",
        themeComponents({ color: "CC2244" }),
      ),
      snapshot = await load(input),
      native = await packageStyle(input);
    expect(snapshotStyle(snapshot)).toEqual({ status: "ready", style: native });
    expect(await render(snapshot)).toEqual(await render(await load(explicit)));
    expect(
      (await render(snapshot)).some((cell) =>
        cell.css?.includes("204, 34, 68"),
      ),
    ).toBe(true);
  });

  it("真实HSL色板从登记源XML解析，即使public ThemeData缺颜色也不误判无主题", async () => {
    const zip = await JSZip.loadAsync(await builtinIntegrationFixture(base));
    zip.file(
      formatThemePath,
      (await zip.file(formatThemePath)!.async("string")).replace(
        /<a:srgbClr val="[A-F0-9]+"\/>/g,
        '<a:hslClr hue="0" sat="0" lum="50000"/>',
      ),
    );
    const input = await zip.generateAsync({ type: "uint8array" }),
      snapshot = await load(input),
      native = await packageStyle(input);
    expect([...snapshot.model.themes.values()][0].colorScheme.size).toBe(0);
    expect(snapshotStyle(snapshot)).toEqual({ status: "ready", style: native });
    expect(
      (await render(snapshot)).some((cell) => cell.css?.includes("#808080")),
    ).toBe(true);
  });

  it.each(["noTheme", "unknown"] as const)(
    "%s的样式authoring明确unavailable，预览保留原renderer且不注入主题或样式",
    async (kind) => {
      const input = await builtinIntegrationFixture(
          base,
          kind === "unknown" ? unknownStyleId : builtinStyleId,
          "missing",
          { noTheme: kind === "noTheme" },
        ),
        original = input.slice(),
        snapshot = await load(input);
      expect(snapshotStyle(snapshot).status).toBe("unavailable");
      await expect(packageStyle(input)).rejects.toThrow(
        "unresolved table border style",
      );
      await expect(
        editPresentationTablePackage(input, [
          {
            slideId,
            tableId,
            type: "set-border-preset",
            range: full,
            preset: "all",
          },
        ]),
      ).rejects.toThrow("unresolved table border style");
      expect(
        presentationThemeModel(snapshot.model, snapshot.model.slides[0]),
      ).toBe(snapshot.model);
      await render(snapshot);
      expect(input).toEqual(original);
      expect(snapshot.sourceBytes).toEqual(original);
      expect(snapshot.sourceSha256).toBe(await hashFileBytes(original));
    },
  );

  it("原无theme和styleLst的2×3 fixture仍可预览和基础cell编辑，样式authoring保持unavailable", async () => {
    const input = await tableFixture(),
      original = input.slice(),
      snapshot = await load(input);
    expect(snapshot.model.themes.size).toBe(0);
    expect(snapshot.model.tableStyles).toBeUndefined();
    const range = { row: 0, column: 0, rowCount: 2, columnCount: 3 };
    expect(snapshotStyle(snapshot, range).status).toBe("unavailable");
    expect(
      presentationThemeModel(snapshot.model, snapshot.model.slides[0]),
    ).toBe(snapshot.model);
    expect(await render(snapshot, 6)).toHaveLength(6);
    const output = await editPresentationTablePackage(input, [
      {
        slideId,
        tableId,
        type: "set-cell-text",
        row: 0,
        column: 1,
        text: "基础编辑仍可用",
      },
    ]);
    const reopened = await load(output),
      cells = await render(reopened, 6);
    expect(cells[1].text).toBe("基础编辑仍可用");
    expect(reopened.model.themes.size).toBe(0);
    expect(reopened.model.tableStyles).toBeUndefined();
    expect(snapshotStyle(reopened, range).status).toBe("unavailable");
    expect(input).toEqual(original);
    expect(snapshot.sourceSha256).toBe(await hashFileBytes(original));
  });

  it("无主题的显式custom literal定义继续可读可渲染，不触发builtin拒绝", async () => {
    const zip = await JSZip.loadAsync(
      await builtinIntegrationFixture(base, builtinStyleId, "custom", {
        noTheme: true,
      }),
    );
    zip.file(
      formatStylePath,
      (await zip.file(formatStylePath)!.async("string")).replaceAll(
        '<a:schemeClr val="accent1"/>',
        '<a:srgbClr val="336699"/>',
      ),
    );
    const input = await zip.generateAsync({ type: "uint8array" }),
      snapshot = await load(input),
      native = await packageStyle(input);
    expect(snapshotStyle(snapshot)).toEqual({ status: "ready", style: native });
    expect(
      presentationThemeModel(snapshot.model, snapshot.model.slides[0]),
    ).toBe(snapshot.model);
    expect((await render(snapshot))[0].css).toContain("2px solid #336699");
  });
});
