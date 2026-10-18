import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import {
  assertPresentationElementFixture,
  assertPresentationElementNativeLifecycle,
  assertPresentationElementSave,
  readPresentationElementFile,
  writePresentationElementFixture,
} from "./presentation-element-scenario.mjs";

const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
const slidePath = "ppt/slides/slide1.xml";
const moved = {
  2: [571500, 571500, 8001000, 1143000, 0],
  3: [1333500, 2667000, 1143000, 762000, 0],
  4: [3238500, 2857500, 952500, 762000, 0],
  7: [5334000, 2667000, 2667000, 1333500, 0],
};

async function fixture(run) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "presentation-elements-"),
  );
  try {
    const filePath = path.join(directory, "Elements.pptx");
    const info = await writePresentationElementFixture(filePath);
    await run({
      filePath,
      info,
      before: await readPresentationElementFile(filePath),
      directory,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function modify(filePath, edit) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const dom = new JSDOM(await zip.file(slidePath).async("string"), {
    contentType: "application/xml",
  });
  try {
    await edit(dom.window.document, zip);
    zip.file(
      slidePath,
      new dom.window.XMLSerializer().serializeToString(dom.window.document),
    );
    fs.writeFileSync(filePath, await zip.generateAsync({ type: "uint8array" }));
  } finally {
    dom.window.close();
  }
}

const object = (document, id) =>
  Array.from(document.getElementsByTagNameNS(p, "sp")).find(
    (node) =>
      node.getElementsByTagNameNS(p, "cNvPr")[0].getAttribute("id") === id,
  );
const offset = (document, id, x, y) => {
  const node = object(document, id).getElementsByTagNameNS(a, "off")[0];
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
};

test("independent fixture retains three preview slides, title, distinct shapes/table and unknown ZIP members", async () =>
  fixture(async ({ filePath, info, before, directory }) => {
    assertPresentationElementFixture(before);
    assert.equal(info.sha256, before.sha256);
    assert.deepEqual(info.slideSize, [960, 540]);
    assert.equal(
      fs.readFileSync(path.join(directory, "Broken.pptx"), "utf8"),
      "invalid presentation",
    );
    const original = await JSZip.loadAsync(
      fs.readFileSync(
        "src/components/artifact/presentation/__fixtures__/review.pptx",
      ),
    );
    const current = await JSZip.loadAsync(fs.readFileSync(filePath));
    for (const [name, entry] of Object.entries(original.files)) {
      if (entry.dir || name === slidePath) continue;
      assert.deepEqual(
        await current.file(name).async("uint8array"),
        await entry.async("uint8array"),
        `base fixture part unchanged: ${name}`,
      );
    }
    assert.match(
      await current.file("ppt/slides/slide2.xml").async("string"),
      /SLIDE_PREVIEW_02/,
    );
    assert.match(
      await current.file("ppt/slides/slide3.xml").async("string"),
      /SLIDE_PREVIEW_03/,
    );
    const source = await current.file(slidePath).async("string");
    assert.match(source, /328A64/);
    assert.match(source, /C87932/);
    assert.equal(before.elements["3"].unknown.length, 1);
    assert.equal(before.elements["7"].unknown.length, 4);
    assert.match(source, /urn:slide-keep/);
  }));

test("independent save oracle accepts hand-written move and all four z-order results without touching payloads", async () =>
  fixture(async ({ filePath, before }) => {
    await modify(filePath, (document) => {
      offset(document, "3", 1333500, 2667000);
      offset(document, "4", 3238500, 2857500);
    });
    const after = await readPresentationElementFile(filePath);
    assert.equal(
      assertPresentationElementSave(before, after, moved)
        .preservedObjectContents,
      4,
    );
    for (const order of [
      ["2", "4", "3", "7"],
      ["2", "4", "7", "3"],
      ["2", "4", "3", "7"],
      ["3", "2", "4", "7"],
    ]) {
      await modify(filePath, (document) => {
        const tree = document.getElementsByTagNameNS(p, "spTree")[0];
        const nodes = new Map(
          Array.from(tree.children)
            .filter((node) => ["sp", "graphicFrame"].includes(node.localName))
            .map((node) => [
              node.getElementsByTagNameNS(p, "cNvPr")[0].getAttribute("id"),
              node,
            ]),
        );
        for (const id of order) tree.append(nodes.get(id));
      });
      assertPresentationElementSave(
        before,
        await readPresentationElementFile(filePath),
        moved,
        order,
      );
    }
  }));

test("save oracle rejects non-target geometry, content/unknown/relationship/ZIP mutations", async () =>
  fixture(async ({ filePath, before }) => {
    const input = fs.readFileSync(filePath);
    const edits = [
      (document) => offset(document, "2", 571501, 571500),
      (document) => {
        object(document, "3").getElementsByTagNameNS(a, "t")[0].textContent =
          "lost text";
      },
      (document) => {
        object(document, "3")
          .getElementsByTagNameNS("urn:element-keep", "shape")[0]
          .setAttribute("value", "lost");
      },
      (_, zip) =>
        zip.file("ppt/slides/_rels/slide1.xml.rels", "lost relationships"),
      (_, zip) => zip.remove("ppt/media/element-retained.bin"),
      (document) => {
        document
          .getElementsByTagNameNS("urn:element-keep", "slide")[0]
          .remove();
      },
    ];
    for (const edit of edits) {
      fs.writeFileSync(filePath, input);
      await modify(filePath, async (document, zip) => {
        offset(document, "3", 1333500, 2667000);
        offset(document, "4", 3238500, 2857500);
        await edit(document, zip);
      });
      const readValue = await readPresentationElementFile(filePath);
      assert.throws(() =>
        assertPresentationElementSave(before, readValue, moved),
      );
    }
  }));

test("native quantization tolerance applies only to target frame values, never rotation or the table", async () =>
  fixture(async ({ filePath, before }) => {
    await modify(filePath, (document) => {
      offset(document, "3", 1333501, 2667000);
      offset(document, "4", 3238500, 2857500);
    });
    const after = await readPresentationElementFile(filePath);
    assertPresentationElementSave(before, after, moved, undefined, 1);
    assert.throws(() => assertPresentationElementSave(before, after, moved));
    after.elements["7"].geometry[0]++;
    assert.throws(() =>
      assertPresentationElementSave(before, after, moved, undefined, 38100),
    );
    after.elements["7"].geometry[0]--;
    after.elements["3"].geometry[4]++;
    assert.throws(() =>
      assertPresentationElementSave(before, after, moved, undefined, 38100),
    );
  }));

test("native lifecycle rejects synthetic pointers, missing move, mixed identity and wrong/duplicate terminal", () => {
  const event = (type) => ({
    type,
    isTrusted: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  const good = [event("pointerdown"), event("pointermove"), event("pointerup")];
  assert.equal(
    assertPresentationElementNativeLifecycle(good, "mouse", "pointerup")
      .isTrusted,
    true,
  );
  for (const invalid of [
    good.map((value) => ({ ...value, isTrusted: false })),
    [good[0], good[2]],
    [good[0], { ...good[1], pointerId: 2 }, good[2]],
    [good[0], good[1], event("pointercancel")],
    [...good, event("pointercancel")],
  ])
    assert.throws(() =>
      assertPresentationElementNativeLifecycle(invalid, "mouse", "pointerup"),
    );
  const cancel = good.map((value) => ({
    ...value,
    pointerType: "touch",
    type: value.type === "pointerup" ? "pointercancel" : value.type,
  }));
  assert.equal(
    assertPresentationElementNativeLifecycle(cancel, "touch", "pointercancel")
      .terminal,
    "pointercancel",
  );
});

test("public renderer materializes all four real objects with the independently specified fixture frames", async () =>
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
          parentPort.postMessage(model.slides[0].nodes.map(node => ({ id: node.id, type: node.nodeType, frame: [node.position.x, node.position.y, node.size.w, node.size.h, node.rotation] })));
        } finally { dom.window.close(); }
      })().catch(error => { throw error; });
    `,
        { eval: true, execArgv: [], workerData: filePath },
      );
      worker.once("message", resolve);
      worker.once("error", reject);
      worker.once("exit", (code) => {
        if (code !== 0)
          reject(new Error(`fixture renderer worker exited ${code}`));
      });
    });
    assert.deepEqual(actual, [
      { id: "2", type: "shape", frame: [60, 60, 840, 120, 0] },
      { id: "3", type: "shape", frame: [100, 260, 120, 80, 0] },
      { id: "4", type: "shape", frame: [300, 280, 100, 80, 0] },
      { id: "7", type: "table", frame: [560, 280, 280, 140, 0] },
    ]);
  }));
