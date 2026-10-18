import assert from "node:assert/strict";
import path from "node:path";

export async function exerciseRemotePluginSkillPreferences({
  page,
  peer,
  preferences,
  marketplace,
  evidenceDir,
  checks,
  remoteScope,
}) {
  await page
    .getByTestId(`plugin-catalog-select-research-0@${marketplace}`)
    .click();
  const panel = page.getByTestId("plugin-catalog-detail");
  const toggle = panel.getByRole("switch");
  await toggle.waitFor();
  const style = await toggle.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  assert(
    style.width >= 30 && style.height >= 18,
    `skill switch styles are missing: ${JSON.stringify(style)}`,
  );
  const snapshot = async () =>
    (
      await peer.connection.request(
        peer.client.readPlugin({
          remoteMarketplaceName: marketplace,
          pluginName: "opaque~0",
        }),
      )
    ).result.plugin;
  assert.equal(await toggle.getAttribute("aria-checked"), "false");
  if (remoteScope === "GLOBAL") {
    assert(
      await toggle.isDisabled(),
      "Apps cannot use callable readiness as account authorization",
    );
    assert.match(await toggle.getAttribute("title"), /连接所需应用/);
    assert.equal(preferences.skillWrites?.length ?? 0, 0);
    checks.remoteSkillAppsAuthorizationGated = true;
    return;
  }

  const preview = page.getByTestId("plugin-skill-preview");
  await panel.getByTestId("plugin-skill-card").click();
  await preview
    .getByTestId("plugin-skill-contents")
    .getByText("Verified skill body", { exact: true })
    .waitFor();
  const previewToggle = preview.getByRole("switch");
  assert.equal(
    await preview.evaluate((element) => getComputedStyle(element).position),
    "fixed",
    "skill preview must use the built dialog layout",
  );
  for (const enabled of [true, false]) {
    await previewToggle.click();
    await page.waitForFunction(
      ({ enabled }) => {
        const switches = [...document.querySelectorAll('[role="switch"]')];
        return (
          switches.length === 2 &&
          switches.every(
            (item) =>
              !item.disabled &&
              item.getAttribute("aria-checked") === String(enabled),
          )
        );
      },
      { enabled },
    );
    const fresh = await snapshot();
    assert.equal(fresh.skills[0].enabled, enabled);
    assert.equal(fresh.summary.enabled, true);
    assert.deepEqual(preferences.skillWrites.at(-1), {
      index: 0,
      skillName: "research-skill",
      enabled,
    });
    await page.screenshot({
      animations: "disabled",
      path: path.join(
        evidenceDir,
        `skill-preference-${enabled ? "enabled" : "disabled"}.png`,
      ),
    });
  }
  preferences.fail = true;
  try {
    await previewToggle.click();
    await preview
      .getByRole("alert")
      .getByText("无法保存技能设置，请重试。", { exact: true })
      .waitFor();
    assert.equal(await previewToggle.getAttribute("aria-checked"), "false");
    assert.equal((await snapshot()).skills[0].enabled, false);
    assert.equal(preferences.skillWrites.length, 2);
  } finally {
    preferences.fail = false;
  }
  await page.keyboard.press("Escape");
  await preview.waitFor({ state: "detached" });
  assert(
    await panel
      .getByTestId("plugin-skill-card")
      .evaluate((element) => element === document.activeElement),
  );
  checks.remoteSkillPreferences = {
    cardAndPreviewShareState: true,
    enableDisable: true,
    sharedStdioFreshRead: true,
    persistenceFailureRetainsState: true,
    focusRestored: true,
  };
}
