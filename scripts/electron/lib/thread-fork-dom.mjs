import { waitForPageCondition } from "../mcp-config-fixture-smoke.mjs";

export async function readThreadDom(page, { title, parentSessionId = "" }) {
  return await page.evaluate(
    ({ title, parentSessionId }) => {
      const rows = Array.from(
        document.querySelectorAll(
          '[data-testid="app-sidebar-conversation-open"]',
        ),
      );
      const matchingRows = rows.filter(
        (row) =>
          row.getAttribute("title") === title ||
          row.textContent?.includes(title),
      );
      const activeRow = rows.find(
        (row) => row.getAttribute("aria-current") === "page",
      );
      const header = document.querySelector(
        '[data-testid="thread-workspace-header-title"]',
      );
      const composer = document.querySelector(
        '[data-testid="composer-editor"][role="textbox"]',
      );
      return {
        headerTitle: header?.textContent?.trim() || "",
        activeSessionId: activeRow?.getAttribute("data-session-id") || "",
        activeThreadId: "",
        parentActive:
          activeRow?.getAttribute("data-session-id") === parentSessionId,
        childActive:
          Boolean(activeRow?.getAttribute("data-session-id")) &&
          activeRow?.getAttribute("data-session-id") !== parentSessionId,
        matchingConversationCount: matchingRows.length,
        successToastVisible: false,
        composerSessionId: composer?.getAttribute("data-session-id") || "",
        composerEditable: composer?.getAttribute("contenteditable") === "true",
        composerDraftState:
          document
            .querySelector('[data-testid="composer-draft-status"]')
            ?.getAttribute("data-state") ?? null,
      };
    },
    { title, parentSessionId },
  );
}

export async function waitForForkComposerReady(page, options, sessionId) {
  if (!sessionId) throw new Error("Fork child canonical session ID is missing");
  return await waitForPageCondition(
    page,
    options,
    (expectedSessionId) => {
      const editor = document.querySelector(
        '[data-testid="composer-editor"][role="textbox"]',
      );
      return (
        editor?.getAttribute("data-session-id") === expectedSessionId &&
        editor.getAttribute("contenteditable") === "true" &&
        document
          .querySelector('[data-testid="composer-draft-status"]')
          ?.getAttribute("data-state") !== "restoring"
      );
    },
    `Fork child Composer 未就绪: expected session=${sessionId}`,
    sessionId,
  );
}

export async function waitForConversation(page, options, title) {
  await waitForPageCondition(
    page,
    options,
    (title) =>
      Array.from(
        document.querySelectorAll(
          '[data-testid="app-sidebar-conversation-open"]',
        ),
      ).some(
        (button) =>
          button.getAttribute("title") === title ||
          button.textContent?.includes(title),
      ),
    "Thread Fork parent 侧栏会话未出现",
    title,
  );
}

export async function clickConversation(page, title) {
  const clicked = await page.evaluate((title) => {
    const button = Array.from(
      document.querySelectorAll(
        '[data-testid="app-sidebar-conversation-open"]',
      ),
    ).find(
      (candidate) =>
        candidate.getAttribute("title") === title ||
        candidate.textContent?.includes(title),
    );
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  }, title);
  if (!clicked) throw new Error("无法点击 Thread Fork parent 侧栏会话");
}
