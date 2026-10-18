import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { it as test } from "vitest";
import JSZip from "jszip";
import {
  assertPresentationNavigationSave,
  presentationNavigationIo,
  readPresentationNavigationFile,
} from "./presentation-navigation-scenario.mjs";

const fixturePath = path.resolve(
  "src/components/artifact/presentation/__fixtures__/review.pptx",
);
const firstSlide = "ppt/slides/slide1.xml";
const value = "NAVIGATION_SAVED_中文 <&>";
const escapedValue = "NAVIGATION_SAVED_中文 &lt;&amp;&gt;";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function directoryFor(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lime-pptx-navigation-"),
  );
  t.onTestFinished(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

async function writeEdited(filePath, mutate) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  zip.file(
    firstSlide,
    (await zip.file(firstSlide).async("string")).replace(
      "SLIDE_PREVIEW_01",
      escapedValue,
    ),
  );
  if (mutate) await mutate(zip);
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
  return readPresentationNavigationFile(filePath);
}

test("从实际落盘 PPTX 解析 identity、关系、完整转义文字和逐 part 摘要", async (t) => {
  const directory = directoryFor(t);
  const original = await readPresentationNavigationFile(fixturePath);
  assert.deepEqual(
    original.slides.map((slide) => slide.id),
    ["512", "900", "300"],
  );
  assert.deepEqual(
    original.slides.map((slide) => slide.part),
    [firstSlide, "ppt/slides/slide2.xml", "ppt/slides/slide3.xml"],
  );
  assert.equal(original.slides[0].text, "SLIDE_PREVIEW_01");
  assert.equal(original.sha256, digest(fs.readFileSync(fixturePath)));
  const savedPath = path.join(directory, "Review.pptx");
  const saved = await writeEdited(savedPath);
  assert.equal(saved.slides[0].text, value);
  const preservedParts = assertPresentationNavigationSave(
    original,
    saved,
    value,
  );
  assert.equal(preservedParts, Object.keys(original.parts).length - 1);
  assert.throws(
    () => assertPresentationNavigationSave(original, saved, "wrong draft"),
    /full editor value/,
  );
  assert.throws(
    () => assertPresentationNavigationSave(saved, saved, value),
    /saves changed bytes/,
  );
});

test("保存断言拒绝在文字修改中静默覆盖其他页、增加包成员或改变页序", async (t) => {
  const directory = directoryFor(t);
  const before = await readPresentationNavigationFile(fixturePath);
  const corruptedPage = await writeEdited(
    path.join(directory, "Other-page.pptx"),
    async (zip) => {
      const part = "ppt/slides/slide2.xml";
      zip.file(
        part,
        (await zip.file(part).async("string")).replace(
          "SLIDE_PREVIEW_02",
          "UNRELATED_OVERWRITE",
        ),
      );
    },
  );
  assert.throws(
    () => assertPresentationNavigationSave(before, corruptedPage, value),
    /unedited part is unchanged/,
  );
  const addedPart = await writeEdited(
    path.join(directory, "Added.pptx"),
    (zip) => {
      zip.file("customXml/unexpected.xml", "unexpected");
    },
  );
  assert.throws(
    () => assertPresentationNavigationSave(before, addedPart, value),
    assert.AssertionError,
  );
  const reordered = await writeEdited(
    path.join(directory, "Reordered.pptx"),
    async (zip) => {
      const part = "ppt/presentation.xml";
      zip.file(
        part,
        (await zip.file(part).async("string"))
          .replace('id="512"', 'id="temporary"')
          .replace('id="900"', 'id="512"')
          .replace('id="temporary"', 'id="900"'),
      );
    },
  );
  assert.throws(
    () => assertPresentationNavigationSave(before, reordered, value),
    assert.AssertionError,
  );
});

test("源包读取拒绝缺失页、外链页、越界关系和损坏 XML", async (t) => {
  const directory = directoryFor(t);
  const mutations = [
    ["missing", (zip) => zip.remove(firstSlide), /PPTX part exists/],
    [
      "external",
      async (zip) => {
        const part = "ppt/_rels/presentation.xml.rels";
        zip.file(
          part,
          (await zip.file(part).async("string")).replace(
            'Target="slides/slide1.xml"',
            'Target="https://example.invalid/slide.xml" TargetMode="External"',
          ),
        );
      },
      assert.AssertionError,
    ],
    [
      "escape",
      async (zip) => {
        const part = "ppt/_rels/presentation.xml.rels";
        zip.file(
          part,
          (await zip.file(part).async("string")).replace(
            'Target="slides/slide1.xml"',
            'Target="../../outside.xml"',
          ),
        );
      },
      /inside PPTX/,
    ],
    [
      "xml",
      (zip) => zip.file(firstSlide, "<p:sld>broken"),
      /SyntaxError|unbound namespace|unexpected end/,
    ],
  ];
  for (const [name, mutate, failure] of mutations)
    await assert.rejects(
      writeEdited(path.join(directory, `${name}.pptx`), mutate),
      failure,
    );
  const brokenPath = path.join(directory, "Broken.pptx");
  fs.writeFileSync(brokenPath, "invalid presentation");
  await assert.rejects(readPresentationNavigationFile(brokenPath));
});

test("IO 证据仅计入匹配文件的成功真实 Electron JSON-RPC 请求", () => {
  const filePath = "/fixture/Review.pptx";
  const row = (method, extras = {}, requestPath = filePath) => ({
    transport: "electron-ipc",
    command: "app_server_handle_json_lines",
    status: "success",
    args_preview: {
      request: {
        lines: [
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method,
            params: { path: requestPath },
          }),
        ],
      },
    },
    ...extras,
  });
  const trace = [
    row("fs/readFile"),
    row("fs/readFile"),
    row("fs/writeFile"),
    row("fs/readFile", {}, "/fixture/Other.pptx"),
    row("fs/writeFile", { transport: "http" }),
    row("fs/writeFile", { status: "error" }),
    row("fs/writeFile", { command: "old-facade" }),
    row("thread/read"),
  ];
  assert.deepEqual(presentationNavigationIo(trace, filePath), {
    read: 2,
    write: 1,
  });
  assert.deepEqual(presentationNavigationIo(trace, "/not-selected.pptx"), {
    read: 0,
    write: 0,
  });
  assert.throws(
    () =>
      presentationNavigationIo(
        [
          row("fs/readFile", {
            args_preview: { request: { lines: ["malformed RPC"] } },
          }),
        ],
        filePath,
      ),
    SyntaxError,
  );
});
