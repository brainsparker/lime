import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { materializeSlideNodes } from "@aiden0z/pptx-renderer";
import { editPresentationPackage } from "./presentationPackage";
import { importPresentationDocument } from "./presentationDocument";

const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
const slidePath = "ppt/slides/slide1.xml";
const frame = { x: 10, y: 20, width: 300, height: 100 };
const readXml = (source: string) =>
  new DOMParser().parseFromString(source, "application/xml");

async function fixture() {
  const zip = await JSZip.loadAsync(
    readFileSync(
      "src/components/artifact/presentation/__fixtures__/review.pptx",
    ),
  );
  const xml = readXml(await zip.file(slidePath)!.async("string"));
  const shape = xml.getElementsByTagNameNS(p, "sp")[0];
  const copy = shape.cloneNode(true) as Element;
  copy.getElementsByTagNameNS(p, "cNvPr")[0].setAttribute("id", "3");
  for (const [index, element] of [shape, copy].entries()) {
    const transform = element.getElementsByTagNameNS(a, "xfrm")[0];
    transform.setAttribute("rot", String(60000 * (index + 1)));
    transform.setAttribute("flipH", "1");
    transform.setAttribute("flipV", "1");
    transform.setAttributeNS("urn:keep", "keep:transform", "retained");
  }
  shape.parentElement!.append(copy);
  zip.file(slidePath, new XMLSerializer().serializeToString(xml));
  zip.file("ppt/media/rotation-retained.bin", new Uint8Array([0, 255, 42]));
  return zip.generateAsync({ type: "uint8array" });
}

describe("对象集合旋转的原包写回", () => {
  it("同批两对象按角度写入，重解析仍保留flip、文字和其他ZIP成员", async () => {
    const source = await fixture();
    const input = await JSZip.loadAsync(source);
    const bytes = await editPresentationPackage(source, [
      { slideId: "512", elementId: "2", frame: { ...frame, rotation: 90.125 } },
      { slideId: "512", elementId: "3", frame: { ...frame, rotation: 270.5 } },
    ]);
    const output = await JSZip.loadAsync(bytes);
    const before = readXml(await input.file(slidePath)!.async("string"));
    const after = readXml(await output.file(slidePath)!.async("string"));
    for (const [index, shape] of Array.from(
      after.getElementsByTagNameNS(p, "sp"),
    ).entries()) {
      const transform = shape.getElementsByTagNameNS(a, "xfrm")[0];
      expect(transform.getAttribute("rot")).toBe(
        String([90.125, 270.5][index] * 60000),
      );
      expect(transform.getAttribute("flipH")).toBe("1");
      expect(transform.getAttribute("flipV")).toBe("1");
      expect(transform.getAttributeNS("urn:keep", "transform")).toBe(
        "retained",
      );
      expect(shape.getElementsByTagNameNS(p, "txBody")[0].textContent).toBe(
        before.getElementsByTagNameNS(p, "txBody")[index].textContent,
      );
    }
    for (const [name, entry] of Object.entries(input.files))
      if (!entry.dir && name !== slidePath)
        expect(await output.file(name)!.async("uint8array")).toEqual(
          await entry.async("uint8array"),
        );
    const snapshot = await importPresentationDocument(
      bytes,
      new AbortController().signal,
    );
    const slide = snapshot.model.slides[0];
    materializeSlideNodes(snapshot.model, slide);
    expect(slide.nodes.filter((node) => ["2", "3"].includes(node.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "2",
          rotation: 90.125,
          flipH: true,
          flipV: true,
        }),
        expect.objectContaining({
          id: "3",
          rotation: 270.5,
          flipH: true,
          flipV: true,
        }),
      ]),
    );
  });

  it("未指定rotation的平移保留原始角度", async () => {
    const bytes = await editPresentationPackage(await fixture(), [
      { slideId: "512", elementId: "2", frame },
    ]);
    const zip = await JSZip.loadAsync(bytes);
    const xml = readXml(await zip.file(slidePath)!.async("string"));
    const shape = xml.getElementsByTagNameNS(p, "sp")[0];
    expect(shape.getElementsByTagNameNS(a, "xfrm")[0].getAttribute("rot")).toBe(
      "60000",
    );
  });

  it.each([NaN, Infinity, -Infinity, 1e12, "90", null])(
    "拒绝不可表示的角度 %j，输入字节不变",
    async (rotation) => {
      const source = await fixture();
      const original = source.slice();
      await expect(
        editPresentationPackage(source, [
          {
            slideId: "512",
            elementId: "2",
            frame: { ...frame, rotation: rotation as number },
          },
        ]),
      ).rejects.toThrow("element rotation");
      expect(source).toEqual(original);
    },
  );
});
