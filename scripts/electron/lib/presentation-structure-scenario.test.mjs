import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { buildPresentation, parseZip } from "@aiden0z/pptx-renderer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  editPresentationSlidesPackage,
  readPresentationSlideTemplates,
} from "../../../src/components/artifact/presentation/presentationSlidesPackage";
import { writePresentationStructureFixture } from "./presentation-structure-scenario.mjs";

const fixturePath =
  "src/components/artifact/presentation/__fixtures__/review.pptx";
const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rel = "http://schemas.openxmlformats.org/package/2006/relationships";
const ct = "http://schemas.openxmlformats.org/package/2006/content-types";
const titleLayout = "ppt/slideLayouts/slideLayout1.xml";
const blankLayout = "ppt/slideLayouts/slideLayout2.xml";
const masterPath = "ppt/slideMasters/slideMaster1.xml";
const themePath = "ppt/theme/theme1.xml";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function xml(zip, part) {
  const entry = zip.file(part);
  expect(entry, part).not.toBeNull();
  const document = new DOMParser().parseFromString(
    await entry.async("string"),
    "application/xml",
  );
  expect(
    document.getElementsByTagNameNS("*", "parsererror"),
    part,
  ).toHaveLength(0);
  return document;
}

async function relations(zip, part) {
  const document = await xml(zip, part);
  expect(document.documentElement.namespaceURI).toBe(rel);
  return Array.from(document.documentElement.children, (node) => ({
    id: node.getAttribute("Id"),
    type: node.getAttribute("Type"),
    target: node.getAttribute("Target"),
    mode: node.getAttribute("TargetMode"),
  }));
}

describe("真实 Electron 幻灯片结构场景的 PPTX 夹具", () => {
  let directory, filePath, manifest, bytes, original, zip;
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "lime-pptx-structure-"));
    filePath = path.join(directory, "Review.pptx");
    manifest = await writePresentationStructureFixture(filePath);
    bytes = fs.readFileSync(filePath);
    original = await JSZip.loadAsync(fs.readFileSync(fixturePath));
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  });
  afterAll(() => {
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  it("原三页 identity、文字和源 XML 字节不变，原外链仍只作为包数据", async () => {
    expect(manifest.sha256).toBe(digest(bytes));
    expect(manifest.slideIds).toEqual(["512", "900", "300"]);
    const presentation = await xml(zip, "ppt/presentation.xml");
    expect(
      Array.from(presentation.getElementsByTagNameNS(p, "sldId"), (node) =>
        node.getAttribute("id"),
      ),
    ).toEqual(["512", "900", "300"]);
    for (let index = 1; index <= 3; index++) {
      const part = `ppt/slides/slide${index}.xml`;
      expect(await zip.file(part).async("uint8array")).toEqual(
        await original.file(part).async("uint8array"),
      );
      const slide = await xml(zip, part);
      expect(
        Array.from(
          slide.getElementsByTagNameNS(a, "t"),
          (node) => node.textContent,
        ).join("\n"),
      ).toContain(`SLIDE_PREVIEW_0${index}`);
    }
    const changedParts = new Set([
      "[Content_Types].xml",
      "ppt/presentation.xml",
      "ppt/_rels/presentation.xml.rels",
      ...[1, 2, 3].map((index) => `ppt/slides/_rels/slide${index}.xml.rels`),
    ]);
    for (const [name, entry] of Object.entries(original.files)) {
      if (!entry.dir && !changedParts.has(name))
        expect(await zip.file(name).async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
    }
    expect(
      await relations(zip, "ppt/slides/_rels/slide1.xml.rels"),
    ).toContainEqual({
      id: "rExternal",
      type: `${r}/hyperlink`,
      target: "https://example.invalid/never-fetch",
      mode: "External",
    });
    expect(fs.readFileSync(path.join(directory, "Broken.pptx"), "utf8")).toBe(
      "invalid presentation",
    );
  });

  it("使用真实 title/blank layout、master 和 theme 关系及规范内容类型", async () => {
    const presentation = await xml(zip, "ppt/presentation.xml");
    expect(
      Array.from(
        presentation.documentElement.children,
        (node) => node.localName,
      ),
    ).toEqual(["sldMasterIdLst", "sldIdLst", "sldSz", "notesSz"]);
    const masterId = presentation.getElementsByTagNameNS(p, "sldMasterId")[0];
    expect(masterId.getAttributeNS(r, "id")).toBe("structureMaster");
    expect(Number(masterId.getAttribute("id"))).toBe(2147483648);
    expect(
      await relations(zip, "ppt/_rels/presentation.xml.rels"),
    ).toContainEqual({
      id: "structureMaster",
      type: `${r}/slideMaster`,
      target: "slideMasters/slideMaster1.xml",
      mode: null,
    });
    expect(
      await relations(zip, "ppt/slideMasters/_rels/slideMaster1.xml.rels"),
    ).toEqual([
      {
        id: "title",
        type: `${r}/slideLayout`,
        target: "../slideLayouts/slideLayout1.xml",
        mode: null,
      },
      {
        id: "blank",
        type: `${r}/slideLayout`,
        target: "../slideLayouts/slideLayout2.xml",
        mode: null,
      },
      {
        id: "theme",
        type: `${r}/theme`,
        target: "../theme/theme1.xml",
        mode: null,
      },
    ]);
    for (let index = 1; index <= 2; index++)
      expect(
        await relations(
          zip,
          `ppt/slideLayouts/_rels/slideLayout${index}.xml.rels`,
        ),
      ).toEqual([
        {
          id: "master",
          type: `${r}/slideMaster`,
          target: "../slideMasters/slideMaster1.xml",
          mode: null,
        },
      ]);
    for (let index = 1; index <= 3; index++) {
      const layouts = (
        await relations(zip, `ppt/slides/_rels/slide${index}.xml.rels`)
      ).filter((row) => row.type === `${r}/slideLayout`);
      expect(layouts).toEqual([
        {
          id: "structureLayout",
          type: `${r}/slideLayout`,
          target: `../slideLayouts/slideLayout${index === 1 ? 1 : 2}.xml`,
          mode: null,
        },
      ]);
    }
    const title = await xml(zip, titleLayout),
      blank = await xml(zip, blankLayout);
    expect(title.documentElement.getAttribute("type")).toBe("title");
    expect(title.getElementsByTagNameNS(p, "sp")).toHaveLength(1);
    expect(title.getElementsByTagNameNS(p, "ph")[0].getAttribute("type")).toBe(
      "title",
    );
    expect(blank.documentElement.getAttribute("type")).toBe("blank");
    expect(blank.getElementsByTagNameNS(p, "sp")).toHaveLength(0);
    const theme = await xml(zip, themePath);
    expect(theme.documentElement.namespaceURI).toBe(a);
    expect(
      theme.getElementsByTagNameNS(a, "clrScheme")[0].children,
    ).toHaveLength(12);
    expect(
      theme.getElementsByTagNameNS(a, "fillStyleLst")[0].children,
    ).toHaveLength(3);
    expect(
      theme.getElementsByTagNameNS(a, "lnStyleLst")[0].children,
    ).toHaveLength(3);
    const types = await xml(zip, "[Content_Types].xml");
    const overrides = new Map(
      Array.from(types.getElementsByTagNameNS(ct, "Override"), (node) => [
        node.getAttribute("PartName"),
        node.getAttribute("ContentType"),
      ]),
    );
    for (const [part, kind] of [
      [titleLayout, "presentationml.slideLayout"],
      [blankLayout, "presentationml.slideLayout"],
      [masterPath, "presentationml.slideMaster"],
      [themePath, "theme"],
    ])
      expect(overrides.get(`/${part}`)).toBe(
        `application/vnd.openxmlformats-officedocument.${kind}+xml`,
      );
  });

  it("当前真实 PPTX 解析器能解析完整 slide → layout → master → theme 链", async () => {
    const parsed = await parseZip(Uint8Array.from(bytes).buffer);
    const model = buildPresentation(parsed);
    expect(model.slides.map((slide) => slide.slidePath)).toEqual([
      "ppt/slides/slide1.xml",
      "ppt/slides/slide2.xml",
      "ppt/slides/slide3.xml",
    ]);
    expect(model.slides.map((slide) => slide.layoutIndex)).toEqual([
      titleLayout,
      blankLayout,
      blankLayout,
    ]);
    expect(model.layouts.size).toBe(2);
    expect(model.masters.size).toBe(1);
    expect(model.themes.size).toBe(1);
    expect(model.layoutToMaster.get(titleLayout)).toBe(masterPath);
    expect(model.layoutToMaster.get(blankLayout)).toBe(masterPath);
    expect(model.masterToTheme.get(masterPath)).toBe(themePath);
    expect(model.slides.every((slide) => slide.nodes.length > 0)).toBe(true);
    expect(model.width).toBeGreaterThan(0);
    expect(model.height).toBeGreaterThan(0);
  });

  it("同一生成夹具可由生产 codec 继承 title 和显式新增 blank 后重新解析", async () => {
    expect(await readPresentationSlideTemplates(new Uint8Array(bytes))).toEqual(
      [
        {
          id: titleLayout,
          name: "Structure title",
          masterName: "Structure master",
        },
        {
          id: blankLayout,
          name: "Structure blank",
          masterName: "Structure master",
        },
      ],
    );
    const title = await editPresentationSlidesPackage(new Uint8Array(bytes), [
      { type: "add", afterSlideId: "512" },
    ]);
    const blank = await editPresentationSlidesPackage(title.bytes, [
      {
        type: "add",
        afterSlideId: title.createdSlideIds[0],
        layoutId: blankLayout,
      },
    ]);
    expect(blank.slideIds).toEqual([
      "512",
      title.createdSlideIds[0],
      blank.createdSlideIds[0],
      "900",
      "300",
    ]);
    const model = buildPresentation(await parseZip(blank.bytes.slice().buffer));
    expect(model.slides).toHaveLength(5);
    expect(model.slides[1].layoutIndex).toBe(titleLayout);
    expect(model.slides[1].nodes).toHaveLength(1);
    expect(model.slides[2].layoutIndex).toBe(blankLayout);
    expect(model.slides[2].nodes).toHaveLength(0);
  });
});
