import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  editPresentationPackage,
  type PresentationElementEdit,
} from "./presentationPackage";

const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
const original = () =>
  new Uint8Array(
    readFileSync(
      "src/components/artifact/presentation/__fixtures__/review.pptx",
    ),
  );
const edit = { slideId: "512", elementId: "2" };
const slidePath = "ppt/slides/slide1.xml";
const presentationPath = "ppt/presentation.xml";
const relationsPath = "ppt/_rels/presentation.xml.rels";

function xml(source: string): Document {
  return new DOMParser().parseFromString(source, "application/xml");
}

async function part(bytes: Uint8Array, path = slidePath): Promise<Document> {
  return xml(await (await JSZip.loadAsync(bytes)).file(path)!.async("string"));
}

async function modify(
  path: string,
  change: (source: string) => string,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(original());
  zip.file(path, change(await zip.file(path)!.async("string")));
  return zip.generateAsync({ type: "uint8array" });
}

function shapeDocument(document: Document, id = "2"): Element {
  return Array.from(document.getElementsByTagNameNS(p, "sp")).find(
    (shape) =>
      shape.getElementsByTagNameNS(p, "cNvPr")[0]?.getAttribute("id") === id,
  )!;
}

function first(
  element: Document | Element,
  namespace: string,
  name: string,
): Element {
  return element.getElementsByTagNameNS(namespace, name)[0];
}

async function withShapes(shapes: string): Promise<Uint8Array> {
  return modify(slidePath, (source) =>
    source.replace("</p:spTree>", `${shapes}</p:spTree>`),
  );
}

const extraShapes = `<p:pic><p:nvPicPr><p:cNvPr id="3" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="image"/></p:blipFill><p:spPr><a:xfrm rot="60000" flipH="1"><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm></p:spPr></p:pic><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm rot="120000"><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></p:xfrm><a:graphic><a:graphicData uri="urn:unknown"><a:tbl/></a:graphicData></a:graphic></p:graphicFrame><p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="6" name="Grouped"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp></p:grpSp>`;

describe("PPTX 原包顶层对象定点编辑", () => {
  it("真实包编辑文本、五项样式及位置，保留未编辑成员和未知元数据", async () => {
    const input = await JSZip.loadAsync(
      await modify(slidePath, (source) =>
        source
          .replace(
            "<a:bodyPr/>",
            '<a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr>',
          )
          .replace(
            "<a:lstStyle/>",
            '<a:lstStyle><a:lvl1pPr marL="42"/></a:lstStyle>',
          )
          .replace("<a:p>", '<a:p><a:pPr algn="ctr" custom="keep"/>')
          .replace(
            "<p:spPr><a:xfrm>",
            '<p:spPr><a:xfrm rot="120000" flipV="1" custom="keep">',
          )
          .replace('<a:rPr lang="en-US"', '<a:rPr dirty="0" lang="en-US"'),
      ),
    );
    input.file("ppt/media/retained.bin", new Uint8Array([0, 255, 19, 128]));
    input.file(
      "customXml/retained.xml",
      '<unknown xmlns="urn:keep">unchanged</unknown>',
    );
    const bytes = await input.generateAsync({ type: "uint8array" });
    const output = await editPresentationPackage(bytes, [
      {
        ...edit,
        text: '  中文 <tag> & "引号"\r\n第二段\n',
        frame: { x: -3.5, y: 20, width: 400, height: 100 },
        style: {
          fontSize: 24,
          bold: true,
          italic: false,
          color: "#aBcDeF",
          fillColor: "123456",
        },
      },
    ]);
    const result = await JSZip.loadAsync(output);
    expect(Object.keys(result.files).sort()).toEqual(
      Object.keys(input.files).sort(),
    );
    for (const [name, entry] of Object.entries(input.files)) {
      if (!entry.dir && name !== slidePath)
        expect(await result.file(name)!.async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
    }
    const target = shapeDocument(await part(output));
    expect(
      Array.from(
        target.getElementsByTagNameNS(a, "t"),
        (node) => node.textContent,
      ),
    ).toEqual(['  中文 <tag> & "引号"', "第二段", ""]);
    expect(first(target, a, "bodyPr").getAttribute("wrap")).toBe("square");
    expect(first(target, a, "lvl1pPr").getAttribute("marL")).toBe("42");
    expect(
      Array.from(target.getElementsByTagNameNS(a, "pPr"), (node) =>
        node.getAttribute("custom"),
      ),
    ).toEqual(["keep", "keep", "keep"]);
    for (const properties of Array.from(
      target.getElementsByTagNameNS(a, "rPr"),
    )) {
      expect([
        properties.getAttribute("sz"),
        properties.getAttribute("b"),
        properties.getAttribute("i"),
      ]).toEqual(["1800", "1", "0"]);
      expect(properties.getAttribute("dirty")).toBe("0");
      expect(first(properties, a, "srgbClr").getAttribute("val")).toBe(
        "ABCDEF",
      );
      expect(first(properties, a, "hlinkClick")).toBeDefined();
    }
    const transform = first(target, a, "xfrm");
    expect([
      transform.getAttribute("rot"),
      transform.getAttribute("flipV"),
      transform.getAttribute("custom"),
    ]).toEqual(["120000", "1", "keep"]);
    expect([
      first(transform, a, "off").getAttribute("x"),
      first(transform, a, "off").getAttribute("y"),
    ]).toEqual(["-33337", "190500"]);
    expect([
      first(transform, a, "ext").getAttribute("cx"),
      first(transform, a, "ext").getAttribute("cy"),
    ]).toEqual(["3810000", "952500"]);
    expect(
      first(first(target, p, "spPr"), a, "srgbClr").getAttribute("val"),
    ).toBe("123456");
  });

  it("slideId 经关系定位，重排页序和重命名文件后仍只改同一源页", async () => {
    const zip = await JSZip.loadAsync(original());
    const slide = await zip.file(slidePath)!.async("string");
    zip.remove(slidePath);
    zip.file("ppt/alternate/source.xml", slide);
    zip.file(
      relationsPath,
      (await zip.file(relationsPath)!.async("string")).replace(
        'Target="slides/slide1.xml"',
        'Target="/ppt/alternate/source.xml"',
      ),
    );
    zip.file(
      presentationPath,
      (await zip.file(presentationPath)!.async("string")).replace(
        '<p:sldId id="512" r:id="rId1"/><p:sldId id="900" r:id="rId2"/>',
        '<p:sldId id="900" r:id="rId2"/><p:sldId id="512" r:id="rId1"/>',
      ),
    );
    const output = await editPresentationPackage(
      await zip.generateAsync({ type: "uint8array" }),
      [{ ...edit, text: "Identity retained" }],
    );
    expect(
      first(await part(output, "ppt/alternate/source.xml"), a, "t").textContent,
    ).toBe("Identity retained");
    expect(
      first(await part(output, "ppt/slides/slide2.xml"), a, "t").textContent,
    ).toBe("SLIDE_PREVIEW_02");
    expect((await JSZip.loadAsync(output)).file(slidePath)).toBeNull();
  });

  it("图像与graphicFrame可移位，保留原旋转、翻转、表格和非目标group", async () => {
    const bytes = await withShapes(extraShapes);
    const output = await editPresentationPackage(bytes, [
      {
        ...edit,
        elementId: "3",
        frame: { x: 1, y: 2, width: 3, height: 4 },
        style: {},
      },
      { ...edit, elementId: "4", frame: { x: 5, y: 6, width: 7, height: 8 } },
    ]);
    const after = await part(output);
    const picture = first(after, p, "pic"),
      graphic = first(after, p, "graphicFrame");
    expect(first(first(picture, a, "xfrm"), a, "off").getAttribute("x")).toBe(
      "9525",
    );
    expect(first(picture, a, "xfrm").getAttribute("flipH")).toBe("1");
    expect(first(graphic, p, "xfrm").getAttribute("rot")).toBe("120000");
    expect(first(first(graphic, p, "xfrm"), a, "ext").getAttribute("cy")).toBe(
      "76200",
    );
    expect(
      new XMLSerializer().serializeToString(first(after, p, "grpSp")),
    ).toBe(
      new XMLSerializer().serializeToString(
        first(await part(bytes), p, "grpSp"),
      ),
    );
    expect(first(graphic, a, "tbl")).toBeDefined();
  });

  it("删除只移除目标对象，不删除媒体、关系及其他shape；无修改保留原ZIP字节", async () => {
    const bytes = await withShapes(extraShapes);
    expect(await editPresentationPackage(bytes, [])).toEqual(bytes);
    const output = await editPresentationPackage(bytes, [
      { ...edit, elementId: "3", deleted: true },
    ]);
    const after = await part(output);
    expect(after.getElementsByTagNameNS(p, "pic")).toHaveLength(0);
    expect(after.getElementsByTagNameNS(p, "graphicFrame")).toHaveLength(1);
    const beforeZip = await JSZip.loadAsync(bytes),
      afterZip = await JSZip.loadAsync(output);
    for (const [name, entry] of Object.entries(beforeZip.files))
      if (!entry.dir && name !== slidePath)
        expect(await afterZip.file(name)!.async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
  });

  it("缺失transform时创建符合命名空间的off/ext并保留shape几何", async () => {
    const bytes = await modify(slidePath, (source) =>
      source.replace(/<a:xfrm>.*?<\/a:xfrm>/g, ""),
    );
    const output = await editPresentationPackage(bytes, [
      { ...edit, frame: { x: 1, y: 2, width: 3, height: 4 } },
    ]);
    const properties = first(shapeDocument(await part(output)), p, "spPr");
    expect(properties.firstElementChild!.localName).toBe("xfrm");
    expect(first(properties, a, "prstGeom").getAttribute("prst")).toBe("rect");
    expect(first(properties, a, "off").getAttribute("x")).toBe("9525");
  });

  it.each(["", "\n", "😀", "单行\r第二行"])(
    "文本 %j 保留空行和合法Unicode",
    async (text) => {
      const output = await editPresentationPackage(original(), [
        { ...edit, text },
      ]);
      expect(
        Array.from(
          (await part(output)).getElementsByTagNameNS(a, "t"),
          (node) => node.textContent,
        ),
      ).toEqual(text.split(/\r\n?|\n/));
    },
  );

  it("替换文本保留第一个run样式，单独改样式不扁平化混合run内容", async () => {
    const bytes = await modify(slidePath, (source) =>
      source.replace(
        "</a:r></a:p>",
        '</a:r><a:r><a:rPr lang="ja-JP" custom="retained"/><a:t>Second</a:t></a:r></a:p>',
      ),
    );
    const styled = await editPresentationPackage(bytes, [
      { ...edit, style: { bold: false } },
    ]);
    expect(
      Array.from(
        (await part(styled)).getElementsByTagNameNS(a, "t"),
        (node) => node.textContent,
      ),
    ).toEqual(["SLIDE_PREVIEW_01", "Second"]);
    expect(
      (await part(styled))
        .getElementsByTagNameNS(a, "rPr")[1]
        .getAttribute("custom"),
    ).toBe("retained");
    const replaced = await editPresentationPackage(bytes, [
      { ...edit, text: "One\nTwo" },
    ]);
    expect(
      Array.from(
        (await part(replaced)).getElementsByTagNameNS(a, "rPr"),
        (node) => node.getAttribute("lang"),
      ),
    ).toEqual(["en-US", "en-US"]);
  });
});

describe("PPTX 不支持内容与身份边界", () => {
  it.each(["3", "4", "5", "6", "100"])(
    "对象%s拒绝文字替换，不改group后代或其他对象类型",
    async (elementId) => {
      await expect(
        editPresentationPackage(await withShapes(extraShapes), [
          { ...edit, elementId, text: "Rejected" },
        ]),
      ).rejects.toThrow();
    },
  );

  it("graphicFrame拒绝fill与文本样式，picture拒绝文本样式", async () => {
    const bytes = await withShapes(extraShapes);
    for (const pending of [
      { elementId: "4", style: { fillColor: "123456" } },
      { elementId: "4", style: { color: "123456" } },
      { elementId: "3", style: { bold: true } },
    ])
      await expect(
        editPresentationPackage(bytes, [{ ...edit, ...pending }]),
      ).rejects.toThrow();
  });

  it.each([
    '<a:fld id="field" type="slidenum"><a:t>1</a:t></a:fld>',
    "<a:unknown><a:t>Unknown</a:t></a:unknown>",
    "<a:r><a:t>One</a:t><a:t>Two</a:t></a:r>",
    '<x:r xmlns:x="urn:foreign"><x:t>Foreign</x:t></x:r>',
  ])("复杂或歧义文本明确失败：%s", async (source) => {
    const bytes = await modify(slidePath, (value) =>
      value.replace("<a:p>", `<a:p>${source}`),
    );
    await expect(
      editPresentationPackage(bytes, [{ ...edit, text: "Must not discard" }]),
    ).rejects.toThrow();
    await expect(
      editPresentationPackage(bytes, [{ ...edit, style: { bold: true } }]),
    ).rejects.toThrow();
  });

  it.each([
    { text: "\u0000" },
    { text: "\u000b" },
    { text: "\ud800" },
    { text: "x".repeat(1024 * 1024 + 1) },
    { text: "中".repeat(350000) },
    { frame: { x: NaN, y: 0, width: 1, height: 1 } },
    { frame: { x: Infinity, y: 0, width: 1, height: 1 } },
    { frame: { x: 0, y: 0, width: 0, height: 1 } },
    { frame: { x: 0, y: 0, width: 1, height: -1 } },
    { frame: { x: Number.MAX_VALUE, y: 0, width: 1, height: 1 } },
    { style: { fontSize: 0 } },
    { style: { fontSize: Infinity } },
    { style: { fontSize: 100000 } },
    { style: { color: "red" } },
    { style: { fillColor: "#12345678" } },
    { slideId: "0512" },
    { elementId: "02" },
    { elementId: "4294967296" },
  ] satisfies Partial<PresentationElementEdit>[])(
    "拒绝非法输入 %#",
    async (invalid) => {
      await expect(
        editPresentationPackage(original(), [{ ...edit, ...invalid }]),
      ).rejects.toThrow();
    },
  );

  it("重复edit、shape id、slide id或relationship均明确失败", async () => {
    await expect(
      editPresentationPackage(original(), [edit, edit]),
    ).rejects.toThrow();
    for (const [path, change] of [
      [slidePath, (source: string) => source.replace('id="2"', 'id="1"')],
      [
        presentationPath,
        (source: string) => source.replace('id="900"', 'id="512"'),
      ],
      [
        relationsPath,
        (source: string) => source.replace('Id="rId2"', 'Id="rId1"'),
      ],
      [
        presentationPath,
        (source: string) => source.replace('id="512"', 'id="1"'),
      ],
      [
        presentationPath,
        (source: string) => source.replace('r:id="rId2"', 'r:id="rId1"'),
      ],
    ] as const)
      await expect(
        editPresentationPackage(await modify(path, change), [edit]),
      ).rejects.toThrow();
  });

  it.each([
    "../escape.xml",
    "../../escape.xml",
    "slides/../slide1.xml",
    "slides/%2e%2e/slide1.xml",
    "https://example.invalid/slide.xml",
    "//example.invalid/slide.xml",
    "slides\\slide1.xml",
    "slides/slide1.xml#fragment",
    "slides/slide1.xml?query",
    "",
  ])("拒绝外部或穿越slide关系 %s", async (target) => {
    const bytes = await modify(relationsPath, (source) =>
      source.replace('Target="slides/slide1.xml"', `Target="${target}"`),
    );
    await expect(editPresentationPackage(bytes, [edit])).rejects.toThrow();
  });

  it("拒绝外部TargetMode、错误namespace、非法XML和DTD/实体（含非目标成员）", async () => {
    for (const [path, change] of [
      [
        relationsPath,
        (source: string) =>
          source.replace('Id="rId1"', 'Id="rId1" TargetMode="external"'),
      ],
      [slidePath, (source: string) => source.replace(p, "urn:foreign")],
      [presentationPath, (source: string) => source.replace(p, "urn:foreign")],
      [
        relationsPath,
        (source: string) =>
          source.replace("package/2006/relationships", "foreign"),
      ],
      [slidePath, () => "<broken>"],
      [slidePath, (source: string) => `<!DOCTYPE sld>${source}`],
    ] as const)
      await expect(
        editPresentationPackage(await modify(path, change), [edit]),
      ).rejects.toThrow();
    const zip = await JSZip.loadAsync(original());
    zip.file(
      "customXml/entity.xml",
      '<!DOCTYPE unknown [<!ENTITY x "bad">]><unknown/>',
    );
    await expect(
      editPresentationPackage(await zip.generateAsync({ type: "uint8array" }), [
        edit,
      ]),
    ).rejects.toThrow();
  });
});

describe("PPTX ZIP解压前边界", () => {
  it.each([
    "../escape.xml",
    "/absolute.xml",
    "folder\\escape.xml",
    "folder//empty.xml",
    "folder/./dot.xml",
    "file%2exml",
  ])("拒绝非法归档路径 %s", async (name) => {
    const zip = await JSZip.loadAsync(original());
    zip.file(name, "payload");
    await expect(
      editPresentationPackage(await zip.generateAsync({ type: "uint8array" }), [
        edit,
      ]),
    ).rejects.toThrow();
  });

  it("拒绝重复名字、损坏ZIP、签名、超过压缩上限和过多目录项", async () => {
    const zip = await JSZip.loadAsync(original());
    zip.file("dupe1.xml", "<one/>");
    zip.file("dupe2.xml", "<two/>");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const duplicate = bytes.slice();
    const needle = new TextEncoder().encode("dupe2.xml"),
      replacement = new TextEncoder().encode("dupe1.xml");
    for (let index = 0; index <= duplicate.length - needle.length; index++)
      if (needle.every((value, part) => duplicate[index + part] === value))
        duplicate.set(replacement, index);
    await expect(editPresentationPackage(duplicate, [edit])).rejects.toThrow();
    await expect(
      editPresentationPackage(new Uint8Array([1, 2, 3]), [edit]),
    ).rejects.toThrow();
    await expect(
      editPresentationPackage(new Uint8Array(64 * 1024 * 1024 + 1), [edit]),
    ).rejects.toThrow();
    zip.file("_xmlsignatures/sig.xml", "<signature/>");
    await expect(
      editPresentationPackage(await zip.generateAsync({ type: "uint8array" }), [
        edit,
      ]),
    ).rejects.toThrow();
    const count = original();
    const view = new DataView(count.buffer, count.byteOffset, count.byteLength);
    view.setUint16(count.length - 22 + 8, 10001, true);
    view.setUint16(count.length - 22 + 10, 10001, true);
    await expect(editPresentationPackage(count, [edit])).rejects.toThrow();
  });

  it.each([
    "entry-size",
    "total-size",
    "encryption",
    "local-encryption",
    "zip64",
    "multidisk",
    "local-name",
    "overlap",
    "crc",
  ])("拒绝伪造或不支持归档：%s", async (kind) => {
    const bytes = original();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const end = bytes.length - 22;
    const directory = view.getUint32(end + 16, true);
    const local = view.getUint32(directory + 42, true);
    if (kind === "entry-size")
      view.setUint32(directory + 24, 33 * 1024 * 1024, true);
    if (kind === "total-size") {
      let offset = directory;
      for (let index = 0; index < 5; index++) {
        const start = view.getUint32(offset + 42, true);
        view.setUint32(offset + 24, 32 * 1024 * 1024, true);
        view.setUint32(start + 22, 32 * 1024 * 1024, true);
        offset +=
          46 +
          view.getUint16(offset + 28, true) +
          view.getUint16(offset + 30, true) +
          view.getUint16(offset + 32, true);
      }
    }
    if (kind === "encryption") view.setUint16(directory + 8, 1, true);
    if (kind === "local-encryption") view.setUint16(local + 6, 1, true);
    if (kind === "zip64") view.setUint16(directory + 6, 45, true);
    if (kind === "multidisk") view.setUint16(end + 4, 1, true);
    if (kind === "local-name") bytes[local + 30] = 120;
    if (kind === "overlap") {
      const second =
        directory +
        46 +
        view.getUint16(directory + 28, true) +
        view.getUint16(directory + 30, true) +
        view.getUint16(directory + 32, true);
      view.setUint32(second + 42, local, true);
    }
    if (kind === "crc") {
      view.setUint32(directory + 16, 0, true);
      view.setUint32(local + 14, 0, true);
    }
    await expect(editPresentationPackage(bytes, [edit])).rejects.toThrow();
  });
});
