import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

async function verifyClipboard(clipboard, expected, message) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await clipboard.readText()) === expected) return;
    await delay(50);
  }
  throw new Error(message);
}

export async function targetSnapshot(page, filePath, cwd) {
  return page.evaluate(
    async ({ path, cwd }) => {
      const params = { path, cwd, deferEnrichment: true };
      const snapshot = await window.electronAPI.invoke(
        "open_in_get_targets",
        params,
      );
      const detected = await Promise.all(
        snapshot.targets.map(async (entry) => {
          try {
            return await window.electronAPI.invoke("open_in_detect_target", {
              ...params,
              target: entry.target,
              appPath: entry.appPath,
            });
          } catch {
            return null;
          }
        }),
      );
      const available = detected.filter((entry) => entry?.available);
      const native = available.filter((entry) => entry.appPath != null);
      const visibleTargets = native.length
        ? native
        : available.filter((entry) => entry.kind === "builtin");
      const primary =
        visibleTargets.find((entry) => entry.id === snapshot.preferredTarget) ??
        visibleTargets[0] ??
        null;
      return {
        discovery: snapshot.discovery,
        visibleTargets,
        primary,
        reveal: available.some((entry) => entry.target === "fileManager"),
      };
    },
    { path: filePath, cwd },
  );
}

async function verifyMenu(
  page,
  filePath,
  capture,
  name,
  { cwd, tab = false, clipboard } = {},
) {
  const menu = page.getByTestId("workspace-file-context-menu");
  await menu.waitFor({ state: "visible" });
  assert.equal(await menu.getAttribute("data-file-path"), filePath);
  const targets = await targetSnapshot(page, filePath, cwd);
  const expected = [
    ...(targets.primary
      ? [
          `workspace-file-menu-open:${targets.primary.id}`,
          "workspace-file-menu-open-with",
        ]
      : []),
    "workspace-file-menu-save-as",
    "workspace-file-menu-copy-path",
    ...(tab ? ["workspace-file-menu-copy-contents"] : []),
    ...(tab && targets.reveal ? ["workspace-file-menu-reveal-path"] : []),
  ];
  await page.waitForFunction(
    ({ expected }) => {
      const menu = document.querySelector(
        '[data-testid="workspace-file-context-menu"]',
      );
      const actual = [
        ...(menu?.querySelectorAll('[role="menuitem"]') ?? []),
      ].map((node) => node.dataset.testid);
      return JSON.stringify(actual) === JSON.stringify(expected);
    },
    { expected },
  );
  assert.deepEqual(
    await menu
      .getByRole("menuitem")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.testid)),
    expected,
    "file menu must match real available native targets and preserve action order",
  );
  assert.equal(
    await menu.getByRole("separator").count(),
    targets.primary ? 1 : 0,
  );
  await capture(name);
  if (targets.primary) {
    const trigger = menu.getByTestId("workspace-file-menu-open-with");
    await trigger.hover();
    await page.waitForFunction(() => {
      const trigger = document.querySelector(
        '[data-testid="workspace-file-menu-open-with"]',
      );
      return (
        trigger?.getAttribute("aria-expanded") === "true" &&
        trigger.hasAttribute("aria-controls")
      );
    });
    const submenuId = await trigger.getAttribute("aria-controls");
    assert.ok(submenuId, "Open with must control its own submenu");
    const submenu = page.locator(
      `[role="menu"][id=${JSON.stringify(submenuId)}]`,
    );
    await submenu.waitFor({ state: "visible" });
    assert.equal(
      await submenu.getByRole("menuitem").count(),
      targets.visibleTargets.length,
    );
    const labels = await submenu.getByRole("menuitem").allTextContents();
    for (const target of targets.visibleTargets.filter(
      (entry) => entry.kind === "native",
    ))
      assert.ok(
        labels.includes(target.label),
        `missing real associated app ${target.id}`,
      );
    await capture(`${name}-open-with`);
    await menu.getByTestId("workspace-file-menu-copy-path").hover();
  }
  await clipboard.writeText(`file-path-sentinel:${randomUUID()}`);
  await menu.getByTestId("workspace-file-menu-copy-path").click();
  await menu.waitFor({ state: "hidden" });
  await verifyClipboard(
    clipboard,
    filePath,
    "copy must use the actual file path, including flattened search ancestors",
  );
  return {
    actionOrder: expected,
    discovery: targets.discovery,
    targetIds: targets.visibleTargets.map((target) => target.id),
    nativeApplicationLaunched: false,
  };
}

export async function verifyFileTreeContextMenu({
  page,
  clipboard,
  directory,
  file,
  filePath,
  cwd,
  capture,
}) {
  await directory.click({ button: "right" });
  assert.equal(
    await page.getByTestId("workspace-file-context-menu").count(),
    0,
  );
  await file.click({ button: "right" });
  const pointer = await verifyMenu(
    page,
    filePath,
    capture,
    "file-tree-context-menu",
    { cwd, clipboard },
  );
  await file.focus();
  await file.press("Shift+F10");
  const keyboard = await verifyMenu(
    page,
    filePath,
    capture,
    "file-tree-keyboard-menu",
    { cwd, clipboard },
  );
  return {
    fileOnlyTrigger: true,
    canonicalOperationPath: true,
    keyboardContextMenu: true,
    copiedExactPath: true,
    pointer,
    keyboard,
    saveDialogExecuted: false,
  };
}

export async function verifyFileTabContextMenu({
  page,
  clipboard,
  tab,
  filePath,
  capture,
}) {
  await tab.click({ button: "right" });
  const targets = await verifyMenu(
    page,
    filePath,
    capture,
    "file-tab-context-menu",
    { tab: true, clipboard },
  );
  await tab.click({ button: "right" });
  const menu = page.getByTestId("workspace-file-context-menu");
  await menu.waitFor({ state: "visible" });
  await clipboard.writeText(`file-contents-sentinel:${randomUUID()}`);
  await menu.getByTestId("workspace-file-menu-copy-contents").click();
  await menu.waitFor({ state: "hidden" });
  const contents = fs.readFileSync(filePath, "utf8");
  await verifyClipboard(
    clipboard,
    contents,
    "Content copy must read the complete actual file, not its path or preview",
  );
  return {
    filePathIdentity: true,
    copiedExactPath: true,
    copiedExactContents: true,
    copiedContentBytes: Buffer.byteLength(contents),
    copiedContentSha256: createHash("sha256").update(contents).digest("hex"),
    targets,
  };
}
