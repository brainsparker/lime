import assert from "node:assert/strict";
import path from "node:path";

export async function exercisePluginSkillPreview({
  page,
  state,
  checks,
  evidenceDir,
  installed = false,
  local = false,
}) {
  const card = page.locator('[data-testid="plugin-skill-card"]').first();
  const dialog = page.locator('[data-testid="plugin-skill-preview"]');
  const body = dialog.locator('[data-testid="plugin-skill-contents"]');
  const requestsBefore = state.requests;
  if (local) {
    await card.click();
    await body
      .getByText(
        "Use the existing Lime browser session for page inspection and navigation tasks.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      state.requests,
      requestsBefore,
      "local path must take priority over the remote skill API",
    );
    checks.localSkillUsesLocalFile = true;
  } else if (installed) {
    await card.click();
    await body.getByText("Verified skill body", { exact: true }).waitFor();
    assert.equal(
      state.requests,
      requestsBefore,
      "installed remote skills must retain their cached remote preview",
    );
    checks.installedSkillRetainsRemotePreview = true;
  } else {
    state.mode = "error";
    await card.click();
    await dialog.getByRole("alert").waitFor();
    assert(!(await body.textContent()).includes("private issuer error"));
    state.mode = "empty";
    await dialog.getByRole("alert").getByRole("button").click();
    await body
      .getByText(/暂无可用指令|No instructions available yet/)
      .waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    state.mode = "ready";
    await card.click();
    await body
      .getByText(/暂无可用指令|No instructions available yet/)
      .waitFor();
    assert.equal(
      state.requests - requestsBefore,
      5,
      "successful null must stay cached on reopen",
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    const beforeShift = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(beforeShift + 5 * 60 * 1000 + 1);
    await card.click();
    await body
      .getByRole("heading", { name: "Remote instructions", exact: true })
      .waitFor();
    await body.getByText("Verified skill body", { exact: true }).waitFor();
    assert.equal(
      await body.locator("h1").count(),
      0,
      "preview must strip the leading title",
    );
    assert.equal(
      state.requests - requestsBefore,
      6,
      "untyped RPC failure retries three times, manual retry and stale reopen each read once",
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    await card.click();
    await body.getByText("Verified skill body", { exact: true }).waitFor();
    assert.equal(
      state.requests - requestsBefore,
      6,
      "fresh Markdown must stay cached on reopen",
    );
    await page.clock.setSystemTime(Date.now());
    checks.skillPreviewFiveMinuteCache = true;
    checks.skillPreviewClock =
      "renderer Date advanced 300001ms; timers were not triggered";
    checks.remoteSkillErrorRetryEmptyMarkdown = true;
  }
  await page.screenshot({
    path: path.join(
      evidenceDir,
      local
        ? "skill-local.png"
        : installed
          ? "skill-installed-remote.png"
          : "skill-remote.png",
    ),
  });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert(
    await card.evaluate((element) => element === document.activeElement),
    "skill close must restore opener focus",
  );
  checks.skillCloseRestoresFocus = true;
}
