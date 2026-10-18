import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  a,
  p,
  r,
  children,
  one,
  readXml,
  relationships,
} from "./presentationPackageXml";
import {
  presentationTextBody,
  readPresentationTextBlock,
} from "./presentationTextDocument";
import {
  editPresentationTextPackage,
  type PresentationTextEdit,
} from "./presentationTextEditPackage";
import { createPresentationTextRangeAdapter } from "./presentationTextRange";
import { presentationTextContent } from "./presentationTextRangeXml";
import {
  modifyTextPackage,
  serializeTextBody,
  textPackageFixture,
  textPackagePart,
  textRelationsPath,
  textSlidePath,
  textSnapshot,
} from "./presentationTextDocument.testFixtures";

const target = { slideId: "512", elementId: "2" };
const cellTarget = {
  slideId: "512",
  elementId: "7",
  cell: { row: 0, column: 1 },
};

async function draft(bytes: Uint8Array, address = target) {
  const { snapshot } = await textSnapshot(bytes);
  return readPresentationTextBlock(
    snapshot,
    address.slideId,
    address.elementId,
    "cell" in address ? (address as typeof cellTarget).cell : undefined,
  )!;
}

function replaceStart(body: Element, blockId: string, value: string) {
  const owner = createPresentationTextRangeAdapter(body, blockId);
  owner.replaceRange(
    owner.positionAtOffset(0),
    owner.positionAtOffset(5),
    value,
  );
}

function link(body: Element, id: string, index = 0) {
  const node = body.getElementsByTagNameNS(a, "hlinkClick")[index];
  node.setAttributeNS(r, "r:id", id);
}

async function expectOtherPartsRetained(
  before: Uint8Array,
  after: Uint8Array,
  changed: readonly string[],
) {
  const original = await JSZip.loadAsync(before),
    saved = await JSZip.loadAsync(after);
  expect(Object.keys(saved.files).sort()).toEqual(
    Object.keys(original.files).sort(),
  );
  for (const [path, entry] of Object.entries(original.files)) {
    if (entry.dir || changed.includes(path)) continue;
    expect(await saved.file(path)!.async("uint8array"), path).toEqual(
      await entry.async("uint8array"),
    );
  }
}

function edit(body: Element, changes: Partial<PresentationTextEdit> = {}) {
  return { ...target, bodyXml: serializeTextBody(body), ...changes };
}

describe("原始 OPC text body 与 relationship 原子提交", () => {
  it("shape/cell共用range owner保存，非目标正文、几何、表格属性与所有其他part保持原样", async () => {
    const bytes = await textPackageFixture(),
      before = bytes.slice(),
      shape = await draft(bytes),
      cell = await draft(bytes, cellTarget),
      source = await textPackagePart(bytes);
    replaceStart(shape.body, shape.blockId, "标题😃");
    replaceStart(cell.body, cell.blockId, "单元格👩‍💻");
    const output = await editPresentationTextPackage(bytes, [
      edit(shape.body),
      edit(cell.body, cellTarget),
    ]);
    expect(bytes).toEqual(before);
    await expectOtherPartsRetained(bytes, output, [textSlidePath]);
    const saved = await textPackagePart(output),
      shapeBody = presentationTextBody(saved, "2"),
      cellBody = presentationTextBody(saved, "7", cellTarget.cell);
    expect(presentationTextContent(shapeBody)).toBe(
      "标题😃 中😀文\ntail\nSecond 👩‍💻IME\nThird",
    );
    expect(presentationTextContent(cellBody)).toBe(
      "单元格👩‍💻 中😀文\ntail\nSecond 👩‍💻IME\nThird",
    );
    for (const [body, expected] of [
      [(await draft(output)).body, shape.body],
      [(await draft(output, cellTarget)).body, cell.body],
    ])
      expect(body.isEqualNode(expected)).toBe(true);
    // 用原正文还原唯一变更区域后，整个 slide 树必须保持相同。
    shapeBody.replaceWith(
      saved.importNode(presentationTextBody(source, "2"), true),
    );
    cellBody.replaceWith(
      saved.importNode(
        presentationTextBody(source, "7", cellTarget.cell),
        true,
      ),
    );
    expect(saved.isEqualNode(source)).toBe(true);
    const reread = await draft(output);
    expect(presentationTextContent(reread.body)).toContain("标题😃");
    const { snapshot } = await textSnapshot(output);
    expect(snapshot.model.slides[0].nodes.length).toBeGreaterThan(0);
  });

  it("空操作及只有xmlns/prefix/attribute顺序差异的正文返回原字节副本", async () => {
    const bytes = await textPackageFixture(),
      original = await draft(bytes),
      serialized = serializeTextBody(original.body);
    for (const edits of [
      [],
      [edit(original.body)],
      [
        {
          ...target,
          bodyXml: serialized
            .replaceAll("p:txBody", "pres:txBody")
            .replace(`xmlns:p="${p}"`, `xmlns:pres="${p}"`),
        },
      ],
    ]) {
      const output = await editPresentationTextPackage(bytes, edits);
      expect(output).not.toBe(bytes);
      expect(output).toEqual(bytes);
    }
  });

  it("同slide多个正文的新https/http/mailto链接分配互不冲突的rId且保留旧关系", async () => {
    const bytes = await textPackageFixture(),
      shape = await draft(bytes),
      cell = await draft(bytes, cellTarget),
      relations = await textPackagePart(bytes, textRelationsPath);
    link(shape.body, "draft_https");
    link(shape.body, "draft_http", 1);
    link(cell.body, "draft_mail");
    const output = await editPresentationTextPackage(bytes, [
      edit(shape.body, {
        hyperlinks: [
          { id: "draft_https", url: "https://example.invalid/new?q=中&n=1" },
          { id: "draft_http", url: "http://example.invalid/new" },
        ],
      }),
      edit(cell.body, {
        ...cellTarget,
        hyperlinks: [{ id: "draft_mail", url: "mailto:new@example.invalid" }],
      }),
    ]);
    await expectOtherPartsRetained(bytes, output, [
      textSlidePath,
      textRelationsPath,
    ]);
    const saved = await textPackagePart(output, textRelationsPath),
      nodes = Array.from(saved.documentElement.children),
      old = Array.from(relations.documentElement.children),
      ids = nodes.map((node) => node.getAttribute("Id"));
    expect(new Set(ids).size).toBe(ids.length);
    for (const node of old)
      expect(
        nodes
          .find(
            (candidate) =>
              candidate.getAttribute("Id") === node.getAttribute("Id"),
          )!
          .isEqualNode(node),
      ).toBe(true);
    expect(nodes).toHaveLength(old.length + 3);
    const { snapshot } = await textSnapshot(output),
      savedShape = readPresentationTextBlock(snapshot, "512", "2")!,
      savedCell = readPresentationTextBlock(
        snapshot,
        "512",
        "7",
        cellTarget.cell,
      )!;
    expect(
      Array.from(
        savedShape.body.getElementsByTagNameNS(a, "hlinkClick"),
        (node) => savedShape.resolveHyperlink(node.getAttributeNS(r, "id")!),
      ),
    ).toEqual([
      "https://example.invalid/new?q=中&n=1",
      "http://example.invalid/new",
    ]);
    expect(
      savedCell.resolveHyperlink(
        savedCell.body
          .getElementsByTagNameNS(a, "hlinkClick")[0]
          .getAttributeNS(r, "id")!,
      ),
    ).toBe("mailto:new@example.invalid");
    expect(savedShape.resolveHyperlink("rLink")).toBe(
      "https://example.invalid/rich",
    );
    expect(serializeTextBody(savedShape.body)).not.toContain("draft_");
    expect(
      savedShape.body.getElementsByTagNameNS("urn:keep", "run"),
    ).toHaveLength(1);
  });

  it("没有slide关系part时创建标准OPC关系，正文和关系同时落包", async () => {
    const bytes = await modifyTextPackage(
      await textPackageFixture(),
      (document, zip) => {
        for (const node of Array.from(
          document.getElementsByTagNameNS(a, "hlinkClick"),
        ))
          node.remove();
        zip.remove(textRelationsPath);
      },
    );
    const block = await draft(bytes),
      run = block.body.getElementsByTagNameNS(a, "rPr")[0],
      hyperlink = block.body.ownerDocument.createElementNS(a, "a:hlinkClick");
    hyperlink.setAttributeNS(r, "r:id", "draft_new");
    run.append(hyperlink);
    const output = await editPresentationTextPackage(bytes, [
      edit(block.body, {
        hyperlinks: [
          { id: "draft_new", url: "https://example.invalid/created" },
        ],
      }),
    ]);
    const relation = await textPackagePart(output, textRelationsPath);
    expect(relation.documentElement.namespaceURI).toBe(relationships);
    expect(relation.documentElement.children).toHaveLength(1);
    const reread = await draft(output);
    expect(reread.resolveHyperlink("rId1")).toBe(
      "https://example.invalid/created",
    );
    expect(
      reread.body
        .getElementsByTagNameNS(a, "hlinkClick")[0]
        .getAttributeNS(r, "id"),
    ).toBe("rId1");
  });

  it("分配新rId时预留整个批次的临时ID，避免先分配的关系抢占后续映射", async () => {
    const bytes = await textPackageFixture(),
      block = await draft(bytes),
      original = await textPackagePart(bytes, textRelationsPath),
      ids = new Set(
        Array.from(original.documentElement.children, (node) =>
          node.getAttribute("Id"),
        ),
      ),
      temporary: string[] = [];
    for (let index = 1; temporary.length < 2; index++)
      if (!ids.has(`rId${index}`)) temporary.push(`rId${index}`);
    link(block.body, temporary[0]);
    link(block.body, temporary[1], 1);
    const urls = [
        "https://example.invalid/first",
        "https://example.invalid/second",
      ],
      output = await editPresentationTextPackage(bytes, [
        edit(block.body, {
          hyperlinks: temporary.map((id, index) => ({ id, url: urls[index] })),
        }),
      ]),
      saved = await draft(output),
      references = Array.from(
        saved.body.getElementsByTagNameNS(a, "hlinkClick"),
        (node) => node.getAttributeNS(r, "id")!,
      );
    expect(references.some((id) => temporary.includes(id))).toBe(false);
    expect(references.map(saved.resolveHyperlink)).toEqual(urls);
  });

  it.each([
    [
      "root namespace",
      (body: Element) =>
        serializeTextBody(body).replaceAll("p:txBody", "a:txBody"),
    ],
    [
      "root element",
      (body: Element) =>
        serializeTextBody(body).replaceAll("p:txBody", "p:body"),
    ],
    ["XML", () => "<broken"],
    ["DTD", () => '<!DOCTYPE root [<!ENTITY x "bad">]><root/>'],
    [
      "character",
      (body: Element) => serializeTextBody(body).replace("Alpha", "\u0000"),
    ],
    [
      "duplicate run text",
      (body: Element) => {
        const run = body.getElementsByTagNameNS(a, "r")[0];
        run.append(one(run, a, "t")!.cloneNode(true));
        return serializeTextBody(body);
      },
    ],
    [
      "field",
      (body: Element) => {
        const paragraph = children(body, a, "p")[0];
        paragraph.append(body.ownerDocument.createElementNS(a, "a:fld"));
        return serializeTextBody(body);
      },
    ],
    [
      "math",
      (body: Element) => {
        body.append(
          body.ownerDocument.createElementNS(
            "http://schemas.openxmlformats.org/officeDocument/2006/math",
            "m:oMath",
          ),
        );
        return serializeTextBody(body);
      },
    ],
    [
      "body attributes",
      (body: Element) => {
        body.setAttribute("foreign", "changed");
        return serializeTextBody(body);
      },
    ],
    [
      "bodyPr",
      (body: Element) => {
        one(body, a, "bodyPr")!.setAttribute("wrap", "none");
        return serializeTextBody(body);
      },
    ],
    [
      "lstStyle",
      (body: Element) => {
        one(body, a, "lstStyle")!.remove();
        return serializeTextBody(body);
      },
    ],
    [
      "oversized text",
      (body: Element) => {
        body.getElementsByTagNameNS(a, "t")[0].textContent = "x".repeat(
          1024 * 1024 + 1,
        );
        return serializeTextBody(body);
      },
    ],
  ] as const)(
    "拒绝不合法正文或metadata篡改且原包未变：%s",
    async (_label, mutation) => {
      const bytes = await textPackageFixture(),
        before = bytes.slice(),
        block = await draft(bytes);
      await expect(
        editPresentationTextPackage(bytes, [
          { ...target, bodyXml: mutation(block.body) },
        ]),
      ).rejects.toThrow("Invalid presentation");
      expect(bytes).toEqual(before);
    },
  );

  it.each([
    { slideId: "999" },
    { elementId: "999" },
    { elementId: "7" },
    { cell: { row: 0, column: 0 } },
    { ...cellTarget, cell: { row: -1, column: 0 } },
    { ...cellTarget, cell: { row: 999, column: 0 } },
  ])("目标身份/类型/地址无效时不创建替代对象：%s", async (changes) => {
    const bytes = await textPackageFixture(),
      before = bytes.slice(),
      block = await draft(bytes);
    await expect(
      editPresentationTextPackage(bytes, [edit(block.body, changes)]),
    ).rejects.toThrow("Invalid presentation");
    expect(bytes).toEqual(before);
  });

  it("只接受合并单元格anchor；continuation不映射到另一编辑目标", async () => {
    const bytes = await textPackageFixture(true),
      { snapshot } = await textSnapshot(bytes),
      block = readPresentationTextBlock(snapshot, "512", "7", {
        row: 0,
        column: 0,
      })!;
    replaceStart(block.body, block.blockId, "合并格");
    await expect(
      editPresentationTextPackage(bytes, [edit(block.body, cellTarget)]),
    ).rejects.toThrow("continuation");
    const output = await editPresentationTextPackage(bytes, [
      edit(block.body, {
        ...cellTarget,
        cell: { row: 0, column: 0 },
      }),
    ]);
    expect(
      presentationTextContent(
        presentationTextBody(await textPackagePart(output), "7", {
          row: 0,
          column: 0,
        }),
      ),
    ).toContain("合并格");
  });

  it.each(["field", "math"])(
    "原文包含%s时不允许用合法新正文覆盖",
    async (kind) => {
      const source = await textPackageFixture(),
        block = await draft(source),
        bytes = await modifyTextPackage(source, (document) => {
          const node =
            kind === "field"
              ? document.createElementNS(a, "a:fld")
              : document.createElementNS(
                  "http://schemas.openxmlformats.org/officeDocument/2006/math",
                  "m:oMath",
                );
          document.getElementsByTagNameNS(a, "p")[0].append(node);
        }),
        before = bytes.slice();
      await expect(
        editPresentationTextPackage(bytes, [edit(block.body)]),
      ).rejects.toThrow("unsupported field");
      expect(bytes).toEqual(before);
    },
  );

  it("批次内重复target拒绝，后一项失败不向调用方提交前一项", async () => {
    const bytes = await textPackageFixture(),
      before = bytes.slice(),
      block = await draft(bytes);
    replaceStart(block.body, block.blockId, "pending");
    await expect(
      editPresentationTextPackage(bytes, [edit(block.body), edit(block.body)]),
    ).rejects.toThrow("duplicate text edit target");
    await expect(
      editPresentationTextPackage(bytes, [
        edit(block.body),
        edit(block.body, { slideId: "999" }),
      ]),
    ).rejects.toThrow("missing slide identity");
    expect(bytes).toEqual(before);
  });

  it.each([
    "javascript:alert(1)",
    "file:///tmp/x",
    "data:text/plain,hi",
    "/relative",
    "//example.invalid/x",
    "https://example.invalid/\nnext",
    " https://example.invalid/",
    "https://example.invalid/ ",
  ])("新增链接只接受显式安全URL：%s", async (url) => {
    const bytes = await textPackageFixture(),
      before = bytes.slice(),
      block = await draft(bytes);
    link(block.body, "draft_url");
    await expect(
      editPresentationTextPackage(bytes, [
        edit(block.body, { hyperlinks: [{ id: "draft_url", url }] }),
      ]),
    ).rejects.toThrow("text hyperlink input");
    expect(bytes).toEqual(before);
  });

  it.each([
    "collision",
    "duplicate",
    "unused",
    "missing",
    "wrong-type",
    "mouse-over",
  ])("拒绝无法安全解析的关系映射：%s", async (kind) => {
    const bytes = await textPackageFixture(),
      before = bytes.slice(),
      block = await draft(bytes),
      hyperlinks = [{ id: "draft_link", url: "https://example.invalid/new" }];
    link(block.body, "draft_link");
    if (kind === "collision") {
      hyperlinks[0].id = "rLink";
      link(block.body, "rLink");
    }
    if (kind === "duplicate") hyperlinks.push({ ...hyperlinks[0] });
    if (kind === "unused") hyperlinks[0].id = "draft_unused";
    if (kind === "missing") hyperlinks.length = 0;
    if (kind === "wrong-type") {
      link(block.body, "rId1");
      hyperlinks.length = 0;
    }
    if (kind === "mouse-over") {
      const node = block.body.getElementsByTagNameNS(a, "hlinkClick")[0],
        mouse = block.body.ownerDocument.createElementNS(a, "a:hlinkMouseOver");
      mouse.setAttributeNS(r, "r:id", "draft_link");
      node.replaceWith(mouse);
    }
    await expect(
      editPresentationTextPackage(bytes, [edit(block.body, { hyperlinks })]),
    ).rejects.toThrow("Invalid presentation");
    expect(bytes).toEqual(before);
  });

  it("旧mouseover与不安全关系保留，resolver只暴露安全external hyperlink", async () => {
    const bytes = await modifyTextPackage(
        await textPackageFixture(),
        async (document, zip) => {
          const mouse = document.createElementNS(a, "a:hlinkMouseOver");
          mouse.setAttributeNS(r, "r:id", "rOther");
          document.getElementsByTagNameNS(a, "rPr")[0].append(mouse);
          zip.file(
            textRelationsPath,
            (await zip.file(textRelationsPath)!.async("string")).replace(
              "https://example.invalid/rich",
              "javascript:alert(1)",
            ),
          );
        },
      ),
      block = await draft(bytes);
    expect(block.resolveHyperlink("rLink")).toBeUndefined();
    replaceStart(block.body, block.blockId, "safe edit");
    const output = await editPresentationTextPackage(bytes, [edit(block.body)]);
    await expectOtherPartsRetained(bytes, output, [textSlidePath]);
    const reread = await draft(output);
    expect(
      reread.body
        .getElementsByTagNameNS(a, "hlinkMouseOver")[0]
        .getAttributeNS(r, "id"),
    ).toBe("rOther");
    expect(reread.resolveHyperlink("rOther")).toBe(
      "mailto:rich@example.invalid",
    );
    expect(reread.resolveHyperlink("rLink")).toBeUndefined();
  });

  it.each([undefined, "Internal"])(
    "编辑保留原有slide跳转与action，但不将其暴露为外部URL：%s",
    async (targetMode) => {
      const bytes = await modifyTextPackage(
        await textPackageFixture(),
        async (document, zip) => {
          const jump = document.getElementsByTagNameNS(a, "hlinkClick")[0];
          jump.setAttributeNS(r, "r:id", "rSlideJump");
          jump.setAttribute("action", "ppaction://hlinksldjump");
          const relations = readXml(
            await zip.file(textRelationsPath)!.async("string"),
          );
          const relation = relations.createElementNS(
            relationships,
            "Relationship",
          );
          relation.setAttribute("Id", "rSlideJump");
          relation.setAttribute("Type", `${r}/slide`);
          relation.setAttribute("Target", "slide2.xml");
          if (targetMode) relation.setAttribute("TargetMode", targetMode);
          relations.documentElement.append(relation);
          zip.file(textRelationsPath, serializeTextBody(relations));
        },
      );
      const block = await draft(bytes);
      expect(block.resolveHyperlink("rSlideJump")).toBeUndefined();
      const originalJump = block.body
        .getElementsByTagNameNS(a, "hlinkClick")[0]
        .cloneNode(true);
      replaceStart(block.body, block.blockId, "标题更新");
      const output = await editPresentationTextPackage(bytes, [
        edit(block.body),
      ]);
      await expectOtherPartsRetained(bytes, output, [textSlidePath]);
      const saved = await draft(output);
      expect(
        saved.body
          .getElementsByTagNameNS(a, "hlinkClick")[0]
          .isEqualNode(originalJump),
      ).toBe(true);
      expect(saved.resolveHyperlink("rSlideJump")).toBeUndefined();
      expect(presentationTextContent(saved.body)).toContain("标题更新");
    },
  );

  it("关系XML的重复Id或错误namespace使事务失败，不丢弃既有关系以求保存", async () => {
    for (const invalid of [
      `<Relationships xmlns="${relationships}"><Relationship Id="rLink"/><Relationship Id="rLink"/></Relationships>`,
      '<Relationships xmlns="urn:wrong"/>',
    ]) {
      const bytes = await textPackageFixture(),
        block = await draft(bytes),
        corrupt = await modifyTextPackage(bytes, (_document, zip) => {
          zip.file(textRelationsPath, invalid);
        }),
        before = corrupt.slice();
      replaceStart(block.body, block.blockId, "changed");
      await expect(
        editPresentationTextPackage(corrupt, [edit(block.body)]),
      ).rejects.toThrow("text relationship");
      expect(corrupt).toEqual(before);
    }
  });

  it("未知edit字段不进入提交；原文body的外层属性必须保留", async () => {
    const bytes = await modifyTextPackage(
        await textPackageFixture(),
        (document) => {
          presentationTextBody(document, "2").setAttributeNS(
            "urn:keep",
            "keep:body",
            "retained",
          );
        },
      ),
      block = await draft(bytes);
    replaceStart(block.body, block.blockId, "new");
    const output = await editPresentationTextPackage(bytes, [edit(block.body)]);
    expect(
      presentationTextBody(await textPackagePart(output), "2").getAttributeNS(
        "urn:keep",
        "body",
      ),
    ).toBe("retained");
    await expect(
      editPresentationTextPackage(bytes, [
        { ...edit(block.body), unexpected: true } as PresentationTextEdit,
      ]),
    ).rejects.toThrow("text edit input");
    expect(
      readXml(serializeTextBody(block.body)).documentElement.namespaceURI,
    ).toBe(p);
  });

  it("运行时输入拒绝数值identity、未知symbol字段与非数组批次", async () => {
    const bytes = await textPackageFixture(),
      block = await draft(bytes),
      before = bytes.slice(),
      valid = edit(block.body);
    for (const input of [
      [{ ...valid, slideId: 512 }],
      [{ ...valid, elementId: 2 }],
      [{ ...valid, [Symbol("unknown")]: true }],
      { 0: valid, length: 1 },
      Array.from({ length: 10001 }, () => valid),
    ])
      await expect(
        editPresentationTextPackage(
          bytes,
          input as unknown as PresentationTextEdit[],
        ),
      ).rejects.toThrow("Invalid presentation");
    expect(bytes).toEqual(before);
  });
});
