import { describe, expect, it } from "vitest";
import { a, p, one } from "./presentationPackageXml";
import {
  readPresentationTextBlock,
  registerPresentationTextSources,
} from "./presentationTextDocument";
import { presentationTextContent } from "./presentationTextRangeXml";
import {
  modifyTextPackage,
  serializeTextBody,
  textPackageFixture,
  textRelationsPath,
  textSnapshot,
} from "./presentationTextDocument.testFixtures";

describe("原始 OOXML text source registration", () => {
  it("shape与真实table cell按稳定blockId读取，保留run/paragraph/list/link/unknown且草稿互相隔离", async () => {
    const { snapshot } = await textSnapshot(await textPackageFixture());
    const shape = readPresentationTextBlock(snapshot, "512", "2")!,
      cell = readPresentationTextBlock(snapshot, "512", "7", {
        row: 0,
        column: 1,
      })!;
    expect([shape.blockId, cell.blockId]).toEqual(["512:2", "512:7:0:1"]);
    expect(shape.body.namespaceURI).toBe(p);
    expect(cell.body.namespaceURI).toBe(a);
    expect(shape.body.lookupNamespaceURI("r")).toBe(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    );
    expect(presentationTextContent(shape.body)).toBe(
      "Alpha 中😀文\ntail\nSecond 👩‍💻IME\nThird",
    );
    expect(serializeTextBody(shape.body)).toContain('marL="321"');
    expect(shape.body.getElementsByTagNameNS("urn:keep", "run")).toHaveLength(
      1,
    );
    expect(shape.resolveHyperlink("rLink")).toBe(
      "https://example.invalid/rich",
    );
    expect(cell.resolveHyperlink("rOther")).toBe("mailto:rich@example.invalid");
    shape.body.getElementsByTagNameNS(a, "t")[0].textContent = "draft only";
    expect(
      readPresentationTextBlock(
        snapshot,
        "512",
        "2",
      )!.body.getElementsByTagNameNS(a, "t")[0].textContent,
    ).toBe("Alpha ");
    expect(cell.body.getElementsByTagNameNS(a, "t")[0].textContent).toBe(
      "Alpha ",
    );
    expect(
      readPresentationTextBlock(
        { ...snapshot, sourceSha256: "e".repeat(64) },
        "512",
        "2",
      )!.blockId,
    ).toBe("512:2");
  });

  it("registry只保留原始字符串，renderer model及parseZip map后续变化不污染编辑原文", async () => {
    const { snapshot, files } = await textSnapshot(await textPackageFixture());
    snapshot.model.slides[0].nodes = [];
    files.slides.clear();
    files.slideRels.clear();
    const block = readPresentationTextBlock(snapshot, "512", "2")!;
    expect(presentationTextContent(block.body)).toContain("Alpha 中😀文");
    expect(block.resolveHyperlink("rLink")).toBe(
      "https://example.invalid/rich",
    );
  });

  it("没有注册的snapshot不回退renderer source；相同来源注册幂等、不同来源绑定拒绝", async () => {
    const { snapshot, files } = await textSnapshot(
      await textPackageFixture(),
      false,
    );
    expect(readPresentationTextBlock(snapshot, "512", "2")).toBeUndefined();
    registerPresentationTextSources(snapshot, files);
    registerPresentationTextSources(snapshot, files);
    files.slides.set(
      "ppt/slides/slide1.xml",
      files.slides.get("ppt/slides/slide1.xml")!.replace("Alpha ", "changed"),
    );
    expect(() => registerPresentationTextSources(snapshot, files)).toThrow(
      "already registered",
    );
    expect(
      presentationTextContent(
        readPresentationTextBlock(snapshot, "512", "2")!.body,
      ),
    ).toContain("Alpha ");
  });

  it("slide关系重命名保持同一identity；无效inventory和缺失source不注册", async () => {
    const bytes = await modifyTextPackage(
      await textPackageFixture(),
      async (_document, zip) => {
        zip.file(
          "ppt/slides/renamed.xml",
          await zip.file("ppt/slides/slide2.xml")!.async("string"),
        );
        zip.remove("ppt/slides/slide2.xml");
        const rel = "ppt/_rels/presentation.xml.rels";
        zip.file(
          rel,
          (await zip.file(rel)!.async("string")).replace(
            'Target="slides/slide2.xml"',
            'Target="slides/renamed.xml"',
          ),
        );
      },
    );
    const { snapshot, files } = await textSnapshot(bytes);
    expect(
      presentationTextContent(
        readPresentationTextBlock(snapshot, "900", "2")!.body,
      ),
    ).toBe("SLIDE_PREVIEW_02");
    expect(() =>
      registerPresentationTextSources(
        { ...snapshot, slideIds: ["900", "512", "300"] },
        files,
      ),
    ).toThrow("inventory");
    files.slides.delete("ppt/slides/renamed.xml");
    expect(() =>
      registerPresentationTextSources({ ...snapshot }, files),
    ).toThrow("missing text slide source");
  });

  it("merged anchor可读；continuation、错误类型、缺失对象与非法地址无可编辑block", async () => {
    const { snapshot } = await textSnapshot(await textPackageFixture(true));
    expect(
      readPresentationTextBlock(snapshot, "512", "7", { row: 0, column: 0 }),
    ).toBeDefined();
    for (const cell of [
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
      { row: -1, column: 0 },
      { row: 0.5, column: 0 },
      { row: 999, column: 0 },
    ])
      expect(
        readPresentationTextBlock(snapshot, "512", "7", cell),
      ).toBeUndefined();
    expect(readPresentationTextBlock(snapshot, "512", "7")).toBeUndefined();
    expect(
      readPresentationTextBlock(snapshot, "512", "2", { row: 0, column: 0 }),
    ).toBeUndefined();
    expect(readPresentationTextBlock(snapshot, "512", "999")).toBeUndefined();
    expect(readPresentationTextBlock(snapshot, "0512", "2")).toBeUndefined();
  });

  it.each([
    '<a:fld id="field"><a:t>1</a:t></a:fld>',
    '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/>',
  ])("field/math明确不进入编辑：%s", async (extra) => {
    const bytes = await modifyTextPackage(
      await textPackageFixture(),
      (document) => {
        const paragraph = document.getElementsByTagNameNS(a, "p")[0];
        const source = new DOMParser().parseFromString(
          `<root xmlns:a="${a}">${extra}</root>`,
          "application/xml",
        );
        paragraph.append(
          document.importNode(source.documentElement.firstElementChild!, true),
        );
      },
    );
    const { snapshot } = await textSnapshot(bytes);
    expect(readPresentationTextBlock(snapshot, "512", "2")).toBeUndefined();
    expect(
      readPresentationTextBlock(snapshot, "512", "7", { row: 0, column: 0 }),
    ).toBeDefined();
  });

  it("仅从同一原始rel解析http/https/mailto，未知或不安全scheme不提供copy URL", async () => {
    const bytes = await modifyTextPackage(
      await textPackageFixture(),
      async (_document, zip) => {
        zip.file(
          textRelationsPath,
          (await zip.file(textRelationsPath)!.async("string")).replace(
            'Target="https://example.invalid/rich"',
            'Target="javascript:alert(1)"',
          ),
        );
      },
    );
    const { snapshot } = await textSnapshot(bytes),
      block = readPresentationTextBlock(snapshot, "512", "2")!;
    expect(block.resolveHyperlink("rLink")).toBeUndefined();
    expect(block.resolveHyperlink("missing")).toBeUndefined();
    expect(block.resolveHyperlink("rOther")).toBe(
      "mailto:rich@example.invalid",
    );
    expect(one(block.body, a, "bodyPr")!.getAttribute("wrap")).toBe("square");
  });
});
