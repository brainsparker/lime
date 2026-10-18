import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import {
  createArtifactFrameDriver,
  waitForArtifactFileRead,
} from "./artifact-frame-driver.mjs";
import {
  presentationFrameSelector,
  waitForPresentationSlide,
} from "./presentation-preview-scenario.mjs";
import { presentationTextEditorMatches } from "./presentation-text-editor-dom.mjs";

const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rel = "http://schemas.openxmlformats.org/package/2006/relationships";
const timeout = 15_000;
const originalIds = ["512", "900", "300"];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** 只解析本场景要核对的源包 identity、文字与逐 part 摘要，不启动渲染器。 */
export async function readPresentationNavigationFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const xml = async (part) => {
    const entry = zip.file(part);
    assert.ok(entry, `PPTX part exists: ${part}`);
    const dom = new JSDOM(await entry.async("string"), {
      contentType: "application/xml",
    });
    try {
      return dom.window.document.cloneNode(true);
    } finally {
      dom.window.close();
    }
  };
  const presentation = await xml("ppt/presentation.xml");
  const relationships = await xml("ppt/_rels/presentation.xml.rels");
  assert.equal(presentation.documentElement.namespaceURI, p);
  assert.equal(relationships.documentElement.namespaceURI, rel);
  const targets = new Map(
    Array.from(relationships.getElementsByTagNameNS(rel, "Relationship"))
      .filter((node) => node.getAttribute("Type") === `${r}/slide`)
      .map((node) => {
        assert.notEqual(node.getAttribute("TargetMode"), "External");
        const target = node.getAttribute("Target");
        assert.ok(target && !target.startsWith("/") && !target.includes("\\"));
        const part = path.posix.normalize(path.posix.join("ppt", target));
        assert.ok(part.startsWith("ppt/"), "slide relation stays inside PPTX");
        return [node.getAttribute("Id"), part];
      }),
  );
  const parts = {};
  for (const [name, entry] of Object.entries(zip.files))
    if (!entry.dir) parts[name] = digest(await entry.async("uint8array"));
  const slides = [];
  for (const node of presentation.getElementsByTagNameNS(p, "sldId")) {
    const id = node.getAttribute("id");
    assert.match(id, /^\d+$/);
    const part = targets.get(node.getAttributeNS(r, "id"));
    assert.ok(part, `slide ${id} has an internal relationship`);
    const document = await xml(part);
    assert.equal(document.documentElement.namespaceURI, p);
    slides.push({
      id,
      part,
      text: Array.from(
        document.getElementsByTagNameNS(a, "t"),
        (text) => text.textContent,
      ).join("\n"),
      xmlSha256: parts[part],
    });
  }
  assert.ok(slides.length > 0, "presentation contains slides");
  assert.equal(new Set(slides.map((slide) => slide.id)).size, slides.length);
  assert.equal(new Set(slides.map((slide) => slide.part)).size, slides.length);
  return { sha256: digest(bytes), parts, slides };
}

/** 文字修改只允许改选定页；其他 ZIP part 和三页 identity 均保留。 */
export function assertPresentationNavigationSave(before, after, value) {
  assert.deepEqual(
    after.slides.map((slide) => slide.id),
    originalIds,
  );
  assert.deepEqual(
    after.slides.map((slide) => [slide.id, slide.part]),
    before.slides.map((slide) => [slide.id, slide.part]),
  );
  const edited = after.slides.find((slide) => slide.id === "512");
  assert.equal(
    edited.text,
    value,
    "saved source contains the full editor value",
  );
  assert.notEqual(
    after.sha256,
    before.sha256,
    "navigation saves changed bytes",
  );
  assert.notEqual(edited.xmlSha256, before.parts[edited.part]);
  assert.deepEqual(
    Object.keys(after.parts).sort(),
    Object.keys(before.parts).sort(),
  );
  let preservedParts = 0;
  for (const [part, sha256] of Object.entries(before.parts)) {
    if (part === edited.part) continue;
    assert.equal(
      after.parts[part],
      sha256,
      `unedited part is unchanged: ${part}`,
    );
    preservedParts++;
  }
  return preservedParts;
}

export function presentationNavigationIo(trace, filePath) {
  const counts = { read: 0, write: 0 };
  for (const row of trace) {
    if (
      row.transport !== "electron-ipc" ||
      row.command !== "app_server_handle_json_lines" ||
      row.status !== "success"
    )
      continue;
    for (const line of row.args_preview?.request?.lines ?? []) {
      const request = JSON.parse(line);
      if (request.params?.path !== filePath) continue;
      if (request.method === "fs/readFile") counts.read++;
      if (request.method === "fs/writeFile") counts.write++;
    }
  }
  return counts;
}

/** 捕获目标窗口的真实 DownloadItem；输出只写证据目录，监听器始终原样撤销。 */
async function capturePresentationDownload({ app, page, savePath }, action) {
  assert.ok(app, "download evidence requires the real ElectronApplication");
  assert.equal(
    fs.existsSync(savePath),
    false,
    "download evidence has no stale file",
  );
  const captureKey = "__limePresentationNavigationDownload";
  const window = await app.browserWindow(page);
  let contentsId;
  try {
    contentsId = await window.evaluate((window) => window.webContents.id);
  } finally {
    await window.dispose();
  }
  await app.evaluate(
    ({ webContents }, { captureKey, contentsId, savePath, timeout }) => {
      if (globalThis[captureKey])
        throw new Error("download capture already exists");
      const contents = webContents.fromId(contentsId);
      if (!contents || contents.isDestroyed())
        throw new Error("download target is unavailable");
      const session = contents.session;
      const capture = {
        session,
        count: 0,
        item: null,
        listenerCount: session.listenerCount("will-download"),
        finished: false,
      };
      capture.done = new Promise((resolve) => {
        capture.resolve = resolve;
      });
      capture.finish = (result) => {
        if (capture.finished) return;
        capture.finished = true;
        clearTimeout(capture.timer);
        capture.resolve(result);
      };
      capture.listener = (_event, item, source) => {
        if (source?.id !== contentsId) return;
        capture.count++;
        if (capture.item) {
          item.cancel();
          capture.finish({ state: "duplicate", count: capture.count });
          return;
        }
        capture.item = item;
        try {
          item.setSavePath(savePath);
          capture.onDone = (_event, state) => {
            capture.itemDone = true;
            capture.finish({
              state,
              filename: item.getFilename(),
              savePath: item.getSavePath(),
              receivedBytes: item.getReceivedBytes(),
              totalBytes: item.getTotalBytes(),
              sourceScheme: item.getURL().split(":", 1)[0],
              contentsId,
            });
          };
          item.once("done", capture.onDone);
        } catch (error) {
          item.cancel();
          capture.finish({ state: "capture-failed", message: String(error) });
        }
      };
      capture.timer = setTimeout(
        () => capture.finish({ state: "timed-out" }),
        timeout,
      );
      globalThis[captureKey] = capture;
      session.on("will-download", capture.listener);
    },
    { captureKey, contentsId, savePath, timeout },
  );
  let result;
  let cleanup;
  try {
    await action();
    result = await app.evaluate(async (_electron, captureKey) => {
      const capture = globalThis[captureKey];
      if (!capture) throw new Error("download capture is missing");
      return capture.done;
    }, captureKey);
    assert.equal(
      result.state,
      "completed",
      "the actual Electron download completed",
    );
    assert.equal(result.savePath, savePath);
  } finally {
    cleanup = await app.evaluate((_electron, captureKey) => {
      const capture = globalThis[captureKey];
      if (!capture) throw new Error("download capture cleanup is missing");
      clearTimeout(capture.timer);
      capture.session.removeListener("will-download", capture.listener);
      if (capture.item && capture.onDone)
        capture.item.removeListener("done", capture.onDone);
      if (capture.item && !capture.itemDone) capture.item.cancel();
      const result = {
        capturedDownloads: capture.count,
        listenerRemoved: !capture.session
          .listeners("will-download")
          .includes(capture.listener),
        listenerCountBefore: capture.listenerCount,
        listenerCountAfter: capture.session.listenerCount("will-download"),
      };
      delete globalThis[captureKey];
      return result;
    }, captureKey);
    assert.equal(cleanup.listenerRemoved, true);
    assert.equal(cleanup.listenerCountAfter, cleanup.listenerCountBefore);
  }
  assert.equal(
    cleanup.capturedDownloads,
    1,
    "one native download belongs to this action",
  );
  return { ...result, ...cleanup };
}

/** 保持原生编辑器活动后离开，证明保存门禁与真实文件/IPC 的闭环。 */
export async function runPresentationNavigationScenario({
  app,
  page,
  evidenceDir,
  filePath,
  readTrace,
}) {
  const panel = page.getByTestId("presentation-panel");
  const controls = panel.getByTestId("presentation-editing-controls");
  const toggle = page.getByTestId("task-center-workbench-toggle");
  const close = page.getByTestId("canvas-workbench-header-row").locator("..");
  const frame = createArtifactFrameDriver(page, presentationFrameSelector);
  const counts = async () =>
    presentationNavigationIo(await readTrace(), filePath);
  const fileButton = () =>
    page
      .getByTestId("canvas-workbench-panel-workspace")
      .getByTitle(path.basename(filePath), { exact: true });
  const waitReady = async (sha256, value) => {
    await waitForPresentationSlide(page, "512");
    const state = await page.waitForFunction(
      ({ sha256, value }) => {
        const panel = document.querySelector(
          '[data-testid="presentation-panel"]',
        );
        const controls = panel?.querySelector(
          '[data-testid="presentation-editing-controls"]',
        );
        const slide = panel
          ?.querySelector("iframe")
          ?.contentDocument?.querySelector('[data-slide-id="512"]');
        return (
          panel?.getAttribute("data-source-sha256") === sha256 &&
          controls?.getAttribute("data-dirty") === "false" &&
          controls.getAttribute("data-saving") === "false" &&
          slide?.textContent?.includes(value)
        );
      },
      { sha256, value },
      { timeout },
    );
    await state.dispose();
  };
  const selectFile = async (minimumReads = 1) => {
    const before = await counts();
    const previous = (await panel.count()) ? await panel.elementHandle() : null;
    await fileButton().click();
    const after = await waitForArtifactFileRead(
      async () => (await counts()).read,
      before.read + minimumReads - 1,
      timeout,
    );
    const panelReplaced = previous
      ? !(await previous.evaluate((node) => node.isConnected))
      : null;
    await previous?.dispose();
    return { panelReplaced, sourceReads: after - before.read };
  };
  const newFileTab = async () => {
    const previousTab = await currentTab();
    await page.getByTestId("canvas-workbench-tab-menu-trigger").click();
    await page
      .getByRole("menuitem", { name: "新建工作台标签-文件", exact: true })
      .click();
    const selected = await page.waitForFunction(
      (previousTab) => {
        const node = document.querySelector(
          '[data-testid="canvas-workbench-top-tabs"] [role="tab"][aria-selected="true"]',
        );
        const key = node
          ?.closest("[data-canvas-tab-key]")
          ?.getAttribute("data-canvas-tab-key");
        return !!key && key !== previousTab;
      },
      previousTab,
      { timeout },
    );
    await selected.dispose();
  };
  const open = async (saved, value) => {
    const before = await counts();
    if ((await toggle.getAttribute("aria-label")) === "打开工作台")
      await toggle.click();
    await newFileTab();
    await selectFile();
    await waitReady(saved.sha256, value);
    const after = await counts();
    assert.ok(
      after.read > before.read,
      "reopening performs a real source read IPC",
    );
    assert.equal(
      after.write,
      before.write,
      "reopening a saved file adds no write",
    );
    return { sourceReads: after.read - before.read, sha256: saved.sha256 };
  };
  const editActive = async (value) => {
    const before = await readPresentationNavigationFile(filePath);
    const beforeIo = await counts();
    if (
      await controls.getByRole("button", { name: "编辑", exact: true }).count()
    )
      await controls.getByRole("button", { name: "编辑", exact: true }).click();
    const elements = await frame.read(
      '[data-slide-id="512"] > button[data-presentation-element-id]',
    );
    assert.equal(elements[0]?.attributes["data-presentation-element-id"], "2");
    await frame.click('[data-presentation-element-id="2"]');
    await controls
      .getByRole("button", { name: "编辑文字", exact: true })
      .click();
    await frame.click("[data-presentation-text-editor]");
    await page.keyboard.press("Meta+A");
    await page.keyboard.insertText(value);
    const active = await page.waitForFunction(
      presentationTextEditorMatches,
      {
        selector: presentationFrameSelector,
        value,
        uncommittedSlideId: "512",
      },
      { timeout },
    );
    await active.dispose();
    assert.equal(await controls.getAttribute("data-dirty"), "true");
    assert.equal(await controls.getAttribute("data-saving"), "false");
    assert.equal(digest(fs.readFileSync(filePath)), before.sha256);
    assert.equal(
      (await counts()).write,
      beforeIo.write,
      "active text has not auto-saved",
    );
    return { before, beforeIo, activeTextEditor: true };
  };
  const savedAfter = async (captured, value) => {
    const saved = await readPresentationNavigationFile(filePath);
    const preservedParts = assertPresentationNavigationSave(
      captured.before,
      saved,
      value,
    );
    const afterIo = await counts();
    const fileIoDelta = {
      read: afterIo.read - captured.beforeIo.read,
      write: afterIo.write - captured.beforeIo.write,
    };
    assert.ok(
      fileIoDelta.read >= 2,
      "save checks source SHA through real read IPC twice",
    );
    assert.ok(
      fileIoDelta.write > 0,
      "navigation writes the original source through IPC",
    );
    return {
      saved,
      evidence: {
        activeTextEditor: true,
        sha256: saved.sha256,
        preservedParts,
        fileIoDelta,
      },
    };
  };
  const currentTab = () =>
    page
      .getByTestId("canvas-workbench-top-tabs")
      .locator('[role="tab"][aria-selected="true"]')
      .evaluate((node) =>
        node
          .closest("[data-canvas-tab-key]")
          ?.getAttribute("data-canvas-tab-key"),
      );

  const initial = await readPresentationNavigationFile(filePath);
  assert.deepEqual(
    initial.slides.map((slide) => slide.id),
    originalIds,
  );
  const originalText = initial.slides[0].text;
  assert.ok(originalText.includes("SLIDE_PREVIEW_01"));
  await waitReady(initial.sha256, originalText);
  assert.equal(
    await controls.getByRole("button", { name: "编辑", exact: true }).count(),
    1,
  );
  const evidence = { initialSha256: initial.sha256, slideIds: originalIds };

  let value = "PPTX_NAVIGATION_CLOSE_中文 <&>";
  let captured = await editActive(value);
  await close
    .getByRole("button", { name: "关闭画布工作台", exact: true })
    .click();
  await panel.waitFor({ state: "hidden", timeout });
  assert.equal(await toggle.getAttribute("aria-label"), "打开工作台");
  let result = await savedAfter(captured, value);
  evidence.close = {
    ...result.evidence,
    reopen: await open(result.saved, value),
  };

  value = "PPTX_NAVIGATION_COLLAPSE_中文 <&>";
  captured = await editActive(value);
  await toggle.click();
  await panel.waitFor({ state: "hidden", timeout });
  assert.equal(await toggle.getAttribute("aria-label"), "打开工作台");
  result = await savedAfter(captured, value);
  evidence.collapse = {
    ...result.evidence,
    reopen: await open(result.saved, value),
  };

  value = "PPTX_NAVIGATION_SAME_PATH_中文 <&>";
  captured = await editActive(value);
  const samePath = await selectFile(3);
  result = await savedAfter(captured, value);
  await waitReady(result.saved.sha256, value);
  assert.ok(
    result.evidence.fileIoDelta.read >= 3,
    "same-path selection rereads saved bytes",
  );
  evidence.samePath = { ...result.evidence, ...samePath };

  value = "PPTX_NAVIGATION_DOWNLOAD_中文 <&>";
  captured = await editActive(value);
  const downloadPath = path.resolve(
    evidenceDir,
    "presentation-navigation-download.pptx",
  );
  const nativeDownload = await capturePresentationDownload(
    { app, page, savePath: downloadPath },
    () =>
      page
        .getByTestId("canvas-workbench-header-actions")
        .getByRole("button", { name: "下载", exact: true })
        .click(),
  );
  result = await savedAfter(captured, value);
  await waitReady(result.saved.sha256, value);
  assert.ok(
    result.evidence.fileIoDelta.read >= 3,
    "download reads the newly saved source through IPC",
  );
  const downloaded = await readPresentationNavigationFile(downloadPath);
  const downloadedBytes = fs.readFileSync(downloadPath);
  assert.equal(
    nativeDownload.filename,
    path.basename(filePath),
    "download retains the original PPTX filename",
  );
  assert.equal(nativeDownload.sourceScheme, "blob");
  assert.equal(nativeDownload.receivedBytes, downloadedBytes.length);
  assert.equal(nativeDownload.totalBytes, downloadedBytes.length);
  assert.equal(downloaded.sha256, result.saved.sha256);
  assert.deepEqual(
    downloadedBytes,
    fs.readFileSync(filePath),
    "the native download contains the exact saved PPTX bytes",
  );
  assertPresentationNavigationSave(captured.before, downloaded, value);
  const downloadEvidence = {
    verified: true,
    ...result.evidence,
    ...nativeDownload,
    downloadedSha256: downloaded.sha256,
    filenamePreserved: true,
    sourceBytesIdentical: true,
  };

  // 最后一次正常导航用真实文字编辑恢复原页，供后续批注场景继续使用。
  value = originalText;
  captured = await editActive(value);
  const previousTab = await currentTab();
  assert.ok(previousTab);
  await newFileTab();
  const selectedTab = await currentTab();
  assert.ok(
    selectedTab && selectedTab !== previousTab,
    "new file tab becomes active after saving",
  );
  result = await savedAfter(captured, value);
  await waitReady(result.saved.sha256, value);
  const beforeSelect = await counts();
  await selectFile();
  await waitReady(result.saved.sha256, value);
  assert.ok(
    (await counts()).read > beforeSelect.read,
    "new tab reads the saved source",
  );
  evidence.newFileTab = { ...result.evidence, previousTab, selectedTab };

  const conflictValue = "PPTX_NAVIGATION_CONFLICT_DRAFT_MUST_SURVIVE";
  captured = await editActive(conflictValue);
  const externalZip = await JSZip.loadAsync(fs.readFileSync(filePath));
  externalZip.file(
    "customXml/navigation-external-change.xml",
    "external fixture modification",
  );
  const externalBytes = await externalZip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(filePath, externalBytes);
  const external = await readPresentationNavigationFile(filePath);
  assert.notEqual(external.sha256, captured.before.sha256);
  const beforeConflict = await counts();
  const originalPanel = await panel.elementHandle();
  assert.ok(originalPanel);
  const assertBlocked = async (action) => {
    await action();
    await controls.getByRole("alert").waitFor({ state: "visible", timeout });
    const finished = await page.waitForFunction(
      () => {
        const controls = document.querySelector(
          '[data-testid="presentation-editing-controls"]',
        );
        const alert = controls?.querySelector('[role="alert"]');
        return (
          controls?.getAttribute("data-saving") === "false" &&
          alert?.textContent?.includes("文件已被外部修改")
        );
      },
      undefined,
      { timeout },
    );
    await finished.dispose();
    assert.equal(await panel.isVisible(), true);
    assert.equal(
      await originalPanel.evaluate((node) => node.isConnected),
      true,
    );
    assert.equal(await toggle.getAttribute("aria-label"), "关闭工作台");
    assert.equal(await currentTab(), selectedTab);
    assert.equal(await controls.getAttribute("data-dirty"), "true");
    assert.equal(
      await panel.getAttribute("data-source-sha256"),
      captured.before.sha256,
    );
    assert.ok(
      (await frame.text('[data-slide-id="512"]')).includes(conflictValue),
    );
    assert.equal(
      digest(fs.readFileSync(filePath)),
      external.sha256,
      "conflict does not overwrite disk",
    );
    assert.equal(
      (await counts()).write,
      beforeConflict.write,
      "conflict performs zero write IPC",
    );
  };
  try {
    await assertBlocked(() =>
      close
        .getByRole("button", { name: "关闭画布工作台", exact: true })
        .click(),
    );
    await assertBlocked(() => toggle.click());
    await page.screenshot({
      path: path.join(evidenceDir, "presentation-navigation-conflict.png"),
    });
  } finally {
    await originalPanel.dispose();
  }
  const afterConflict = await counts();
  assert.ok(
    afterConflict.read > beforeConflict.read,
    "conflict reads external bytes through IPC",
  );

  await controls.getByRole("button", { name: "放弃更改", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "继续编辑", exact: true }).click();
  assert.equal(await controls.getAttribute("data-dirty"), "true");
  assert.ok(
    (await frame.text('[data-slide-id="512"]')).includes(conflictValue),
  );
  await controls.getByRole("button", { name: "放弃更改", exact: true }).click();
  const beforeDiscard = await counts();
  await dialog.getByRole("button", { name: "放弃更改", exact: true }).click();
  await dialog.waitFor({ state: "detached", timeout });
  await waitReady(external.sha256, originalText);
  const afterDiscard = await counts();
  assert.ok(
    afterDiscard.read > beforeDiscard.read,
    "explicit discard reads the actual disk version",
  );
  assert.equal(afterDiscard.write, beforeConflict.write);
  assert.equal(digest(fs.readFileSync(filePath)), external.sha256);
  assert.equal(
    (await frame.text('[data-slide-id="512"]')).includes(conflictValue),
    false,
  );
  if (
    await controls
      .getByRole("button", { name: "结束编辑", exact: true })
      .count()
  )
    await controls
      .getByRole("button", { name: "结束编辑", exact: true })
      .click();
  assert.equal(
    await controls.getByRole("button", { name: "编辑", exact: true }).count(),
    1,
  );
  assert.equal(
    await panel.locator("iframe").getAttribute("sandbox"),
    "allow-same-origin",
  );
  assert.equal(await frame.count("script,iframe,a[href],[onclick]"), 0);
  evidence.conflict = {
    shellCloseBlocked: true,
    collapseBlocked: true,
    draftPreserved: true,
    writeIpcDelta: afterConflict.write - beforeConflict.write,
    readIpcDelta: afterConflict.read - beforeConflict.read,
    externalSha256: external.sha256,
    explicitDiscard: true,
    discardSourceReads: afterDiscard.read - beforeDiscard.read,
  };
  evidence.publicActions = {
    sourceSwitch: {
      verified: false,
      reason: "PPTX uses the direct presentation preview without a source tab",
    },
    download: downloadEvidence,
    systemOpen: {
      verified: false,
      reason: "opening the OS application would create an external side effect",
    },
  };
  evidence.finalSha256 = external.sha256;
  evidence.restoredOriginalSlideText = true;
  evidence.scriptsAllowed = false;
  await page.screenshot({
    path: path.join(evidenceDir, "presentation-navigation-restored.png"),
  });
  fs.writeFileSync(
    path.join(evidenceDir, "presentation-navigation.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  return evidence;
}
