import {
  composerEditorSelector,
  withComposerEditorDom,
} from "../lib/composer-editor-dom.mjs";
import { Buffer } from "node:buffer";
import {
  APP_SERVER_METHOD_SESSION_READ,
  INPUTBAR_RICH_RESTORE_FORBIDDEN_ASSISTANT_TEXT,
  INPUTBAR_RICH_RESTORE_PATH,
  INPUTBAR_RICH_RESTORE_PATH_NAME,
  INPUTBAR_RICH_RESTORE_PROMPT,
  INPUTBAR_RICH_RESTORE_SKILL_NAME,
  SESSION_ID,
} from "./claw-chat-current-fixture-constants.mjs";
import {
  waitForBackendLedgerEntry,
  waitForBackendLedgerTurnStartContaining,
} from "./claw-chat-current-fixture-backend-ledger.mjs";
import { waitForInputReady } from "./claw-chat-current-fixture-gui-actions.mjs";
import { waitForStopButtonVisibleAndClick } from "./claw-chat-current-fixture-gui-completion-waits.mjs";
import {
  evaluatePageSnapshot,
  invokeAppServerFromPage,
} from "./claw-chat-current-fixture-rpc.mjs";
import {
  collectReadModelItems,
  readModelLatestTurnStatus,
} from "./claw-chat-current-fixture-read-model-core.mjs";
import { ensureUserVisibleCapabilityReportSkill } from "./claw-chat-current-fixture-skills-workspace.mjs";
import { isExpectedSkillIdentity } from "./claw-chat-current-fixture-skill-identity.mjs";
import { verifyComposerImeEditingOnly } from "./claw-chat-current-fixture-composer-ime.mjs";
import { attachComposerImage } from "./claw-chat-current-fixture-composer-image-upload.mjs";
import {
  richInputImageUrl,
  summarizeRichInputSubmission,
} from "./claw-chat-current-fixture-rich-input-evidence.mjs";
import { appServerCallFromPage } from "../electron/mcp-config-fixture-smoke.mjs";
import { runRichUserMessageCollapseGate } from "./claw-chat-current-fixture-user-message-collapse.mjs";
import { withInvokeTraceCollector } from "../lib/invoke-trace-collector.mjs";
import {
  prepareHistoryPaste,
  captureComposerHistoryDraft,
  verifyComposerHistoryRecall,
} from "./claw-chat-current-fixture-composer-history.mjs";
import {
  composerMarksFixture,
  prepareComposerMarksDraft,
  readComposerMarksSnapshot,
  summarizeComposerMarksCancel,
} from "./claw-chat-current-fixture-composer-marks.mjs";
import {
  assert,
  sanitizeJson,
  sleep,
} from "./claw-chat-current-fixture-utils.mjs";

const PATH_REFERENCE_DRAG_MIME = "application/x-lime-path-reference";
const RICH_RESTORE_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const RICH_HISTORY_PASTE_TEXT = "历史粘贴验证😀\n".repeat(180);
const DEFER_BUTTON_LABELS = [
  "稍后处理",
  "稍後處理",
  "Handle later",
  "あとで処理",
  "나중에 처리",
];
let richRestoreSessionId = SESSION_ID;

export function summarizeBackendTurnStart(turnStart) {
  const entry = turnStart?.entry ?? {};
  return sanitizeJson({
    sessionId: entry.sessionId ?? null,
    turnId: entry.turnId ?? null,
    inputText: entry.inputText ?? null,
    providerPreference: entry.providerPreference ?? null,
    modelPreference: entry.modelPreference ?? null,
    inputSummary: entry.inputSummary ?? null,
  });
}

function recordRichRestoreStep(summary, stage, value) {
  if (!summary) {
    return;
  }
  if (!Array.isArray(summary.inputbarRichRestoreDraftSteps)) {
    summary.inputbarRichRestoreDraftSteps = [];
  }
  summary.inputbarRichRestoreDraftSteps.push(
    sanitizeJson({
      stage,
      at: new Date().toISOString(),
      value,
    }),
  );
}

export async function waitForRichRestoreSnapshot(
  page,
  options,
  predicate,
  label,
) {
  const startedAt = Date.now();
  let lastSnapshot = null;
  while (Date.now() - startedAt < options.timeoutMs) {
    const snapshot = await evaluateRichRestoreSnapshot(page);
    if (!snapshot) {
      await sleep(options.intervalMs);
      continue;
    }
    lastSnapshot = snapshot;
    if (await predicate(snapshot)) {
      return sanitizeJson(snapshot);
    }
    await sleep(options.intervalMs);
  }
  throw new Error(`${label}: ${JSON.stringify(sanitizeJson(lastSnapshot))}`);
}

async function evaluateRichRestoreSnapshot(page) {
  return await evaluatePageSnapshot(
    page,
    withComposerEditorDom(
      ({
        deferButtonLabels,
        forbiddenAssistantText,
        pathName,
        prompt,
        sessionId,
        skillName,
      }) => {
        const normalizeMentionText = (value) =>
          String(value || "")
            .trim()
            .toLocaleLowerCase()
            .replace(/[\s_-]+/g, "");
        const expectedSkillName = normalizeMentionText(skillName);
        const editorCandidates = findVisibleComposerEditorsDom(sessionId);
        const editor =
          editorCandidates.length === 1 ? editorCandidates[0] : null;
        const container = editor?.closest(
          '[data-testid="inputbar-core-container"]',
        );
        const rect = editor?.getBoundingClientRect();
        const style = editor ? window.getComputedStyle(editor) : null;
        const editorVisible = Boolean(
          editor &&
          rect &&
          rect.width > 16 &&
          rect.height > 16 &&
          style?.visibility !== "hidden" &&
          style?.display !== "none",
        );
        const buttons = Array.from(document.querySelectorAll("button")).map(
          (button) => ({
            title: button.getAttribute("title") || "",
            text: button.textContent || "",
            aria: button.getAttribute("aria-label") || "",
            disabled: button.disabled,
          }),
        );
        const inputbarButtons = Array.from(
          container?.querySelectorAll("button") || [],
        ).map((button) => ({
          title: button.getAttribute("title") || "",
          text: button.textContent || "",
          aria: button.getAttribute("aria-label") || "",
          disabled: button.disabled,
        }));
        const stopButtonVisible = buttons.some((button) => {
          const labelText = [button.title, button.text, button.aria].join("\n");
          return (
            !button.disabled &&
            (labelText.includes("停止") ||
              labelText.includes("终止") ||
              /\bStop\b/i.test(labelText))
          );
        });
        const deferButton =
          inputbarButtons.find((button) => {
            const labelText = [button.title, button.text, button.aria].join(
              "\n",
            );
            return deferButtonLabels.some((label) => labelText.includes(label));
          }) ?? null;
        const sendButton = container?.querySelector('[data-testid="send-btn"]');
        const visionWarning = (container || document).querySelector(
          '[data-testid="inputbar-vision-warning"]',
        );
        const anyVisionWarning = document.querySelector(
          '[data-testid="inputbar-vision-warning"]',
        );
        const bodyText = document.body?.innerText || "";
        const mainText = document.querySelector("main")?.innerText || bodyText;
        const pathChips = Array.from(
          container?.querySelectorAll(
            '[data-testid="inputbar-path-reference-chip"]',
          ) ?? [],
        ).map((node) => node.textContent || node.getAttribute("title") || "");
        const skillTokenNodes = Array.from(
          editor?.querySelectorAll(
            '[data-composer-token="skill"][contenteditable="false"]',
          ) ?? [],
        );
        const skillTokens = skillTokenNodes.map(
          (node) => node.textContent || "",
        );
        const skillTokenData = skillTokenNodes.map((node) => ({
          id: node.getAttribute("data-composer-id") || "",
          name: node.getAttribute("data-composer-name") || "",
          path: node.getAttribute("data-composer-path") || "",
          label: node.textContent || "",
          editable: node.getAttribute("contenteditable"),
        }));
        const imagePreviewCount = Array.from(
          container?.querySelectorAll("img") ?? [],
        ).filter((node) =>
          typeof node.getAttribute("src") === "string"
            ? node.getAttribute("src")?.startsWith("data:image/")
            : false,
        ).length;
        const turnGroups = Array.from(
          document.querySelectorAll('[data-testid="message-turn-group"]'),
        );
        const promptTurnGroups = turnGroups.filter((group) =>
          (group.textContent || "").includes(prompt),
        );
        const promptTurnGroup = promptTurnGroups.at(-1) ?? null;
        const assistantTexts = Array.from(
          (promptTurnGroup || document).querySelectorAll(
            '[data-message-role="assistant"]',
          ),
        ).map((node) => node.textContent || "");
        const forbiddenAssistantFragments = [
          forbiddenAssistantText,
          "今日国际新闻简要整理",
          "全球市场继续关注能源",
        ];
        const forbiddenAssistantHits = forbiddenAssistantFragments.filter(
          (fragment) =>
            fragment &&
            (mainText.includes(fragment) ||
              assistantTexts.some((text) => text.includes(fragment))),
        );
        return {
          url: window.location.href,
          editorCount: editorCandidates.length,
          editorSessionId:
            editor instanceof HTMLElement
              ? editor.dataset.sessionId || null
              : null,
          editorVisible,
          editorDisabled:
            editor instanceof HTMLElement
              ? editor.getAttribute("aria-disabled") === "true" ||
                editor.getAttribute("contenteditable") !== "true"
              : null,
          editorText:
            editor instanceof HTMLElement
              ? readComposerEditorTextDom(editor)
              : null,
          promptVisibleInEditor:
            editor instanceof HTMLElement &&
            readComposerEditorTextDom(editor).startsWith(prompt),
          hasInputbarCore: Boolean(container),
          hasPrompt: bodyText.includes(prompt),
          promptTurnGroupCount: promptTurnGroups.length,
          promptTurnGroupVisible: promptTurnGroups.length > 0,
          pathChipCount: pathChips.length,
          pathChipTexts: pathChips,
          pathRestored: pathChips.some((text) => text.includes(pathName)),
          imagePreviewCount,
          imageRestored: imagePreviewCount > 0,
          skillTokenCount: skillTokens.length,
          skillTokenTexts: skillTokens,
          skillTokenData,
          skillRestored: skillTokens.some((text) =>
            normalizeMentionText(text).includes(expectedSkillName),
          ),
          stopButtonVisible,
          sendButtonExists: Boolean(sendButton),
          sendButtonDisabled:
            sendButton instanceof HTMLButtonElement
              ? sendButton.disabled
              : null,
          sendButtonLabel:
            sendButton instanceof HTMLElement
              ? sendButton.getAttribute("aria-label") ||
                sendButton.getAttribute("title") ||
                sendButton.textContent ||
                "send"
              : null,
          deferButtonExists: Boolean(deferButton),
          deferButtonDisabled: deferButton ? deferButton.disabled : null,
          deferButtonLabel: deferButton
            ? [deferButton.title, deferButton.text, deferButton.aria]
                .filter(Boolean)
                .join(" ")
            : null,
          inputbarButtonLabels: inputbarButtons.map((button) =>
            [button.title, button.text, button.aria].filter(Boolean).join(" "),
          ),
          visionWarningText:
            visionWarning instanceof HTMLElement
              ? visionWarning.textContent || ""
              : "",
          visionWarningPolicy:
            visionWarning instanceof HTMLElement
              ? visionWarning.dataset.policy || null
              : null,
          anyVisionWarningText:
            anyVisionWarning instanceof HTMLElement
              ? anyVisionWarning.textContent || ""
              : "",
          anyVisionWarningPolicy:
            anyVisionWarning instanceof HTMLElement
              ? anyVisionWarning.dataset.policy || null
              : null,
          assistantTexts,
          forbiddenAssistantHits,
          noVisibleAssistantOutput: forbiddenAssistantHits.length === 0,
          bodyText,
          mainText,
        };
      },
    ),
    {
      deferButtonLabels: DEFER_BUTTON_LABELS,
      forbiddenAssistantText: INPUTBAR_RICH_RESTORE_FORBIDDEN_ASSISTANT_TEXT,
      pathName: INPUTBAR_RICH_RESTORE_PATH_NAME,
      prompt: INPUTBAR_RICH_RESTORE_PROMPT,
      sessionId: richRestoreSessionId,
      skillName: INPUTBAR_RICH_RESTORE_SKILL_NAME,
    },
  );
}

async function fillRichRestorePrompt(page, options) {
  const editor = page.locator(
    `${composerEditorSelector(richRestoreSessionId)}:visible`,
  );
  await editor.fill(INPUTBAR_RICH_RESTORE_PROMPT);
  return await waitForRichRestoreSnapshot(
    page,
    options,
    (snapshot) =>
      String(snapshot.editorText || "").startsWith(
        INPUTBAR_RICH_RESTORE_PROMPT,
      ),
    "Inputbar 未填入 rich restore prompt",
  );
}

async function attachFixtureImage(page, options) {
  const upload = await attachComposerImage(page, {
    sessionId: richRestoreSessionId,
    imageButtonName: "添加图片",
    timeoutMs: Math.min(options.timeoutMs, 15_000),
    image: {
      name: "rich-restore-fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(RICH_RESTORE_IMAGE_BASE64, "base64"),
    },
  });
  const snapshot = await waitForRichRestoreSnapshot(
    page,
    options,
    (snapshot) => snapshot.imageRestored === true,
    "Inputbar 未显示 rich restore 图片预览",
  );
  return { ...snapshot, upload };
}

async function dropPathReference(page, options) {
  const dropped = await page.evaluate(
    withComposerEditorDom(({ mime, pathName, pathValue, sessionId }) => {
      const editors = findVisibleComposerEditorsDom(sessionId);
      const editor = editors.length === 1 ? editors[0] : null;
      const target =
        editor?.closest('[data-testid="inputbar-core-container"]') ?? editor;
      if (!(target instanceof HTMLElement)) {
        return { dropped: false, reason: "missing-inputbar-target" };
      }
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(
        mime,
        JSON.stringify([
          {
            id: `file:${pathValue}`,
            path: pathValue,
            name: pathName,
            isDir: false,
            size: 128,
            mimeType: "text/markdown",
          },
        ]),
      );
      dataTransfer.setData("text/plain", pathValue);
      target.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
      const dropEvent = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(dropEvent);
      return { dropped: true, defaultPrevented: dropEvent.defaultPrevented };
    }),
    {
      mime: PATH_REFERENCE_DRAG_MIME,
      pathName: INPUTBAR_RICH_RESTORE_PATH_NAME,
      pathValue: INPUTBAR_RICH_RESTORE_PATH,
      sessionId: richRestoreSessionId,
    },
  );
  assert(
    dropped?.dropped === true,
    `Inputbar path reference drop 失败: ${JSON.stringify(
      sanitizeJson(dropped),
    )}`,
  );
  return await waitForRichRestoreSnapshot(
    page,
    options,
    (snapshot) => snapshot.pathRestored === true,
    "Inputbar 未显示 rich restore path chip",
  );
}

async function clickRichRestoreSendButton(page, options) {
  const beforeClick = await waitForRichRestoreSnapshot(
    page,
    options,
    (snapshot) =>
      String(snapshot.editorText || "").startsWith(
        INPUTBAR_RICH_RESTORE_PROMPT,
      ) &&
      snapshot.imageRestored === true &&
      snapshot.pathRestored === true &&
      snapshot.skillRestored === true &&
      snapshot.sendButtonExists === true &&
      snapshot.sendButtonDisabled === false,
    "Inputbar rich restore 发送按钮未就绪",
  );
  const sendLocator = page
    .locator(`${composerEditorSelector(richRestoreSessionId)}:visible`)
    .locator(
      'xpath=ancestor::*[@data-testid="inputbar-core-container"][1]//*[@data-testid="send-btn"]',
    );
  await sendLocator.click();
  return sanitizeJson({
    afterFill: {
      promptVisibleInEditor: String(beforeClick.editorText || "").startsWith(
        INPUTBAR_RICH_RESTORE_PROMPT,
      ),
      sendButtonExists: beforeClick.sendButtonExists,
      sendButtonDisabled: beforeClick.sendButtonDisabled,
      visionWarningPolicy: beforeClick.visionWarningPolicy,
      visionWarningText: beforeClick.visionWarningText,
    },
    clicked: {
      clicked: true,
      beforeClick,
    },
  });
}

async function selectCapabilityReportSkill(page, options, skillIdentity) {
  const editor = page.locator(
    `${composerEditorSelector(richRestoreSessionId)}:visible`,
  );
  await editor.focus();
  await editor.press("ControlOrMeta+End");
  await page.keyboard.insertText(" /capability-report");
  let lastSelectionResult = null;
  const selected = await waitForRichRestoreSnapshot(
    page,
    { ...options, timeoutMs: Math.min(options.timeoutMs, 30_000) },
    async () => {
      const result = await page.evaluate((skillName) => {
        const normalizeMentionText = (value) =>
          String(value || "")
            .trim()
            .toLocaleLowerCase()
            .replace(/[\s_-]+/g, "");
        const expectedSkillName = normalizeMentionText(skillName);
        const popover = document.querySelector(
          '[data-testid="mention-popover-content"]',
        );
        if (
          !popover ||
          !normalizeMentionText(popover.textContent).includes(expectedSkillName)
        ) {
          return {
            clicked: false,
            reason: "skill-not-visible",
            candidates: popover
              ? Array.from(
                  popover.querySelectorAll('[cmdk-item], [role="option"]'),
                )
                  .map((node) => String(node.textContent || "").trim())
                  .filter(Boolean)
                  .slice(0, 8)
              : [],
          };
        }
        const items = Array.from(
          popover.querySelectorAll('[cmdk-item], [role="option"]'),
        ).filter(
          (node) =>
            node instanceof HTMLElement &&
            normalizeMentionText(node.textContent).includes(
              expectedSkillName,
            ) &&
            node.getAttribute("aria-disabled") !== "true" &&
            !(node instanceof HTMLButtonElement && node.disabled),
        );
        const summarizeItem = (node) => {
          const group = node.closest("[cmdk-group]");
          const heading =
            group?.querySelector("[cmdk-group-heading]")?.textContent || "";
          return {
            text: node.textContent || "",
            heading,
          };
        };
        const target =
          items.find((node) => {
            const { heading, text } = summarizeItem(node);
            return /installed|已安装|已安裝/i.test(`${heading}\n${text}`);
          }) ??
          items.find((node) => {
            const { text } = summarizeItem(node);
            return /skill|技能/i.test(text);
          }) ??
          items[0] ??
          null;
        if (!(target instanceof HTMLElement)) {
          return {
            clicked: false,
            reason: "missing-click-target",
            candidates: items.map(summarizeItem).slice(0, 8),
          };
        }
        target.click();
        const selected = summarizeItem(target);
        return {
          clicked: true,
          targetText: selected.text,
          targetHeading: selected.heading,
          candidateCount: items.length,
        };
      }, skillIdentity.name);
      lastSelectionResult = sanitizeJson(result);
      return result?.clicked === true;
    },
    "Inputbar mention 面板未选中 Capability Report 技能",
  ).catch(async (error) => {
    const debug = await evaluateRichRestoreSnapshot(page);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; selection=${JSON.stringify(
        lastSelectionResult,
      )}; snapshot=${JSON.stringify(sanitizeJson(debug))}`,
    );
  });
  void selected;
  return await waitForRichRestoreSnapshot(
    page,
    options,
    (snapshot) =>
      snapshot.skillRestored === true &&
      snapshot.skillTokenCount === 1 &&
      isExpectedSkillIdentity(snapshot.skillTokenData[0], skillIdentity) &&
      snapshot.skillTokenData[0].id === skillIdentity.key &&
      snapshot.skillTokenData[0].label === `/${skillIdentity.key}`,
    "Inputbar 未显示 Capability Report inline skill token",
  );
}

export async function prepareRichDraft(
  page,
  options,
  runtimeEnv,
  summary,
  { submitAction = "send", marks = false } = {},
) {
  richRestoreSessionId = summary?.sessionId?.trim() || SESSION_ID;
  const skill = ensureUserVisibleCapabilityReportSkill(runtimeEnv);
  recordRichRestoreStep(summary, "workspace-skill-ready", skill);
  const inputReady = await waitForInputReady(page, options, {
    expectedSessionId: richRestoreSessionId,
  });
  recordRichRestoreStep(summary, "input-ready", inputReady);
  const prompt = await fillRichRestorePrompt(page, options);
  recordRichRestoreStep(summary, "prompt-filled", prompt);
  const marksEvidence = marks
    ? await prepareComposerMarksDraft({
        page,
        options,
        sessionId: richRestoreSessionId,
        threadId: summary.threadId,
        prompt: INPUTBAR_RICH_RESTORE_PROMPT,
      })
    : null;
  const pasteToken = await prepareHistoryPaste(
    page,
    richRestoreSessionId,
    RICH_HISTORY_PASTE_TEXT,
  );
  recordRichRestoreStep(summary, "large-paste-prepared", pasteToken);
  const skillToken = await selectCapabilityReportSkill(
    page,
    options,
    skill.skillIdentity,
  );
  recordRichRestoreStep(summary, "skill-selected", skillToken);
  const image = await attachFixtureImage(page, options);
  recordRichRestoreStep(summary, "image-attached", image);
  const pathReference = await dropPathReference(page, options);
  recordRichRestoreStep(summary, "path-reference-dropped", pathReference);
  let prepared;
  try {
    prepared = await waitForRichRestoreSnapshot(
      page,
      options,
      (snapshot) =>
        String(snapshot.editorText || "").startsWith(
          INPUTBAR_RICH_RESTORE_PROMPT,
        ) &&
        snapshot.imageRestored === true &&
        snapshot.pathRestored === true &&
        snapshot.skillRestored === true &&
        (submitAction === "defer"
          ? snapshot.deferButtonExists === true &&
            snapshot.deferButtonDisabled === false
          : snapshot.sendButtonDisabled === false),
      "Inputbar rich restore draft 未准备完整",
    );
    recordRichRestoreStep(summary, "draft-prepared", prepared);
  } catch (error) {
    recordRichRestoreStep(
      summary,
      "draft-prepared-timeout",
      await evaluateRichRestoreSnapshot(page),
    );
    throw error;
  }

  return sanitizeJson({
    skill,
    inputReady,
    prompt,
    image,
    pathReference,
    skillToken,
    pasteToken,
    ...(marksEvidence ? { marks: marksEvidence } : {}),
    prepared,
  });
}

async function waitForInputbarRichRestoreReadModelCanceled(
  page,
  options,
  requestLog,
  threadId,
  submissionExpectation,
) {
  const startedAt = Date.now();
  let lastRead = null;
  let lastSummary = null;
  while (Date.now() - startedAt < options.timeoutMs) {
    const read = await invokeAppServerFromPage(
      page,
      APP_SERVER_METHOD_SESSION_READ,
      {
        threadId,
        includeTurns: true,
      },
      requestLog,
    );
    lastRead = read.result;
    const serialized = JSON.stringify(read.result || {});
    const latestTurnStatus = readModelLatestTurnStatus(read.result);
    lastSummary = sanitizeJson({
      includesPrompt: serialized.includes(INPUTBAR_RICH_RESTORE_PROMPT),
      includesCanceled: ["interrupted", "canceled", "cancelled"].includes(
        String(latestTurnStatus ?? "").toLowerCase(),
      ),
      forbiddenAssistantOutput:
        serialized.includes(INPUTBAR_RICH_RESTORE_FORBIDDEN_ASSISTANT_TEXT) ||
        serialized.includes("今日国际新闻简要整理"),
      detailItemCount: collectReadModelItems(read.result).length,
      latestTurnStatus,
      richInputSubmission: summarizeRichInputSubmission({
        ...submissionExpectation,
        canonical: read.result,
        threadId,
      }),
    });
    if (
      lastSummary.includesPrompt === true &&
      lastSummary.includesCanceled === true &&
      lastSummary.forbiddenAssistantOutput === false &&
      lastSummary.richInputSubmission.ok === true
    ) {
      return lastSummary;
    }
    await sleep(options.intervalMs);
  }
  throw new Error(
    `App Server read model 未完成 rich restore 取消闭环: ${JSON.stringify(
      sanitizeJson({
        summary: lastSummary,
        readModel: lastRead,
      }),
    )}`,
  );
}

export async function runInputbarRichRestoreScenario(args) {
  const result = await withInvokeTraceCollector(
    args.page,
    (traceCollector) =>
      runObservedInputbarRichRestoreScenario({ ...args, traceCollector }),
    (proof) => {
      args.summary.inputbarRichRestoreTraceCollector = proof;
    },
  );
  return {
    ...result,
    inputbarRichRestoreTraceCollector:
      args.summary.inputbarRichRestoreTraceCollector,
  };
}

async function runObservedInputbarRichRestoreScenario({
  page,
  options,
  summary,
  appServerRequests,
  runtimeEnv,
  readClipboardText,
  writeClipboardText,
  traceCollector,
}) {
  richRestoreSessionId = summary?.sessionId?.trim() || SESSION_ID;
  summary.inputbarRichRestoreDraftPrepared = await prepareRichDraft(
    page,
    options,
    runtimeEnv,
    summary,
    { marks: true },
  );
  summary.inputbarRichRestoreSkill =
    summary.inputbarRichRestoreDraftPrepared.skill;
  const skillIdentity = summary.inputbarRichRestoreSkill.skillIdentity;
  const historyPrepared = await captureComposerHistoryDraft(
    page,
    richRestoreSessionId,
    skillIdentity,
    options,
  );
  const pasteToken = summary.inputbarRichRestoreDraftPrepared.pasteToken;
  const expectedSubmission = composerMarksFixture({
    prompt: INPUTBAR_RICH_RESTORE_PROMPT,
    skillIdentity,
    pasteText: RICH_HISTORY_PASTE_TEXT,
  });
  assert(
    historyPrepared.text === expectedSubmission.displayText,
    "marks draft 显示文本与独立样本不一致",
  );

  summary.inputbarRichRestoreImeBoundary = await verifyComposerImeEditingOnly({
    page,
    appServerRequests,
    threadId: summary.threadId,
    sessionId: richRestoreSessionId,
    prompt: INPUTBAR_RICH_RESTORE_PROMPT,
  });

  summary.inputbarRichRestoreInputSend = await clickRichRestoreSendButton(
    page,
    options,
  );

  const backendTurnStart = await waitForBackendLedgerTurnStartContaining(
    runtimeEnv.backendLedgerPath,
    INPUTBAR_RICH_RESTORE_PROMPT,
    options,
  );
  const sessionId = backendTurnStart.entry.sessionId ?? SESSION_ID;
  const threadId = summary?.threadId;
  summary.inputbarRichRestoreBackendTurnStart =
    summarizeBackendTurnStart(backendTurnStart);
  summary.inputbarRichRestoreHistoryBoundary =
    await verifyComposerHistoryRecall({
      page,
      options,
      prepared: historyPrepared,
      threadId,
      sessionId: richRestoreSessionId,
      skillIdentity,
      expectedSubmission,
      backendText: backendTurnStart.entry.inputText,
      imageDataUrl: `data:image/png;base64,${RICH_RESTORE_IMAGE_BASE64}`,
      pathReference: {
        id: `file:${INPUTBAR_RICH_RESTORE_PATH}`,
        path: INPUTBAR_RICH_RESTORE_PATH,
        name: INPUTBAR_RICH_RESTORE_PATH_NAME,
        isDir: "false",
      },
    });

  summary.inputbarRichRestoreStopClick = sanitizeJson(
    await waitForStopButtonVisibleAndClick(page, options),
  );
  const backendCancel = await waitForBackendLedgerEntry(
    runtimeEnv.backendLedgerPath,
    (entry) =>
      entry.kind === "turnCancel" &&
      entry.sessionId === sessionId &&
      (!backendTurnStart.entry.turnId ||
        entry.turnId === backendTurnStart.entry.turnId),
    options,
  );
  summary.inputbarRichRestoreBackendCancel = sanitizeJson({
    sessionId: backendCancel.entry.sessionId,
    turnId: backendCancel.entry.turnId,
    recordedAt: backendCancel.entry.recordedAt,
  });

  summary.inputbarRichRestoreGuiCanceled = await waitForRichRestoreSnapshot(
    page,
    options,
    (snapshot) =>
      snapshot.editorVisible === true &&
      snapshot.editorDisabled === false &&
      String(snapshot.editorText || "").startsWith(
        INPUTBAR_RICH_RESTORE_PROMPT,
      ) &&
      snapshot.imageRestored === true &&
      snapshot.pathRestored === true &&
      snapshot.skillRestored === true &&
      snapshot.stopButtonVisible === false &&
      snapshot.noVisibleAssistantOutput === true,
    "Inputbar rich restore 取消后未恢复完整草稿",
  );
  summary.inputbarRichRestoreMarksCanceled = summarizeComposerMarksCancel({
    prepared: historyPrepared,
    restored: await readComposerMarksSnapshot(page, richRestoreSessionId),
    expectedSubmission,
    sessionId: richRestoreSessionId,
  });
  assert(
    summary.inputbarRichRestoreMarksCanceled.ok,
    `marks cancel 恢复语义失败: ${JSON.stringify(summary.inputbarRichRestoreMarksCanceled)}`,
  );

  summary.inputbarRichRestoreReadModelCanceled =
    await waitForInputbarRichRestoreReadModelCanceled(
      page,
      options,
      appServerRequests,
      threadId,
      {
        traceRaw: await page.evaluate(() =>
          localStorage.getItem("lime_invoke_trace_buffer_v1"),
        ),
        prompt: INPUTBAR_RICH_RESTORE_PROMPT,
        expectedSubmission,
        turnId: backendTurnStart.entry.turnId,
        editorText:
          summary.inputbarRichRestoreDraftPrepared.prepared.editorText,
        skillToken:
          summary.inputbarRichRestoreDraftPrepared.prepared.skillTokenData[0],
        skillIdentity,
        imageBase64: RICH_RESTORE_IMAGE_BASE64,
        pathReference: {
          name: INPUTBAR_RICH_RESTORE_PATH_NAME,
          path: INPUTBAR_RICH_RESTORE_PATH,
        },
        pasteToken,
        pasteText: RICH_HISTORY_PASTE_TEXT,
        mediaRead: await appServerCallFromPage(page, "media/read", {
          threadId,
          uri: richInputImageUrl(RICH_RESTORE_IMAGE_BASE64),
        }),
      },
    );

  summary.inputbarRichRestoreUserMessageCollapse =
    await runRichUserMessageCollapseGate({
      page,
      options,
      summary,
      readClipboardText,
      writeClipboardText,
      traceCollector,
      expectedText: expectedSubmission.text,
      renderedTextParts: expectedSubmission.renderedTextParts,
      headText: INPUTBAR_RICH_RESTORE_PROMPT,
    });

  return sanitizeJson({
    inputbarRichRestoreSkill: summary.inputbarRichRestoreSkill,
    inputbarRichRestoreDraftPrepared: summary.inputbarRichRestoreDraftPrepared,
    inputbarRichRestoreInputSend: summary.inputbarRichRestoreInputSend,
    inputbarRichRestoreBackendTurnStart:
      summary.inputbarRichRestoreBackendTurnStart,
    inputbarRichRestoreStopClick: summary.inputbarRichRestoreStopClick,
    inputbarRichRestoreBackendCancel: summary.inputbarRichRestoreBackendCancel,
    inputbarRichRestoreGuiCanceled: summary.inputbarRichRestoreGuiCanceled,
    inputbarRichRestoreMarksCanceled: summary.inputbarRichRestoreMarksCanceled,
    inputbarRichRestoreReadModelCanceled:
      summary.inputbarRichRestoreReadModelCanceled,
    inputbarRichRestoreHistoryBoundary:
      summary.inputbarRichRestoreHistoryBoundary,
    inputbarRichRestoreUserMessageCollapse:
      summary.inputbarRichRestoreUserMessageCollapse,
  });
}
