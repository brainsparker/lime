import assert from "node:assert/strict";

async function targetSnapshot(page, filePath, cwd) {
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
  { cwd, tab = false } = {},
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
    await menu.getByTestId("workspace-file-menu-open-with").hover();
    const submenu = page.getByRole("menu").last();
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
  await menu.getByTestId("workspace-file-menu-copy-path").click();
  await menu.waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
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
    { cwd },
  );
  await file.focus();
  await file.press("Shift+F10");
  const keyboard = await verifyMenu(
    page,
    filePath,
    capture,
    "file-tree-keyboard-menu",
    { cwd },
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
    { tab: true },
  );
  return { filePathIdentity: true, copiedExactPath: true, targets };
}
