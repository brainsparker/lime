import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import {
  assertPresentationRichTextCommit,
  assertPresentationRichTextFixture,
  assertPresentationRichTextSave,
  readPresentationRichTextFile,
  withPresentationRichTextClipboard,
  writePresentationRichTextFixture,
} from "./presentation-rich-text-scenario.mjs";
import {
  richRelationsPath,
  richSlidePath,
  richOriginalText,
  richEditedText,
  richPastedText,
  richPasteUrl,
  richParagraphOriginalText,
  richParagraphShapeId,
  assertPresentationRichParagraphDom,
} from "./presentation-rich-text-scenario-oracle.mjs";

const a = "http://schemas.openxmlformats.org/drawingml/2006/main",
  p = "http://schemas.openxmlformats.org/presentationml/2006/main",
  r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const originalState = { shape: "original", cell: "original" },
  shapeState = { shape: "edited", cell: "original" },
  pastedState = { shape: "edited", cell: "pasted" };
const children = (parent, name) =>
  Array.from(parent?.children ?? []).filter(
    (child) => child.namespaceURI === a && child.localName === name,
  );
const shape = (document) =>
  Array.from(document.getElementsByTagNameNS(p, "sp")).find(
    (node) =>
      node.getElementsByTagNameNS(p, "cNvPr")[0].getAttribute("id") === "3",
  );
const shapeBody = (document) =>
  shape(document).getElementsByTagNameNS(p, "txBody")[0];
const cellBody = (document) =>
  document
    .getElementsByTagNameNS(a, "tc")[0]
    .getElementsByTagNameNS(a, "txBody")[0];

async function fixture(perform) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "presentation-rich-text-"),
  );
  try {
    const filePath = path.join(directory, "Rich text.pptx"),
      info = await writePresentationRichTextFixture(filePath),
      before = await readPresentationRichTextFile(filePath);
    await perform({ filePath, directory, info, before });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function modify(filePath, perform) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath)),
    dom = new JSDOM(await zip.file(richSlidePath).async("string"), {
      contentType: "application/xml",
    });
  try {
    await perform(dom.window.document, zip);
    zip.file(
      richSlidePath,
      new dom.window.XMLSerializer().serializeToString(dom.window.document),
    );
    fs.writeFileSync(filePath, await zip.generateAsync({ type: "uint8array" }));
  } finally {
    dom.window.close();
  }
}

// 手工定义最终OPC，不调用任何生产编辑器/范围/样式/保存helper。
function shapeEdit(document) {
  const body = shapeBody(document),
    paragraphs = children(body, "p"),
    first = children(paragraphs[0], "r"),
    latin = children(first[0], "t")[0],
    han = children(first[1], "t")[0],
    property = children(first[1], "rPr")[0];
  latin.textContent = "Lime ";
  han.textContent = "中文";
  property.setAttribute("b", "1");
  property
    .getElementsByTagNameNS(a, "srgbClr")[0]
    .setAttribute("val", "9B2C2C");
  const last = paragraphs[2].cloneNode(true),
    run = children(last, "r")[0],
    end = children(last, "endParaRPr")[0];
  children(run, "t")[0].textContent = "Hard";
  const br = document.createElementNS(a, "a:br"),
    soft = run.cloneNode(true);
  br.append(children(run, "rPr")[0].cloneNode(true));
  children(soft, "t")[0].textContent = "Soft";
  last.insertBefore(br, end);
  last.insertBefore(soft, end);
  body.append(last);
}

async function cellPaste(document, zip) {
  const parsed = new JSDOM(
    `<root xmlns:a="${a}" xmlns:r="${r}"><a:p><a:r><a:rPr b="1"/><a:t>HTML_BOLD</a:t></a:r><a:r><a:t xml:space="preserve"> </a:t></a:r><a:r><a:rPr i="1"/><a:t>HTML_ITALIC</a:t></a:r></a:p><a:p><a:pPr lvl="0"><a:buChar char="•"/></a:pPr><a:r><a:t>HTML_LIST</a:t></a:r></a:p><a:p><a:r><a:rPr><a:hlinkClick r:id="rAddedByNative"/></a:rPr><a:t>HTML_LINK</a:t></a:r></a:p></root>`,
    { contentType: "application/xml" },
  );
  try {
    for (const paragraph of Array.from(
      parsed.window.document.documentElement.children,
    ))
      cellBody(document).append(document.importNode(paragraph, true));
  } finally {
    parsed.window.close();
  }
  zip.file(
    richRelationsPath,
    (await zip.file(richRelationsPath).async("string")).replace(
      "</Relationships>",
      `<Relationship Id="rAddedByNative" Type="${r}/hyperlink" Target="${richPasteUrl}" TargetMode="External"/></Relationships>`,
    ),
  );
}

test("independent rich fixture preserves all three preview labels/title2, real shape3/cell0:0 and unknown original parts", async () =>
  fixture(async ({ filePath, directory, info, before }) => {
    assertPresentationRichTextFixture(before);
    assert.equal(before.sha256, info.sha256);
    assert.equal(
      fs.readFileSync(path.join(directory, "Broken.pptx"), "utf8"),
      "invalid presentation",
    );
    const base = await JSZip.loadAsync(
        fs.readFileSync(
          "src/components/artifact/presentation/__fixtures__/review.pptx",
        ),
      ),
      current = await JSZip.loadAsync(fs.readFileSync(filePath));
    for (const [name, entry] of Object.entries(base.files)) {
      if (entry.dir || [richSlidePath, richRelationsPath].includes(name))
        continue;
      assert.deepEqual(
        await current.file(name).async("uint8array"),
        await entry.async("uint8array"),
        `original ZIP member retained: ${name}`,
      );
    }
    assert.equal(before.blocks.shape.text, richOriginalText);
    assert.equal(before.blocks.cell.text, richOriginalText);
    assert.equal(info.paragraphShapeId, "11");
    assert.equal(before.paragraphProbe.text, richParagraphOriginalText);
    assert.equal(before.blocks.shape.paragraphs[0].runs[0].bold, false);
    assert.equal(before.blocks.shape.paragraphs[0].runs[1].italic, true);
    assert.match(
      await current.file(richSlidePath).async("string"),
      /marL="321" indent="-12"/,
    );
  }));

test("independent paragraph probe retains raw spacing/list XML and is guarded against all unrelated saves", async () =>
  fixture(async ({ filePath, before }) => {
    const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
    const dom = new JSDOM(await zip.file(richSlidePath).async("string"), {
      contentType: "application/xml",
    });
    try {
      const node = Array.from(
        dom.window.document.getElementsByTagNameNS(p, "sp"),
      ).find(
        (node) =>
          node.getElementsByTagNameNS(p, "cNvPr")[0].getAttribute("id") ===
          richParagraphShapeId,
      );
      const body = node.getElementsByTagNameNS(p, "txBody")[0];
      const paragraphs = children(body, "p");
      const properties = paragraphs.map(
        (paragraph) => children(paragraph, "pPr")[0],
      );
      assert.equal(paragraphs.length, 5);
      assert.equal(
        properties[0]
          .getElementsByTagNameNS(a, "lnSpc")[0]
          .getElementsByTagNameNS(a, "spcPct")[0]
          .getAttribute("val"),
        "175000",
      );
      assert.equal(
        properties[0]
          .getElementsByTagNameNS(a, "spcAft")[0]
          .getElementsByTagNameNS(a, "spcPct")[0]
          .getAttribute("val"),
        "150000",
      );
      assert.equal(
        properties[1]
          .getElementsByTagNameNS(a, "lnSpc")[0]
          .getElementsByTagNameNS(a, "spcPts")[0]
          .getAttribute("val"),
        "2400",
      );
      assert.deepEqual(
        properties.map((property) => property.getAttribute("lvl")),
        ["0", "0", "1", "1", "0"],
      );
      assert.deepEqual(
        properties.map((property) => attributesForNumber(property)),
        [
          ["arabicPeriod", "4"],
          ["arabicPeriod", null],
          ["alphaLcPeriod", "3"],
          ["alphaLcPeriod", null],
          ["arabicPeriod", null],
        ],
      );
      for (const property of node.getElementsByTagNameNS(a, "rPr"))
        assert.equal(property.getAttribute("sz"), "1200");
    } finally {
      dom.window.close();
    }
    await modify(filePath, (document) => {
      const probe = Array.from(document.getElementsByTagNameNS(p, "sp")).find(
        (node) =>
          node.getElementsByTagNameNS(p, "cNvPr")[0].getAttribute("id") ===
          richParagraphShapeId,
      );
      probe.getElementsByTagNameNS(a, "t")[0].textContent = "MUST_NOT_COMMIT";
    });
    const changed = await readPresentationRichTextFile(filePath);
    assert.throws(
      () => assertPresentationRichTextSave(before, changed, originalState),
      /paragraph probe/,
    );
  }));

function attributesForNumber(property) {
  const number = property.getElementsByTagNameNS(a, "buAutoNum")[0];
  return [number.getAttribute("type"), number.getAttribute("startAt")];
}

test("Chromium paragraph DOM contract rejects wrong lh/pt conversions, broken counters, marker text and polluted native offsets", () => {
  // 手写观察值只校验oracle；实际computed CSS/原生Selection由Electron runner采集。
  const state = {
    active: true,
    focused: true,
    text: "A\nB\nC\nD\nE",
    selectedPlainText: "A\nB\nC\nD\nE",
    editorTextContent: "ABCDE",
    editorChildCount: 5,
    markerMarkupCount: 0,
    anchor: { offset: 0 },
    caret: { offset: 9 },
    paragraphs: ["A", "B", "C", "D", "E"].map((text, index) => {
      const list = {
        display: "list-item",
        listStylePosition: "inside",
        listStyleType: [
          "decimal",
          "decimal",
          "lower-alpha",
          "lower-alpha",
          "decimal",
        ][index],
        counterSet: [
          "list-item 4",
          "list-item 5",
          "list-item 3",
          "list-item 4",
          "list-item 6",
        ][index],
      };
      return {
        runs: [{ text }],
        inlineStyle: {
          ...list,
          lineHeight: index === 0 ? "1.75" : index === 1 ? "24pt" : "",
          marginBottom: index === 0 ? "1.5lh" : "",
          marginTop: index === 1 ? "1lh" : "",
        },
        computedStyle: {
          ...list,
          fontSize: "16px",
          lineHeight: index === 0 ? "28px" : index === 1 ? "32px" : "normal",
          marginBottom: index === 0 ? "42px" : "0px",
          marginTop: index === 1 ? "32px" : "0px",
        },
      };
    }),
  };
  const result = assertPresentationRichParagraphDom(state);
  assert.deepEqual(result.counters, [4, 5, 3, 4, 6]);
  assert.deepEqual(result.nativeTextOffsets, [0, 9]);
  for (const mutate of [
    (state) => {
      state.paragraphs[0].inlineStyle.marginBottom = "150%";
    },
    (state) => {
      state.paragraphs[0].computedStyle.marginBottom = "24px";
    },
    (state) => {
      state.paragraphs[0].computedStyle.lineHeight = "20px";
    },
    (state) => {
      state.paragraphs[1].computedStyle.lineHeight = "24px";
    },
    (state) => {
      state.paragraphs[4].computedStyle.counterSet = "list-item 5";
    },
    (state) => {
      state.paragraphs[2].inlineStyle.listStyleType = "decimal";
    },
    (state) => {
      state.paragraphs[1].runs[0].text = "5. B";
    },
    (state) => {
      state.editorTextContent = "4. A5. Bc. Cd. D6. E";
    },
    (state) => {
      state.markerMarkupCount = 5;
    },
    (state) => {
      state.selectedPlainText = "4. A\n5. B\nc. C\nd. D\n6. E";
    },
    (state) => {
      state.caret.offset = 19;
    },
  ]) {
    const invalid = structuredClone(state);
    mutate(invalid);
    assert.throws(() => assertPresentationRichParagraphDom(invalid));
  }
});

test("independent handwritten shape/plain deletion/paragraph/softbreak and HTML/list/link package states pass the oracle", async () =>
  fixture(async ({ filePath, before }) => {
    assertPresentationRichTextSave(before, before, originalState);
    await modify(filePath, shapeEdit);
    const edited = await readPresentationRichTextFile(filePath);
    assertPresentationRichTextSave(before, edited, shapeState);
    assert.equal(edited.blocks.shape.text, richEditedText);
    await modify(filePath, cellPaste);
    const pasted = await readPresentationRichTextFile(filePath);
    assertPresentationRichTextSave(before, pasted, pastedState);
    assert.equal(pasted.blocks.cell.text, richPastedText);
    assert.equal(pasted.blocks.cell.paragraphs.length, 6);
  }));

test("shape oracle rejects full-body styling, incorrect Unicode deletion, hard/softbreak substitution and metadata damage", async () =>
  fixture(async ({ filePath, before }) => {
    const bytes = fs.readFileSync(filePath);
    for (const mutation of [
      (document) => {
        for (const property of shapeBody(document).getElementsByTagNameNS(
          a,
          "rPr",
        ))
          property.setAttribute("b", "1");
      },
      (document) => {
        shapeBody(document).getElementsByTagNameNS(a, "t")[1].textContent =
          "中😀文";
      },
      (document) => {
        const body = shapeBody(document);
        body.getElementsByTagNameNS(a, "br")[1].remove();
      },
      (document) => {
        shapeBody(document)
          .getElementsByTagNameNS(a, "spcPts")[0]
          .setAttribute("val", "999");
      },
      (document) => {
        shapeBody(document)
          .getElementsByTagNameNS("urn:rich-keep", "run")[0]
          .remove();
      },
      (document) => {
        shapeBody(document)
          .getElementsByTagNameNS(a, "rPr")[1]
          .removeAttribute("custom");
      },
      (document) => {
        shapeBody(document)
          .getElementsByTagNameNS(a, "endParaRPr")[0]
          .removeAttribute("custom");
      },
    ]) {
      fs.writeFileSync(filePath, bytes);
      await modify(filePath, (document) => {
        shapeEdit(document);
        mutation(document);
      });
      const after = await readPresentationRichTextFile(filePath);
      assert.throws(() =>
        assertPresentationRichTextSave(before, after, shapeState),
      );
    }
  }));

test("save oracle rejects non-target geometry/cell/body root/ZIP changes and original link replacement", async () =>
  fixture(async ({ filePath, before }) => {
    const bytes = fs.readFileSync(filePath);
    for (const mutation of [
      (document) => {
        shape(document)
          .getElementsByTagNameNS(a, "off")[0]
          .setAttribute("x", "1");
      },
      (document) => {
        document
          .getElementsByTagNameNS(a, "tc")[1]
          .getElementsByTagNameNS(a, "t")[0].textContent = "changed non-target";
      },
      (document) => {
        shapeBody(document).setAttribute("changed", "yes");
      },
      (document) => {
        children(shapeBody(document), "bodyPr")[0].setAttribute("wrap", "none");
      },
      (_document, zip) => {
        zip.remove("ppt/media/rich-retained.bin");
      },
      async (_document, zip) => {
        zip.file(
          richRelationsPath,
          (await zip.file(richRelationsPath).async("string")).replace(
            "example.invalid/original-rich",
            "example.invalid/hijacked",
          ),
        );
      },
    ]) {
      fs.writeFileSync(filePath, bytes);
      await modify(filePath, async (document, zip) => {
        shapeEdit(document);
        await mutation(document, zip);
      });
      const after = await readPresentationRichTextFile(filePath);
      assert.throws(() =>
        assertPresentationRichTextSave(before, after, shapeState),
      );
    }
  }));

test("paste oracle rejects plain-only HTML fallback, lost lists, dangling/new duplicate links and lost original metadata", async () =>
  fixture(async ({ filePath, before }) => {
    const bytes = fs.readFileSync(filePath);
    for (const mutation of [
      (document) => {
        const run = cellBody(document).getElementsByTagNameNS(a, "r");
        Array.from(run)
          .find((run) => run.textContent === "HTML_BOLD")
          .getElementsByTagNameNS(a, "rPr")[0]
          .removeAttribute("b");
      },
      (document) => {
        children(cellBody(document), "p")[4]
          .getElementsByTagNameNS(a, "buChar")[0]
          .remove();
      },
      (document) => {
        Array.from(cellBody(document).getElementsByTagNameNS(a, "hlinkClick"))
          .find((link) => link.getAttributeNS(r, "id") === "rAddedByNative")
          .setAttributeNS(r, "r:id", "rMissing");
      },
      (document) => {
        cellBody(document)
          .getElementsByTagNameNS("urn:rich-keep", "paragraph")[0]
          .remove();
      },
      async (_document, zip) => {
        zip.file(
          richRelationsPath,
          (await zip.file(richRelationsPath).async("string")).replace(
            richPasteUrl,
            "javascript:alert(1)",
          ),
        );
      },
      async (_document, zip) => {
        zip.file(
          richRelationsPath,
          (await zip.file(richRelationsPath).async("string")).replace(
            "</Relationships>",
            `<Relationship Id="rExtra" Type="${r}/hyperlink" Target="https://example.invalid/unused" TargetMode="External"/></Relationships>`,
          ),
        );
      },
    ]) {
      fs.writeFileSync(filePath, bytes);
      await modify(filePath, async (document, zip) => {
        shapeEdit(document);
        await cellPaste(document, zip);
        await mutation(document, zip);
      });
      const after = await readPresentationRichTextFile(filePath);
      assert.throws(() =>
        assertPresentationRichTextSave(before, after, pastedState),
      );
    }
  }));

test("single-commit oracle requires exactly two reads and one write, rejecting missing source recheck and duplicate saves", () => {
  assert.deepEqual(
    assertPresentationRichTextCommit(
      { read: 10, write: 4 },
      { read: 12, write: 5 },
      "single",
    ),
    { read: 2, write: 1 },
  );
  for (const invalid of [
    { read: 11, write: 5 },
    { read: 12, write: 6 },
    { read: 14, write: 6 },
    { read: 12, write: 4 },
  ])
    assert.throws(() =>
      assertPresentationRichTextCommit(
        { read: 10, write: 4 },
        invalid,
        "wrong-boundary",
      ),
    );
});

function clipboardApp(
  initial = { text: "PRIVATE_TEST_TEXT", html: "<p>PRIVATE_TEST_HTML</p>" },
) {
  let data = { ...initial },
    writes = 0;
  const clipboard = {
    availableFormats: () =>
      Object.keys(data).map(
        (key) =>
          ({
            text: "text/plain",
            html: "text/html",
            rtf: "text/rtf",
            custom: "application/x-private",
          })[key],
      ),
    readText: () => data.text ?? "",
    readHTML: () => data.html ?? "",
    readRTF: () => data.rtf ?? "",
    clear: () => {
      data = {};
    },
    write: (value) => {
      data = { ...value };
      writes++;
    },
  };
  return {
    clipboard,
    evaluate: async (callback, argument) => callback({ clipboard }, argument),
    snapshot: () => ({ ...data }),
    writes: () => writes,
  };
}

test("native clipboard wrapper backs up/restores privately on success and callback failure, with no content evidence", async () => {
  for (const throws of [false, true]) {
    const app = clipboardApp(),
      before = app.snapshot();
    const promise = withPresentationRichTextClipboard(app, async () => {
      assert.match(app.snapshot().html, /<strong>HTML_BOLD<\/strong>/);
      if (throws) throw new Error("native callback failed");
      return { nativePaste: true };
    });
    if (throws) await assert.rejects(promise, /native callback failed/);
    else assert.deepEqual(await promise, { nativePaste: true });
    assert.deepEqual(app.snapshot(), before);
    assert.equal(app.writes(), 2);
  }
});

test("unsupported/absent/uncontrollable native clipboard fails closed without dispatching a synthetic paste", async () => {
  let performed = false;
  await assert.rejects(
    withPresentationRichTextClipboard({}, async () => {
      performed = true;
    }),
    /real Electron main clipboard API/,
  );
  const unsupported = clipboardApp({ custom: "PRIVATE_CUSTOM" });
  await assert.rejects(
    withPresentationRichTextClipboard(unsupported, async () => {
      performed = true;
    }),
    /unsupported formats/,
  );
  assert.equal(unsupported.writes(), 0);
  const unavailable = clipboardApp({});
  unavailable.clipboard.write = () => {};
  await assert.rejects(
    withPresentationRichTextClipboard(unavailable, async () => {
      performed = true;
    }),
    /native clipboard HTML\/plain roundtrip failed/,
  );
  assert.equal(performed, false);
});

test("public renderer materializes the independent rich shape/table geometry and original three slides", async () =>
  fixture(async ({ filePath }) => {
    const actual = await new Promise((resolve, reject) => {
      const worker = new Worker(
        String.raw`
      const { parentPort, workerData } = require("node:worker_threads");
      const fs = require("node:fs");
      const { JSDOM } = require("jsdom");
      (async () => {
        const dom = new JSDOM("");
        try {
          globalThis.DOMParser = dom.window.DOMParser;
          globalThis.XMLSerializer = dom.window.XMLSerializer;
          const { parseZip, buildPresentation, materializeSlideNodes } = await import("@aiden0z/pptx-renderer");
          const bytes = fs.readFileSync(workerData);
          const model = buildPresentation(await parseZip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
          materializeSlideNodes(model, model.slides[0]);
          parentPort.postMessage({slides:model.slides.length, nodes:model.slides[0].nodes.map(node => ({ id:node.id, type:node.nodeType, frame:[node.position.x,node.position.y,node.size.w,node.size.h,node.rotation] }))});
        } finally { dom.window.close(); }
      })().catch(error => { throw error; });
    `,
        { eval: true, execArgv: [], workerData: filePath },
      );
      worker.once("message", resolve);
      worker.once("error", reject);
      worker.once("exit", (code) => {
        if (code !== 0)
          reject(new Error(`rich fixture renderer worker exited ${code}`));
      });
    });
    assert.deepEqual(actual, {
      slides: 3,
      nodes: [
        { id: "2", type: "shape", frame: [60, 60, 840, 120, 0] },
        { id: "3", type: "shape", frame: [40, 210, 420, 260, 0] },
        { id: "7", type: "table", frame: [500, 210, 400, 260, 0] },
        { id: "11", type: "shape", frame: [40, 475, 880, 60, 0] },
      ],
    });
  }));
