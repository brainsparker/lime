import assert from "node:assert/strict";
import path from "node:path";

export function respondPluginSkill({ request, response, url, index, state }) {
  if (
    !url.pathname.endsWith(
      `/client/ps/plugins/opaque~${index}/skills/research-skill`,
    )
  )
    return false;
  assert.equal(request.method, "GET");
  assert.equal(url.searchParams.get("includeDownloadUrls"), "false");
  state.requests += 1;
  const body =
    state.mode === "empty"
      ? null
      : "---\r\nname: research-skill\r\n---\r\n# Skill title\r\n\r\n## Remote instructions\r\n**Verified skill body**\r\n";
  response.statusCode = state.mode === "error" ? 404 : 200;
  response.end(
    JSON.stringify(
      state.mode === "error"
        ? { message: "private issuer error" }
        : {
            plugin_id: `opaque~${index}`,
            name: "research-skill",
            skill_md_contents: body,
          },
    ),
  );
  return true;
}

export async function exercisePluginSkillPreview({
  page,
  state,
  checks,
  evidenceDir,
  installed = false,
}) {
  const card = page.locator('[data-testid="plugin-skill-card"]').first();
  const dialog = page.locator('[data-testid="plugin-skill-preview"]');
  const body = dialog.locator('[data-testid="plugin-skill-contents"]');
  const requestsBefore = state.requests;
  if (installed) {
    await card.click();
    await body.getByText("Research carefully.", { exact: true }).waitFor();
    assert.equal(
      state.requests,
      requestsBefore,
      "local path must take priority over the remote skill API",
    );
    checks.installedSkillUsesLocalFile = true;
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
      3,
      "failure, retry, and reopen must each read the current authorized body",
    );
    checks.remoteSkillErrorRetryEmptyMarkdown = true;
  }
  await page.screenshot({
    path: path.join(
      evidenceDir,
      installed ? "skill-local.png" : "skill-remote.png",
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
