import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { materializeSlideNodes } from "@aiden0z/pptx-renderer";
import {
  editPresentationPackage,
  type PresentationElementOrder,
} from "./presentationPackage";
import { applyPresentationEdits } from "./presentationEdits";
import { importPresentationDocument } from "./presentationDocument";
import { tableFixture } from "./presentationTablePackage.testFixtures";

const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
const slidePath = "ppt/slides/slide1.xml";
const parse = (text: string) =>
  new DOMParser().parseFromString(text, "application/xml");
const serialize = (node: Node) => new XMLSerializer().serializeToString(node);
const identity = (node: Element) =>
  node.getElementsByTagNameNS(p, "cNvPr")[0]?.getAttribute("id");
const drawings = (xml: Document) =>
  Array.from(xml.getElementsByTagNameNS(p, "spTree")[0].children).filter(
    (node) =>
      ["sp", "pic", "graphicFrame", "grpSp", "cxnSp"].includes(node.localName),
  );
const order = (xml: Document) => drawings(xml).map(identity);
const xmlFrom = async (bytes: Uint8Array) =>
  parse(await (await JSZip.loadAsync(bytes)).file(slidePath)!.async("string"));
const edit = (zOrder: PresentationElementOrder, elementId = "3") => ({
  slideId: "512",
  elementId,
  zOrder,
});

async function fixture() {
  const zip = await JSZip.loadAsync(await tableFixture());
  const xml = parse(await zip.file(slidePath)!.async("string"));
  const source = xml.getElementsByTagNameNS(p, "sp")[0];
  const table = xml.getElementsByTagNameNS(p, "graphicFrame")[0];
  for (const id of ["3", "4"]) {
    const copy = source.cloneNode(true) as Element;
    copy.getElementsByTagNameNS(p, "cNvPr")[0].setAttribute("id", id);
    copy.setAttributeNS("urn:retained", "keep:metadata", id);
    table.parentElement!.insertBefore(copy, table);
  }
  const extension = xml.createElementNS(p, "p:extLst");
  extension.textContent = "UNTOUCHED_TREE_EXTENSION";
  table.parentElement!.append(extension);
  zip.file(slidePath, serialize(xml));
  zip.file("ppt/media/order-retained.bin", new Uint8Array([0, 255, 32]));
  return zip.generateAsync({ type: "uint8array" });
}

describe("顶层对象层级写回与有序重放", () => {
  it.each([
    ["bring-forward", ["2", "4", "3", "7"]],
    ["bring-to-front", ["2", "4", "7", "3"]],
    ["send-backward", ["3", "2", "4", "7"]],
    ["send-to-back", ["3", "2", "4", "7"]],
  ] as const)(
    "%s 移动完整原节点，保留所有对象XML与非目标ZIP",
    async (direction, expected) => {
      const source = await fixture();
      const before = await xmlFrom(source);
      const output = await editPresentationPackage(source, [edit(direction)]);
      const after = await xmlFrom(output);
      expect(order(before)).toEqual(["2", "3", "4", "7"]);
      expect(order(after)).toEqual(expected);
      const payload = new Map(
        drawings(before).map((node) => [identity(node), serialize(node)]),
      );
      for (const node of drawings(after))
        expect(serialize(node)).toBe(payload.get(identity(node)));
      expect(
        after.getElementsByTagNameNS(p, "spTree")[0].lastElementChild
          ?.textContent,
      ).toBe("UNTOUCHED_TREE_EXTENSION");
      const inputZip = await JSZip.loadAsync(source),
        outputZip = await JSZip.loadAsync(output);
      expect(Object.keys(outputZip.files).sort()).toEqual(
        Object.keys(inputZip.files).sort(),
      );
      for (const [name, entry] of Object.entries(inputZip.files))
        if (!entry.dir && name !== slidePath)
          expect(await outputZip.file(name)!.async("uint8array")).toEqual(
            await entry.async("uint8array"),
          );
      const document = await importPresentationDocument(
        output,
        new AbortController().signal,
      );
      const slide = document.model.slides[0];
      materializeSlideNodes(document.model, slide);
      expect(slide.nodes.map((node) => node.id)).toEqual(expected);
    },
  );

  it("连续两次相对前移不得合并，原序撤回后恢复原绘制顺序", async () => {
    const source = await fixture();
    const steps = [edit("bring-forward", "2"), edit("bring-forward", "2")];
    const moved = await applyPresentationEdits(
      source,
      steps.map((value) => ({ kind: "element", value })),
    );
    expect(order(await xmlFrom(moved.bytes))).toEqual(["3", "4", "2", "7"]);
    const restored = await applyPresentationEdits(
      source,
      [...steps, edit("send-backward", "2"), edit("send-backward", "2")].map(
        (value) => ({ kind: "element", value }),
      ),
    );
    expect(order(await xmlFrom(restored.bytes))).toEqual(["2", "3", "4", "7"]);
  });

  it("同一动作可同时改frame并重排，先前frame编辑不跨过相对顺序丢失", async () => {
    const source = await fixture();
    const { bytes } = await applyPresentationEdits(source, [
      {
        kind: "element",
        value: {
          ...edit("bring-forward", "2"),
          frame: { x: 12, y: 34, width: 500, height: 80 },
        },
      },
      { kind: "element", value: edit("bring-forward", "2") },
      {
        kind: "element",
        value: { slideId: "512", elementId: "2", text: "原序文字" },
      },
    ]);
    const xml = await xmlFrom(bytes);
    expect(order(xml)).toEqual(["3", "4", "2", "7"]);
    const shape = drawings(xml).find((node) => identity(node) === "2")!;
    expect(shape.textContent).toContain("原序文字");
    expect(
      shape
        .getElementsByTagNameNS(
          "http://schemas.openxmlformats.org/drawingml/2006/main",
          "off",
        )[0]
        .getAttribute("x"),
    ).toBe(String(12 * 9525));
  });

  it.each([
    ["bring-forward", "7"],
    ["bring-to-front", "7"],
    ["send-backward", "2"],
    ["send-to-back", "2"],
  ] as const)("%s边界不重写ZIP", async (direction, id) => {
    const source = await fixture();
    expect(
      await editPresentationPackage(source, [edit(direction, id)]),
    ).toEqual(source);
  });

  it("拒绝非法direction，不改变调用者的原始字节", async () => {
    const source = await fixture(),
      before = source.slice();
    await expect(
      editPresentationPackage(source, [
        edit("front" as PresentationElementOrder),
      ]),
    ).rejects.toThrow("element order");
    expect(source).toEqual(before);
  });
});
