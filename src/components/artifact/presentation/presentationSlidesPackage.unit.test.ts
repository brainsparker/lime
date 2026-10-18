import JSZip from "jszip";
import { buildPresentation, parseZip } from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import {
  editPresentationSlidesPackage,
  readPresentationSlideTemplates,
  type PresentationSlideEdit,
} from "./presentationSlidesPackage";
import { editPresentationPackage } from "./presentationPackage";
import {
  p,
  a,
  r,
  rel,
  ct,
  ep,
  presentationPath,
  presentationRels,
  sourcePath,
  titleLayout,
  blankLayout,
  chart,
  note,
  image,
  xml,
  original,
  rels,
  fixture,
  setXml,
  addOverrides,
  relPath,
  relationships,
  target,
  slidePath,
  assertAllTargetsExist,
} from "./presentationSlidesPackage.testFixtures";

describe("PPTX 幻灯片原包结构操作", () => {
  it("按真实 master/layout 关系列出模板，合法 .. 路径同时支持既有对象编辑", async () => {
    const input = await fixture();
    expect(await readPresentationSlideTemplates(input)).toEqual([
      { id: titleLayout, name: "Title layout", masterName: "Office master" },
      { id: blankLayout, name: "Blank layout", masterName: "Office master" },
    ]);
    const edited = await editPresentationPackage(input, [
      { slideId: "512", elementId: "2", text: "still editable" },
    ]);
    expect(
      await (await JSZip.loadAsync(edited)).file(sourcePath)!.async("string"),
    ).toContain("still editable");
  });

  it("新增继承当前真实版式并插在当前页后，空占位保留文字样式与共享图片", async () => {
    const input = await fixture(),
      before = await JSZip.loadAsync(input);
    const result = await editPresentationSlidesPackage(input, [
      { type: "add", afterSlideId: "512" },
    ]);
    const id = result.createdSlideIds[0],
      zip = await JSZip.loadAsync(result.bytes),
      path = await slidePath(zip, id);
    expect(result.slideIds).toEqual(["512", id, "900", "300"]);
    expect(await target(zip, path, `${r}/slideLayout`)).toBe(titleLayout);
    const slide = xml(await zip.file(path)!.async("string"));
    const shapes = Array.from(slide.getElementsByTagNameNS(p, "sp"));
    expect(shapes).toHaveLength(1);
    expect(
      shapes[0].getElementsByTagNameNS(p, "ph")[0].getAttribute("type"),
    ).toBe("title");
    expect(shapes[0].getElementsByTagNameNS(a, "xfrm")).toHaveLength(0);
    expect(shapes[0].getElementsByTagNameNS(a, "t")[0].textContent).toBe("");
    expect(shapes[0].getElementsByTagNameNS(a, "p")).toHaveLength(1);
    expect(
      shapes[0].getElementsByTagNameNS(a, "rPr")[0].getAttribute("sz"),
    ).toBe("2400");
    expect(
      shapes[0].getElementsByTagNameNS(a, "rPr")[0].getAttribute("b"),
    ).toBe("1");
    expect(
      shapes[0].getElementsByTagNameNS(a, "pPr")[0].getAttribute("algn"),
    ).toBe("ctr");
    expect(slide.getElementsByTagNameNS(a, "fld")).toHaveLength(0);
    expect(slide.getElementsByTagNameNS(a, "hlinkClick")).toHaveLength(0);
    expect(await target(zip, path, `${r}/image`)).toBe(image);
    const embed = shapes[0]
      .getElementsByTagNameNS(a, "blip")[0]
      .getAttributeNS(r, "embed");
    expect(
      (await relationships(zip, path))
        .find((node) => node.getAttribute("Id") === embed)
        ?.getAttribute("Type"),
    ).toBe(`${r}/image`);
    for (const [name, entry] of Object.entries(before.files))
      if (
        !entry.dir &&
        ![presentationPath, presentationRels, "[Content_Types].xml"].includes(
          name,
        )
      )
        expect(await zip.file(name)!.async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
    await assertAllTargetsExist(zip);
    const parsed = await parseZip(result.bytes.slice().buffer as ArrayBuffer);
    expect(buildPresentation(parsed).slides).toHaveLength(4);
  });

  it("显式空白版式覆盖继承，未选页时追加且只取真正 type=blank", async () => {
    const input = await fixture();
    const result = await editPresentationSlidesPackage(input, [
      { type: "add", afterSlideId: "512", layoutId: blankLayout },
      { type: "add" },
    ]);
    expect(result.slideIds).toEqual([
      "512",
      result.createdSlideIds[0],
      "900",
      "300",
      result.createdSlideIds[1],
    ]);
    const zip = await JSZip.loadAsync(result.bytes);
    for (const id of result.createdSlideIds) {
      const path = await slidePath(zip, id);
      expect(await target(zip, path, `${r}/slideLayout`)).toBe(blankLayout);
      expect(
        xml(await zip.file(path)!.async("string")).getElementsByTagNameNS(
          p,
          "sp",
        ),
      ).toHaveLength(0);
    }
    await assertAllTargetsExist(zip);
  });

  it("当前页没有 layout 时回退 blank；只有非blank时失败保留输入", async () => {
    const input = await fixture(),
      zip = await JSZip.loadAsync(input);
    await setXml(zip, relPath(sourcePath), (document) => {
      Array.from(document.documentElement.children)
        .find((node) => node.getAttribute("Id") === "layout")!
        .remove();
    });
    const result = await editPresentationSlidesPackage(
      await zip.generateAsync({ type: "uint8array" }),
      [{ type: "add", afterSlideId: "512" }],
    );
    const output = await JSZip.loadAsync(result.bytes);
    expect(
      await target(
        output,
        await slidePath(output, result.createdSlideIds[0]),
        `${r}/slideLayout`,
      ),
    ).toBe(blankLayout);
    await expect(
      editPresentationSlidesPackage(await fixture({ noBlank: true }), [
        { type: "add" },
      ]),
    ).rejects.toThrow("blank layout");
    await expect(
      editPresentationSlidesPackage(original(), [
        { type: "add", afterSlideId: "512" },
      ]),
    ).rejects.toThrow("blank layout");
  });

  it("复制真实notes/图表/样式/颜色/图表drawing/嵌入xlsx子图，重写notes回指且共享master和媒体", async () => {
    const input = await fixture({ privateParts: true }),
      before = await JSZip.loadAsync(input);
    const result = await editPresentationSlidesPackage(input, [
      { type: "duplicate", slideId: "512" },
    ]);
    const id = result.createdSlideIds[0],
      zip = await JSZip.loadAsync(result.bytes),
      copy = await slidePath(zip, id);
    expect(result.slideIds).toEqual(["512", id, "900", "300"]);
    const newNote = await target(zip, copy, `${r}/notesSlide`),
      newChart = await target(zip, copy, `${r}/chart`);
    expect(newNote).not.toBe(note);
    expect(newChart).not.toBe(chart);
    expect(await target(zip, newNote, `${r}/slide`)).toBe(copy);
    expect(await target(zip, newNote, `${r}/notesMaster`)).toBe(
      "ppt/notesMasters/notesMaster1.xml",
    );
    expect(await target(zip, newNote, `${r}/image`)).toBe(image);
    expect(await target(zip, copy, `${r}/slideLayout`)).toBe(titleLayout);
    expect(await zip.file(copy)!.async("uint8array")).toEqual(
      await before.file(sourcePath)!.async("uint8array"),
    );
    expect(await zip.file(newNote)!.async("uint8array")).toEqual(
      await before.file(note)!.async("uint8array"),
    );
    expect(await zip.file(newChart)!.async("uint8array")).toEqual(
      await before.file(chart)!.async("uint8array"),
    );
    for (const type of [
      `${r}/package`,
      `${r}/chartUserShapes`,
      "http://schemas.microsoft.com/office/2011/relationships/chartStyle",
      "http://schemas.microsoft.com/office/2011/relationships/chartColorStyle",
    ]) {
      const oldTarget = await target(before, chart, type),
        newTarget = await target(zip, newChart, type);
      expect(newTarget).not.toBe(oldTarget);
      expect(await zip.file(newTarget)!.async("uint8array")).toEqual(
        await before.file(oldTarget)!.async("uint8array"),
      );
      if (type === `${r}/package`) {
        const workbook = await JSZip.loadAsync(
          await zip.file(newTarget)!.async("uint8array"),
        );
        expect(
          await workbook.file("xl/worksheets/sheet1.xml")!.async("string"),
        ).toContain("<v>7</v>");
      }
      if (type === `${r}/chartUserShapes`)
        expect(await target(zip, newTarget, `${r}/image`)).toBe(image);
    }
    for (const [name, entry] of Object.entries(before.files))
      if (
        !entry.dir &&
        ![presentationPath, presentationRels, "[Content_Types].xml"].includes(
          name,
        )
      )
        expect(await zip.file(name)!.async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
    await assertAllTargetsExist(zip);
  });

  it("同一批次可复制新页、删除源页，所有新notes回指仍跟随实际新页", async () => {
    const result = await editPresentationSlidesPackage(
      await fixture({ privateParts: true }),
      [
        { type: "duplicate", slideId: "512" },
        { type: "duplicate", slideId: "901" },
        { type: "delete", slideId: "512" },
      ],
    );
    expect(result.slideIds).toEqual(["901", "902", "900", "300"]);
    const zip = await JSZip.loadAsync(result.bytes);
    for (const id of result.createdSlideIds) {
      const path = await slidePath(zip, id),
        notes = await target(zip, path, `${r}/notesSlide`);
      expect(await target(zip, notes, `${r}/slide`)).toBe(path);
    }
    expect(zip.file(sourcePath)).toBeNull();
    expect(zip.file(note)).toBeNull();
    expect(zip.file(chart)).toBeNull();
    await assertAllTargetsExist(zip);
  });

  it("删除独占私有子图并清理content types，不删除共享layout/master/媒体", async () => {
    const result = await editPresentationSlidesPackage(
      await fixture({ privateParts: true }),
      [{ type: "delete", slideId: "512" }],
    );
    expect(result.slideIds).toEqual(["900", "300"]);
    const zip = await JSZip.loadAsync(result.bytes);
    for (const path of [
      sourcePath,
      note,
      chart,
      "ppt/charts/style1.xml",
      "ppt/charts/colors1.xml",
      "ppt/drawings/drawing1.xml",
      "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx",
    ]) {
      expect(zip.file(path), path).toBeNull();
      expect(zip.file(relPath(path)), path).toBeNull();
    }
    for (const path of [
      titleLayout,
      blankLayout,
      image,
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/notesMasters/notesMaster1.xml",
      "customXml/retained.xml",
    ])
      expect(zip.file(path), path).not.toBeNull();
    await assertAllTargetsExist(zip);
  });

  it("删除页时保留其他页共享的chart及完整子图，复制共享chart则创建独立副本", async () => {
    const input = await fixture({ privateParts: true, sharedChart: true });
    const deleted = await editPresentationSlidesPackage(input, [
      { type: "delete", slideId: "512" },
    ]);
    const zip = await JSZip.loadAsync(deleted.bytes);
    expect(zip.file(note)).toBeNull();
    expect(zip.file(chart)).not.toBeNull();
    expect(await target(zip, "ppt/slides/slide2.xml", `${r}/chart`)).toBe(
      chart,
    );
    expect(zip.file(await target(zip, chart, `${r}/package`))).not.toBeNull();
    await assertAllTargetsExist(zip);
    const copied = await editPresentationSlidesPackage(input, [
      { type: "duplicate", slideId: "512" },
    ]);
    const copies = await JSZip.loadAsync(copied.bytes);
    expect(
      await target(
        copies,
        await slidePath(copies, copied.createdSlideIds[0]),
        `${r}/chart`,
      ),
    ).not.toBe(chart);
    expect(await target(copies, "ppt/slides/slide2.xml", `${r}/chart`)).toBe(
      chart,
    );
  });

  it.each([
    [2, ["900", "300", "512"]],
    [1.9, ["900", "512", "300"]],
    [-9, ["512", "900", "300"]],
    [Number.POSITIVE_INFINITY, ["512", "900", "300"]],
    [NaN, ["512", "900", "300"]],
  ] as const)("移动到最终索引 %s 并仅改页序", async (index, expected) => {
    const input = await fixture(),
      before = await JSZip.loadAsync(input),
      result = await editPresentationSlidesPackage(input, [
        { type: "move", slideId: "512", toIndex: index },
      ]);
    expect(result.slideIds).toEqual(expected);
    expect(result.createdSlideIds).toEqual([]);
    const zip = await JSZip.loadAsync(result.bytes);
    for (const [name, entry] of Object.entries(before.files))
      if (!entry.dir && name !== presentationPath)
        expect(await zip.file(name)!.async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
    await assertAllTargetsExist(zip);
  });

  it("删除目标页时移除其他页的实际跳转链接和customShow，保留其他内容", async () => {
    const zip = await JSZip.loadAsync(await fixture());
    const second = "ppt/slides/slide2.xml";
    zip.file(
      second,
      (await zip.file(second)!.async("string")).replace(
        "</a:rPr>",
        '<a:hlinkClick r:id="jump" action="ppaction://hlinksldjump"/></a:rPr>',
      ),
    );
    await setXml(zip, relPath(second), (document) => {
      const node = document.createElementNS(rel, "Relationship");
      node.setAttribute("Id", "jump");
      node.setAttribute("Type", `${r}/slide`);
      node.setAttribute("Target", "slide1.xml");
      document.documentElement.append(node);
    });
    await setXml(zip, presentationPath, (document) => {
      const show = xml(
        `<p:custShowLst xmlns:p="${p}" xmlns:r="${r}"><p:custShow name="Only source" id="0"><p:sldLst><p:sld r:id="rId1"/></p:sldLst></p:custShow><p:custShow name="Other" id="1"><p:sldLst><p:sld r:id="rId1"/><p:sld r:id="rId2"/></p:sldLst></p:custShow></p:custShowLst>`,
      );
      document.documentElement.append(
        document.importNode(show.documentElement, true),
      );
    });
    const result = await editPresentationSlidesPackage(
      await zip.generateAsync({ type: "uint8array" }),
      [{ type: "delete", slideId: "512" }],
    );
    const output = await JSZip.loadAsync(result.bytes);
    expect(
      (await relationships(output, second)).some(
        (node) => node.getAttribute("Id") === "jump",
      ),
    ).toBe(false);
    expect(await output.file(second)!.async("string")).not.toContain(
      "ppaction://hlinksldjump",
    );
    const shows = xml(
      await output.file(presentationPath)!.async("string"),
    ).getElementsByTagNameNS(p, "custShow");
    expect(shows).toHaveLength(1);
    expect(shows[0].getAttribute("name")).toBe("Other");
    expect(shows[0].getElementsByTagNameNS(p, "sld")).toHaveLength(1);
    await assertAllTargetsExist(output);
  });

  it("页数元数据更新，派生标题/主题缓存失效，其他属性保留", async () => {
    const zip = await JSZip.loadAsync(await fixture());
    zip.file(
      "docProps/app.xml",
      `<Properties xmlns="${ep}"><Application>PowerPoint</Application><Slides>3</Slides><HeadingPairs/><TitlesOfParts/><Company>Keep company</Company></Properties>`,
    );
    await addOverrides(zip, {
      "docProps/app.xml":
        "application/vnd.openxmlformats-officedocument.extended-properties+xml",
    });
    await setXml(zip, "_rels/.rels", (document) => {
      const relation = document.createElementNS(rel, "Relationship");
      relation.setAttribute("Id", "properties");
      relation.setAttribute("Type", `${r}/extended-properties`);
      relation.setAttribute("Target", "docProps/app.xml");
      document.documentElement.append(relation);
    });
    const result = await editPresentationSlidesPackage(
      await zip.generateAsync({ type: "uint8array" }),
      [{ type: "duplicate", slideId: "512" }],
    );
    const app = xml(
      await (await JSZip.loadAsync(result.bytes))
        .file("docProps/app.xml")!
        .async("string"),
    );
    expect(app.getElementsByTagNameNS(ep, "Slides")[0].textContent).toBe("4");
    expect(app.getElementsByTagNameNS(ep, "HeadingPairs")).toHaveLength(0);
    expect(app.getElementsByTagNameNS(ep, "TitlesOfParts")).toHaveLength(0);
    expect(app.getElementsByTagNameNS(ep, "Company")[0].textContent).toBe(
      "Keep company",
    );
  });

  it("缺失layout、非法页identity和最后一页删除均失败且不改变输入", async () => {
    const input = await fixture(),
      retained = input.slice();
    for (const edit of [
      {
        type: "add",
        afterSlideId: "512",
        layoutId: "ppt/slideLayouts/missing.xml",
      },
      { type: "duplicate", slideId: "0512" },
      { type: "delete", slideId: "999" },
      { type: "move", slideId: "512", toIndex: "1" },
    ] as PresentationSlideEdit[])
      await expect(
        editPresentationSlidesPackage(input, [edit]),
      ).rejects.toThrow();
    expect(input).toEqual(retained);
    await expect(
      editPresentationSlidesPackage(input, [
        { type: "delete", slideId: "512" },
        { type: "delete", slideId: "900" },
        { type: "delete", slideId: "300" },
      ]),
    ).rejects.toThrow("last slide");
  });

  it("无操作返回独立字节副本及原页序", async () => {
    const input = await fixture(),
      result = await editPresentationSlidesPackage(input, []);
    expect(result.bytes).toEqual(input);
    expect(result.bytes).not.toBe(input);
    expect(result.slideIds).toEqual(["512", "900", "300"]);
    expect(result.createdSlideIds).toEqual([]);
  });

  it("presentation关系支持合法绝对路径和包内..，真实成员identity保持不变", async () => {
    for (const destination of [
      "/ppt/slides/slide1.xml",
      "../ppt/slides/slide1.xml",
    ]) {
      const zip = await JSZip.loadAsync(await fixture());
      await setXml(zip, presentationRels, (document) => {
        Array.from(document.documentElement.children)
          .find((node) => node.getAttribute("Id") === "rId1")!
          .setAttribute("Target", destination);
      });
      const result = await editPresentationSlidesPackage(
        await zip.generateAsync({ type: "uint8array" }),
        [{ type: "move", slideId: "512", toIndex: 2 }],
      );
      expect(result.slideIds).toEqual(["900", "300", "512"]);
      const output = await JSZip.loadAsync(result.bytes);
      await assertAllTargetsExist(output);
      expect(await output.file(sourcePath)!.async("uint8array")).toEqual(
        await zip.file(sourcePath)!.async("uint8array"),
      );
    }
  });

  it("私有notes错误回指、内容类型不符和损坏XML不产生伪成功副本", async () => {
    for (const mode of ["backlink", "contentType", "brokenXml"]) {
      const zip = await JSZip.loadAsync(await fixture({ privateParts: true }));
      if (mode === "backlink") {
        await setXml(zip, relPath(note), (document) => {
          Array.from(document.documentElement.children)
            .find((node) => node.getAttribute("Id") === "slide")!
            .setAttribute("Target", "../slides/slide2.xml");
        });
      } else if (mode === "contentType") {
        await setXml(zip, "[Content_Types].xml", (document) => {
          Array.from(document.documentElement.children)
            .find((node) => node.getAttribute("PartName") === `/${chart}`)!
            .setAttribute("ContentType", "application/xml");
        });
      } else zip.file(chart, "<broken>");
      const bytes = await zip.generateAsync({ type: "uint8array" }),
        retained = bytes.slice();
      await expect(
        editPresentationSlidesPackage(bytes, [
          { type: "duplicate", slideId: "512" },
        ]),
      ).rejects.toThrow();
      expect(bytes).toEqual(retained);
    }
  });

  it("新部件名避让已有孤立同名资源及其关系part", async () => {
    const zip = await JSZip.loadAsync(await fixture());
    zip.file("ppt/slides/slide4.xml", '<keep xmlns="urn:unknown"/>');
    zip.file("ppt/slides/_rels/slide4.xml.rels", rels([]));
    const result = await editPresentationSlidesPackage(
      await zip.generateAsync({ type: "uint8array" }),
      [{ type: "duplicate", slideId: "512" }],
    );
    const output = await JSZip.loadAsync(result.bytes);
    expect(await slidePath(output, result.createdSlideIds[0])).toBe(
      "ppt/slides/slide5.xml",
    );
    expect(await output.file("ppt/slides/slide4.xml")!.async("string")).toBe(
      '<keep xmlns="urn:unknown"/>',
    );
    await assertAllTargetsExist(output);
  });

  it("仅有Override而无rels Default的合法包，新增/复制关系均声明类型，删除同步移除类型", async () => {
    const zip = await JSZip.loadAsync(await fixture({ privateParts: true }));
    await setXml(zip, "[Content_Types].xml", (document) => {
      Array.from(document.documentElement.children)
        .find((node) => node.getAttribute("Extension") === "rels")!
        .remove();
    });
    await addOverrides(
      zip,
      Object.fromEntries(
        Object.keys(zip.files)
          .filter((path) => path.endsWith(".rels"))
          .map((path) => [
            path,
            "application/vnd.openxmlformats-package.relationships+xml",
          ]),
      ),
    );
    const result = await editPresentationSlidesPackage(
      await zip.generateAsync({ type: "uint8array" }),
      [
        { type: "duplicate", slideId: "512" },
        { type: "add", layoutId: blankLayout },
        { type: "delete", slideId: "512" },
      ],
    );
    const output = await JSZip.loadAsync(result.bytes);
    const types = Array.from(
      xml(
        await output.file("[Content_Types].xml")!.async("string"),
      ).getElementsByTagNameNS(ct, "Override"),
    );
    for (const path of Object.keys(output.files).filter((path) =>
      path.endsWith(".rels"),
    ))
      expect(
        types
          .find((node) => node.getAttribute("PartName") === `/${path}`)
          ?.getAttribute("ContentType"),
        path,
      ).toBe("application/vnd.openxmlformats-package.relationships+xml");
    expect(
      types.some(
        (node) => node.getAttribute("PartName") === `/${relPath(sourcePath)}`,
      ),
    ).toBe(false);
    expect(
      types.some(
        (node) => node.getAttribute("PartName") === `/${relPath(chart)}`,
      ),
    ).toBe(false);
    await assertAllTargetsExist(output);
  });

  it("不支持的私有clone、分节移动和有未知入边的删除明确失败", async () => {
    const base = await fixture();
    for (const action of ["unknownClone", "sections", "unknownInbound"]) {
      const zip = await JSZip.loadAsync(base);
      if (action === "unknownClone") {
        zip.file("ppt/comments/comment1.xml", '<p:cmLst xmlns:p="' + p + '"/>');
        await setXml(zip, relPath(sourcePath), (document) => {
          const node = document.createElementNS(rel, "Relationship");
          node.setAttribute("Id", "comments");
          node.setAttribute("Type", `${r}/comments`);
          node.setAttribute("Target", "../comments/comment1.xml");
          document.documentElement.append(node);
        });
      } else if (action === "sections") {
        await setXml(zip, presentationPath, (document) => {
          const node = document.createElementNS(
            "http://schemas.microsoft.com/office/powerpoint/2010/main",
            "p14:sectionLst",
          );
          document.documentElement.append(node);
        });
      } else {
        await setXml(zip, presentationRels, (document) => {
          const node = document.createElementNS(rel, "Relationship");
          node.setAttribute("Id", "unknown");
          node.setAttribute("Type", "urn:unknown:private");
          node.setAttribute("Target", "slides/slide1.xml");
          document.documentElement.append(node);
        });
      }
      const bytes = await zip.generateAsync({ type: "uint8array" });
      await expect(
        editPresentationSlidesPackage(bytes, [
          action === "unknownInbound"
            ? { type: "delete", slideId: "512" }
            : { type: "duplicate", slideId: "512" },
        ]),
      ).rejects.toThrow();
    }
  });

  it.each([
    "../../../escape.xml",
    "../%2e%2e/escape.xml",
    "https://example.invalid/data.xml",
    "//example.invalid/data.xml",
    "../media/image1.png#fragment",
  ])("内部关系 %s 不能逃逸或伪装URI", async (destination) => {
    const zip = await JSZip.loadAsync(await fixture());
    zip.file(
      relPath(sourcePath),
      rels([["bad", `${r}/slideLayout`, destination]]),
    );
    await expect(
      editPresentationSlidesPackage(
        await zip.generateAsync({ type: "uint8array" }),
        [{ type: "duplicate", slideId: "512" }],
      ),
    ).rejects.toThrow();
  });

  it("分组/图表占位不能用空shape伪支持，跨包root的layout关系也失败", async () => {
    for (const mode of ["placeholder", "missingTarget", "duplicateTarget"]) {
      const zip = await JSZip.loadAsync(await fixture());
      if (mode === "placeholder") {
        zip.file(
          titleLayout,
          (await zip.file(titleLayout)!.async("string"))
            .replace(/<p:sp>/g, "<p:grpSp>")
            .replace(/<\/p:sp>/g, "</p:grpSp>"),
        );
      } else if (mode === "missingTarget") zip.remove(image);
      else zip.file("PPT/media/image1.png", new Uint8Array([1]));
      await expect(
        editPresentationSlidesPackage(
          await zip.generateAsync({ type: "uint8array" }),
          [{ type: "add", afterSlideId: "512" }],
        ),
      ).rejects.toThrow();
    }
  });
});
