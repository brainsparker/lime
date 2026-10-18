import assert from "node:assert/strict";
import path from "node:path";
import { parseJsonRpcRequestsFromInvokeTrace } from "../mcp-config-fixture-smoke.mjs";

export async function exerciseRemotePluginPreferences({
  page,
  peer,
  preferences,
  marketplace,
  evidenceDir,
  checks,
}) {
  const id = `research-0@${marketplace}`;
  const card = page.getByTestId(`plugin-catalog-card-${id}`);
  const snapshot = async () =>
    (
      await peer.connection.request(peer.client.listInstalledPlugins({}))
    ).result.marketplaces
      .flatMap((market) => market.plugins)
      .find((plugin) => plugin.id === id);
  const toggle = async () => {
    await page.getByTestId(`plugin-catalog-actions-${id}`).click();
    await page.getByTestId(`plugin-catalog-toggle-${id}`).click();
  };
  for (const enabled of [false, true]) {
    await toggle();
    await card
      .getByText(enabled ? "已启用" : "已停用", { exact: true })
      .waitFor();
    const fresh = await snapshot();
    assert.equal(fresh?.enabled, enabled);
    assert.equal(fresh?.installed, true);
    assert.equal(fresh?.localVersion, "1.0.0");
    assert.deepEqual(preferences.writes.at(-1), { index: 0, enabled });
    await page.screenshot({
      path: path.join(
        evidenceDir,
        `remote-preference-${enabled ? "enabled" : "disabled"}.png`,
      ),
    });
  }
  preferences.fail = true;
  try {
    await toggle();
    await page
      .getByText("无法更新插件启停状态，请重试。", { exact: true })
      .waitFor();
    await card.getByText("已启用", { exact: true }).waitFor();
    assert.equal((await snapshot())?.enabled, true);
    assert.equal(preferences.writes.length, 2);
  } finally {
    preferences.fail = false;
  }
  const trace = await page.evaluate(() =>
    localStorage.getItem("lime_invoke_trace_buffer_v1"),
  );
  assert(
    !parseJsonRpcRequestsFromInvokeTrace(trace).some(
      (request) => request.method === "config/batchWrite",
    ),
  );
  checks.remotePreferences = {
    guiDisable: true,
    guiEnable: true,
    sharedStdioFreshRead: true,
    persistenceFailureRetainsState: true,
    noLocalConfigWrite: true,
  };
}
