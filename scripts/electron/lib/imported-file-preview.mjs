import path from "node:path";
import {
  assert,
  sanitizeJson,
  sleep,
  waitForUiSnapshot,
} from "./local-history-import-smoke-utils.mjs";
import {
  IMPORTED_CWD,
  IMPORTED_USER_TEXT,
  IMPORTED_ASSISTANT_SUMMARY_TEXT,
  IMPORTED_PREVIEW_DOCX_FILE,
  IMPORTED_PREVIEW_DOCX_TEXT,
  IMPORTED_PREVIEW_HTML_FILE,
  IMPORTED_PREVIEW_HTML_TEXT,
  IMPORTED_PREVIEW_MARKDOWN_FILE,
  IMPORTED_PREVIEW_MARKDOWN_TEXT,
  IMPORTED_PREVIEW_PPTX_FILE,
  IMPORTED_PREVIEW_PDF_FILE,
  IMPORTED_PREVIEW_PDF_TEXT,
  IMPORTED_PREVIEW_XLSX_FILE,
  IMPORTED_PREVIEW_XLSX_TEXT,
} from "./local-history-import-click-through-fixture.mjs";

async function waitForTimelineToolFileButton(page, options, fileName) {
  const toolRowSelector = '[data-testid="tool-call-row"]';
  const artifactCardSelector =
    '[data-testid="timeline-file-attachment-card"], [data-testid="timeline-file-artifact-card"]';
  const startedAt = Date.now();
  let lastSnapshot = null;
  while (Date.now() - startedAt < Math.min(options.timeoutMs, 20_000)) {
    lastSnapshot = await page.evaluate(
      ({ artifactCardSelector, fileName, toolRowSelector }) => {
        const toolRows = Array.from(
          document.querySelectorAll(toolRowSelector),
        ).map((row, index) => ({
          index,
          text: row.textContent || "",
          buttons: Array.from(row.querySelectorAll("button")).map(
            (button, buttonIndex) => ({
              index: buttonIndex,
              title: button.getAttribute("title") || "",
              ariaLabel: button.getAttribute("aria-label") || "",
            }),
          ),
        }));
        const matchingToolRow = toolRows.find((row) =>
          row.text.includes(fileName),
        );
        const openButton = matchingToolRow?.buttons.find((button) =>
          /(?:画布|canvas)/i.test(`${button.title}\n${button.ariaLabel}`),
        );
        const artifactCards = Array.from(
          document.querySelectorAll(artifactCardSelector),
        ).filter((card) => (card.textContent || "").includes(fileName));
        return {
          matchingToolRow,
          openButton,
          artifactCardCount: artifactCards.length,
          toolRows,
          bodyText: document.body?.innerText || "",
        };
      },
      { artifactCardSelector, fileName, toolRowSelector },
    );
    if (lastSnapshot.matchingToolRow && lastSnapshot.openButton) {
      return {
        kind: "timeline-tool",
        selector: toolRowSelector,
        rowIndex: lastSnapshot.matchingToolRow.index,
        buttonIndex: lastSnapshot.openButton.index,
      };
    }
    if (lastSnapshot.artifactCardCount > 0) {
      return { kind: "artifact-card", selector: artifactCardSelector };
    }
    await sleep(options.intervalMs);
  }
  throw new Error(
    `导入工具轨缺少文件打开按钮 ${fileName}: ${JSON.stringify(
      sanitizeJson(lastSnapshot),
    )}`,
  );
}

async function waitForWorkbenchFilePreview(page, options, expected) {
  const startedAt = Date.now();
  let result = null;
  const selectionHistory = [];
  let lastSelectionSignature = "";
  while (Date.now() - startedAt < Math.min(options.timeoutMs, 20_000)) {
    result = await page.evaluate((expectedFileName) => {
      const artifactWorkbench = document.querySelector(
        '[data-testid="artifact-workbench-shell"]',
      );
      const canvasWorkbench = document.querySelector(
        '[data-testid="canvas-workbench-shell"]',
      );
      const canvasWorkbenchLayout = document.querySelector(
        '[data-testid="canvas-workbench-layout"]',
      );
      const previewPanel = document.querySelector(
        '[data-testid="canvas-workbench-preview-mode-panel"]',
      );
      const markdownPreview = document.querySelector(
        '[data-testid="canvas-workbench-markdown-preview"]',
      );
      const htmlPreview = document.querySelector(
        '[data-testid="canvas-workbench-html-preview"]',
      );
      const codePreview = document.querySelector(
        '[data-testid="canvas-workbench-code-preview"]',
      );
      const docx = previewPanel?.querySelector(
        '[data-testid="docx-preview-panel"]',
      );
      const workbook = previewPanel?.querySelector(
        '[data-testid="workbook-preview-panel"]',
      );
      const pdf = previewPanel?.querySelector(
        '[data-testid="pdf-preview-panel"]',
      );
      const presentation = previewPanel?.querySelector(
        '[data-testid="presentation-panel"]',
      );
      const slide = presentation
        ?.querySelector("iframe")
        ?.contentDocument?.querySelector("[data-slide-id]");
      const docxDocument = docx?.querySelector("iframe")?.contentDocument;
      const pdfCanvas = pdf?.querySelector('[data-rendered="true"] canvas');
      const specialized = {
        pptx: {
          ready: presentation?.getAttribute("data-status") === "ready",
          text: slide?.textContent || "",
          slideId: slide?.getAttribute("data-slide-id"),
          width: slide?.getBoundingClientRect().width || 0,
        },
        docx: {
          ready: docx?.getAttribute("data-status") === "ready",
          text: docxDocument?.body?.innerText || "",
          pages: docxDocument?.querySelectorAll("section.docx").length || 0,
        },
        xlsx: {
          ready: workbook?.getAttribute("data-status") === "ready",
          text: workbook?.querySelector('[role="grid"]')?.textContent || "",
          cells: workbook?.querySelectorAll('[role="gridcell"]').length || 0,
          sheets: workbook?.querySelectorAll('[role="tab"]').length || 0,
        },
        pdf: {
          ready: pdf?.getAttribute("data-status") === "ready",
          text: pdf?.querySelector(".textLayer")?.textContent || "",
          pixels:
            pdfCanvas instanceof HTMLCanvasElement &&
            pdfCanvas.width > 0 &&
            pdfCanvas.height > 0,
        },
      };
      const emptySurface = document.querySelector(
        '[data-testid="artifact-empty-surface"]',
      );
      const fallbackSurface = document.querySelector(
        '[data-testid="preview-artifact-fallback-surface"]',
      );
      const bodyText = document.body?.innerText || "";
      const previewPanelText = previewPanel?.textContent || "";
      const workbenchText =
        artifactWorkbench?.textContent ||
        canvasWorkbench?.textContent ||
        canvasWorkbenchLayout?.textContent ||
        previewPanelText ||
        "";
      const canvasWorkbenchDataset =
        canvasWorkbench instanceof HTMLElement
          ? { ...canvasWorkbench.dataset }
          : {};
      const timelineToolRows = Array.from(
        document.querySelectorAll('[data-testid="tool-call-row"]'),
      ).map((row) => ({
        text: row.textContent || "",
        buttons: Array.from(row.querySelectorAll("button")).map((button) => ({
          title: button.getAttribute("title") || "",
          ariaLabel: button.getAttribute("aria-label") || "",
        })),
      }));
      const matchingTimelineToolRows = timelineToolRows.filter((row) =>
        row.text.includes(expectedFileName),
      );
      const traceRaw =
        window.localStorage.getItem("lime_invoke_trace_buffer_v1") || "";
      const errorRaw =
        window.localStorage.getItem("lime_invoke_error_buffer_v1") || "";
      const readJsonArray = (raw) => {
        try {
          const value = JSON.parse(raw || "[]");
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      };
      const filePreviewTraceEntries = readJsonArray(traceRaw)
        .filter(
          (entry) =>
            JSON.stringify(entry).includes("fs/readFile") &&
            JSON.stringify(entry).includes(expectedFileName),
        )
        .slice(-4);
      const filePreviewInvokeErrors = readJsonArray(errorRaw)
        .filter(
          (entry) =>
            JSON.stringify(entry).includes("fs/readFile") &&
            JSON.stringify(entry).includes(expectedFileName),
        )
        .slice(-4);
      return {
        bodyText,
        workbenchVisible: Boolean(
          artifactWorkbench ||
          canvasWorkbench ||
          canvasWorkbenchLayout ||
          previewPanel,
        ),
        workbenchText,
        previewPanelText,
        canvasWorkbenchDataset,
        artifactWorkbenchVisible: Boolean(artifactWorkbench),
        canvasWorkbenchVisible: Boolean(canvasWorkbench),
        canvasWorkbenchLayoutVisible: Boolean(canvasWorkbenchLayout),
        previewPanelVisible: Boolean(previewPanel),
        markdownPreviewVisible: Boolean(markdownPreview),
        htmlPreviewVisible: Boolean(htmlPreview),
        codePreviewVisible: Boolean(codePreview),
        emptySurfaceVisible: Boolean(emptySurface),
        fallbackSurfaceVisible: Boolean(fallbackSurface),
        fallbackRenderMode:
          fallbackSurface?.getAttribute("data-preview-render-mode") || "",
        fallbackSurfaceText: fallbackSurface?.textContent || "",
        htmlPreviewSrc:
          htmlPreview instanceof HTMLIFrameElement ? htmlPreview.src : "",
        htmlPreviewSrcDoc:
          htmlPreview instanceof HTMLIFrameElement ? htmlPreview.srcdoc : "",
        timelineToolRows,
        matchingTimelineToolRows,
        traceHasFsReadFile: traceRaw.includes("fs/readFile"),
        traceHasExpectedFile: traceRaw.includes(expectedFileName),
        filePreviewTraceEntries,
        filePreviewInvokeErrors,
        specialized,
      };
    }, expected.fileName);
    const selectionState = {
      canvasWorkbenchDataset: result.canvasWorkbenchDataset,
      previewPanelText: result.previewPanelText,
      markdownPreviewVisible: result.markdownPreviewVisible,
      htmlPreviewVisible: result.htmlPreviewVisible,
      fallbackSurfaceVisible: result.fallbackSurfaceVisible,
    };
    const selectionSignature = JSON.stringify(selectionState);
    if (selectionSignature !== lastSelectionSignature) {
      selectionHistory.push({
        elapsedMs: Date.now() - startedAt,
        ...selectionState,
      });
      lastSelectionSignature = selectionSignature;
    }
    result.selectionHistory = selectionHistory;
    if (["docx", "xlsx", "pptx", "pdf"].includes(expected.kind)) {
      const rendered = result.specialized[expected.kind];
      if (
        result.workbenchVisible &&
        result.previewPanelVisible &&
        rendered.ready &&
        rendered.text.includes(expected.text) &&
        (expected.kind !== "docx" || rendered.pages > 0) &&
        (expected.kind !== "xlsx" ||
          (rendered.cells > 0 && rendered.sheets === 2)) &&
        (expected.kind !== "pptx" ||
          (rendered.slideId === "512" && rendered.width > 0)) &&
        (expected.kind !== "pdf" || rendered.pixels)
      )
        return result;
    }
    if (
      expected.kind !== "html" &&
      expected.kind !== "system_open" &&
      !["docx", "xlsx", "pptx", "pdf"].includes(expected.kind) &&
      result.workbenchVisible &&
      result.previewPanelVisible &&
      (result.previewPanelText || result.workbenchText).includes(
        expected.fileName,
      ) &&
      (result.previewPanelText || result.workbenchText).includes(expected.text)
    ) {
      return result;
    }
    if (
      expected.kind === "system_open" &&
      result.workbenchVisible &&
      result.previewPanelVisible &&
      result.fallbackSurfaceVisible &&
      result.fallbackRenderMode === "system_open" &&
      result.fallbackSurfaceText.includes(expected.fileName) &&
      result.fallbackSurfaceText.includes(expected.text)
    ) {
      return result;
    }
    if (
      expected.kind === "html" &&
      result.workbenchVisible &&
      result.previewPanelVisible &&
      result.htmlPreviewVisible &&
      (result.previewPanelText || result.workbenchText).includes(
        expected.fileName,
      ) &&
      (result.bodyText.includes(expected.text) ||
        result.htmlPreviewSrc ||
        result.htmlPreviewSrcDoc.includes(expected.text))
    ) {
      return result;
    }
    await sleep(options.intervalMs);
  }
  throw new Error(
    `Workbench 未显示导入文件预览 ${expected.fileName}: ${JSON.stringify(
      sanitizeJson(result),
    )}`,
  );
}

async function clickImportedToolFilePreview(page, options, expected) {
  const selector = await waitForTimelineToolFileButton(
    page,
    options,
    expected.fileName,
  );
  if (selector.kind === "timeline-tool") {
    await page
      .locator(selector.selector)
      .nth(selector.rowIndex)
      .locator("button")
      .nth(selector.buttonIndex)
      .click();
  } else {
    await page
      .locator(selector.selector)
      .filter({ hasText: expected.fileName })
      .first()
      .locator("button")
      .first()
      .click();
  }
  const result = await waitForWorkbenchFilePreview(page, options, expected);
  assert(
    result.workbenchVisible && result.previewPanelVisible,
    `${expected.fileName} 未进入 Artifact Workbench`,
  );
  assert(
    !result.emptySurfaceVisible,
    `${expected.fileName} 打开后仍显示空预览`,
  );
  const previewText = result.previewPanelText || result.workbenchText;
  if (expected.kind === "html") {
    assert(
      result.htmlPreviewVisible &&
        Boolean(result.htmlPreviewSrc || result.htmlPreviewSrcDoc) &&
        previewText.includes(expected.fileName),
      `${expected.fileName} 未进入 HTML iframe 预览`,
    );
  } else if (expected.kind === "system_open") {
    assert(
      result.fallbackSurfaceVisible &&
        result.fallbackRenderMode === "system_open" &&
        previewText.includes(expected.fileName) &&
        previewText.includes(expected.text),
      `${expected.fileName} 未进入 system_open preview fallback`,
    );
  } else if (["docx", "xlsx", "pptx", "pdf"].includes(expected.kind)) {
    const rendered = result.specialized[expected.kind];
    assert(
      rendered.ready && rendered.text.includes(expected.text),
      `${expected.fileName} 未进入原字节专用预览`,
    );
    assert(
      result.traceHasFsReadFile && result.traceHasExpectedFile,
      `${expected.fileName} 未经过真实 fs/readFile`,
    );
    const expectedPath = path.join(IMPORTED_CWD, "docs", expected.fileName);
    const sourceRead = result.filePreviewTraceEntries.some((entry) =>
      entry.args_preview?.request?.lines?.some((line) => {
        const request = JSON.parse(line);
        return (
          request.method === "fs/readFile" &&
          request.params?.path === expectedPath
        );
      }),
    );
    assert(sourceRead, `${expected.fileName} 未读取 canonical 源绝对路径`);
    assert(
      result.filePreviewInvokeErrors.length === 0,
      `${expected.fileName} 原字节读取失败`,
    );
  } else {
    assert(
      previewText.includes(expected.fileName) &&
        previewText.includes(expected.text),
      `${expected.fileName} 未显示预期内容`,
    );
  }
  if (expected.kind === "docx") {
    const forbiddenTexts = [
      "PK\u0003\u0004",
      "word/document.xml",
      "[Content_Types].xml",
    ];
    assert(
      !forbiddenTexts.some((text) => result.bodyText.includes(text)),
      `${expected.fileName} 预览暴露了 DOCX ZIP/OpenXML 噪音`,
    );
  }
  if (/\.(docx|xlsx|pptx)$/u.test(expected.fileName)) {
    const forbiddenTexts = [
      "PK\u0003\u0004",
      "xl/worksheets/sheet1.xml",
      "xl/sharedStrings.xml",
      "ppt/slides/slide1.xml",
      "[Content_Types].xml",
    ];
    assert(
      !forbiddenTexts.some((text) => result.bodyText.includes(text)),
      `${expected.fileName} 预览暴露了 Office ZIP/OpenXML 噪音`,
    );
  }
  return {
    fileName: expected.fileName,
    kind: expected.kind,
    selector,
    ...result,
  };
}

export async function inspectImportedFilePreviewArtifacts(page, options) {
  await waitForUiSnapshot(
    page,
    options,
    (snapshot) =>
      snapshot.editorVisible &&
      snapshot.bodyText.includes(IMPORTED_USER_TEXT) &&
      snapshot.bodyText.includes(IMPORTED_ASSISTANT_SUMMARY_TEXT),
    "导入会话页未稳定，无法检查导入文件预览",
  );

  const markdown = await clickImportedToolFilePreview(page, options, {
    fileName: IMPORTED_PREVIEW_MARKDOWN_FILE,
    kind: "markdown",
    text: IMPORTED_PREVIEW_MARKDOWN_TEXT,
  });
  const html = await clickImportedToolFilePreview(page, options, {
    fileName: IMPORTED_PREVIEW_HTML_FILE,
    kind: "html",
    text: IMPORTED_PREVIEW_HTML_TEXT,
  });
  const docx = await clickImportedToolFilePreview(page, options, {
    fileName: IMPORTED_PREVIEW_DOCX_FILE,
    kind: "docx",
    text: IMPORTED_PREVIEW_DOCX_TEXT,
  });
  const xlsx = await clickImportedToolFilePreview(page, options, {
    fileName: IMPORTED_PREVIEW_XLSX_FILE,
    kind: "xlsx",
    text: IMPORTED_PREVIEW_XLSX_TEXT,
  });
  const pptx = await clickImportedToolFilePreview(page, options, {
    fileName: IMPORTED_PREVIEW_PPTX_FILE,
    kind: "pptx",
    text: "SLIDE_PREVIEW_01",
  });
  const pdf = await clickImportedToolFilePreview(page, options, {
    fileName: IMPORTED_PREVIEW_PDF_FILE,
    kind: "pdf",
    text: IMPORTED_PREVIEW_PDF_TEXT,
  });

  return {
    markdown,
    html,
    docx,
    xlsx,
    pptx,
    pdf,
    openedAllImportedPreviewArtifacts: true,
  };
}
