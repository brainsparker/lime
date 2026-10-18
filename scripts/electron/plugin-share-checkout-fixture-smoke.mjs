import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  ensureElectronFixtureBuild,
  inspectElectronFixtureBuildFreshness,
} from "../lib/electron-fixture-build.mjs";
import { acquireGuiSmokeRunLock } from "../lib/gui-smoke-run-lock.mjs";
import {
  electronAppServerBinaryDestination,
  resolveElectronAppServerRuntimeEnv,
} from "../lib/electron-app-server-assets.mjs";
import {
  appServerCallFromPage,
  closeElectronFixture,
  createTempRuntimeEnv,
  launchElectronFixture,
  parseJsonRpcRequestsFromInvokeTrace,
} from "./mcp-config-fixture-smoke.mjs";
import { remotePluginBundle } from "./lib/remote-plugin-bundle-fixture.mjs";
import {
  preparePluginShareDraft,
  exercisePluginShareGui,
} from "./lib/plugin-share-gui-scenario.mjs";

// GUI actions use the real bridge; HTTP is an explicit controlled Core-shaped dependency.
const evidenceDir = path.resolve(
  process.env.PLUGIN_CHECKOUT_EVIDENCE_DIR ||
    fs.mkdtempSync(path.join(os.tmpdir(), "lime-plugin-checkout-electron-")),
);
fs.mkdirSync(evidenceDir, { recursive: true });
ensureElectronFixtureBuild({
  rootDir: process.cwd(),
  logPrefix: "plugin-checkout",
});
const lock = await acquireGuiSmokeRunLock({
  lockDir: path.resolve(".lime/electron-fixture-build.lock"),
  waitTimeoutMs: 600_000,
  log: console.log,
});
const runtimeEnv = createTempRuntimeEnv();
const draftRoot = preparePluginShareDraft(runtimeEnv.home);
const options = { timeoutMs: 120_000, intervalMs: 100 };
const token = "checkout-fixture-private-account";
const signature = "checkout-fixture-private-download";
const tenant = "checkout-fixture";
const profile = {
  tenant: { id: tenant, name: "Checkout Fixture", slug: tenant },
  user: {
    id: "owner",
    email: "owner@example.test",
    displayName: "Checkout Owner",
    passwordConfigured: true,
    roles: [],
  },
  session: {
    id: "checkout-session",
    tenantId: tenant,
    userId: "owner",
    provider: "password",
    roles: [],
    issuedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  },
};
const summary = {
  ok: false,
  proofLevel:
    "real Electron share GUI + five RPC + visible catalog + real stdio",
  dependency: "controlled Core-shaped HTTP; unavailable Turn backend",
  shareGuiEntry: false,
  modelTurn: false,
  checks: {},
  downloads: [],
  requests: [],
  rpc: [],
  share: { uploads: [], finalized: [], access: [], deleted: false },
  consoleErrors: [],
  pageErrors: [],
};
let baseUrl;
let handle;
let peer;
let appServerEnv;
let draftCreated = false;
let draftAccess = "PRIVATE";
let draftTargets = [];
const detail = () => ({
  id: "opaque~checkout",
  name: "research-0",
  scope: "WORKSPACE",
  discoverability: "PRIVATE",
  creator_account_user_id: "owner",
  creator_name: "Checkout Owner",
  share_url: `${baseUrl}/share/opaque~checkout`,
  can_publish_to_workspace: true,
  share_principals: [
    {
      principal_type: "user",
      principal_id: "owner",
      role: "owner",
      name: "Checkout Owner",
    },
  ],
  installation_policy: "AVAILABLE",
  authentication_policy: "ON_USE",
  status: "AVAILABLE",
  release: {
    version: "1.0.0",
    display_name: "Editable Research",
    description: "Editable package fixture",
    keywords: [],
    interface: {},
    bundle_download_url: `${baseUrl}/download?signature=${signature}`,
    skills: [],
    mcp_servers: [],
    apps: [],
  },
});
const draft = () => ({
  ...detail(),
  id: "opaque~draft",
  name: "draft",
  discoverability: draftAccess,
  share_url: `${baseUrl}/share/opaque~draft`,
  share_principals: [
    ...detail().share_principals,
    ...draftTargets.map((target) => ({ ...target, name: target.principal_id })),
  ],
});
const issuer = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://fixture.test");
  const accountHeaders = Boolean(
    request.headers.authorization || request.headers.cookie,
  );
  const renderer = Boolean(
    request.headers.origin || request.headers["sec-fetch-mode"],
  );
  const json = (data, status = 200) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(data));
  };
  if (url.pathname === "/download") {
    summary.downloads.push({ accountHeaders, renderer });
    if (
      accountHeaders ||
      renderer ||
      url.searchParams.get("signature") !== signature
    )
      return json({}, 403);
    response.writeHead(200, { "Content-Type": "application/gzip" });
    return response.end(remotePluginBundle(0));
  }
  if (url.pathname === "/upload") {
    if (
      request.method !== "PUT" ||
      accountHeaders ||
      renderer ||
      url.searchParams.get("signature") !== signature
    )
      return json({}, 403);
    const parts = [];
    for await (const part of request) parts.push(part);
    const bytes = Buffer.concat(parts);
    const archive = gunzipSync(bytes);
    summary.share.uploads.push({
      credentialFree: true,
      gzipBytes: bytes.length,
      hasHiddenMarker: archive.includes(Buffer.from("draft private marker")),
      hasUpdatedMarker: archive.includes(Buffer.from("updated private marker")),
    });
    response.writeHead(201);
    return response.end();
  }
  if (!url.pathname.startsWith("/api/")) {
    if (url.pathname === "/oem-runtime-config.js") {
      response.writeHead(200, { "Content-Type": "application/javascript" });
      return response.end(
        `window.__LIME_OEM_CLOUD__ = ${JSON.stringify({ enabled: true, baseUrl, tenantId: tenant })};`,
      );
    }
    const root = path.resolve("dist");
    const file = path.resolve(
      root,
      `.${url.pathname === "/" ? "/index.html" : url.pathname}`,
    );
    if (
      !file.startsWith(`${root}${path.sep}`) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    )
      return response.writeHead(404).end();
    const mime = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".json": "application/json",
      ".png": "image/png",
      ".woff2": "font/woff2",
    };
    response.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    });
    return fs.createReadStream(file).pipe(response);
  }
  summary.requests.push({
    method: request.method,
    path: url.pathname,
    renderer,
    authenticated: accountHeaders,
  });
  if (url.pathname.endsWith("/client/auth-catalog"))
    return json({
      code: 200,
      data: {
        items: [],
        authPolicy: { required: false, startupTrigger: "none" },
      },
    });
  if (request.headers.authorization !== `Bearer ${token}`)
    return json({ code: 401, message: "fixture authentication required" }, 401);
  if (
    request.method === "POST" &&
    url.pathname.endsWith("/client/public/plugins/workspace/upload-url")
  ) {
    const parts = [];
    for await (const part of request) parts.push(part);
    const body = JSON.parse(Buffer.concat(parts).toString());
    if (body.plugin_id && body.plugin_id !== "opaque~draft")
      return json({}, 400);
    return json({
      file_id: "fixture-file",
      upload_url: `${baseUrl}/upload?signature=${signature}`,
      etag: "fixture-etag",
    });
  }
  if (
    request.method === "POST" &&
    /\/client\/public\/plugins\/workspace(?:\/opaque~draft)?$/.test(
      url.pathname,
    )
  ) {
    const parts = [];
    for await (const part of request) parts.push(part);
    const body = JSON.parse(Buffer.concat(parts).toString());
    summary.share.finalized.push({
      update: url.pathname.endsWith("opaque~draft"),
      discoverability: body.discoverability,
    });
    if (body.discoverability) draftAccess = body.discoverability;
    draftCreated = true;
    return json({
      plugin_id: "opaque~draft",
      share_url: `${baseUrl}/share/opaque~draft`,
      can_publish_to_workspace: true,
    });
  }
  if (
    request.method === "PUT" &&
    url.pathname.endsWith("/client/ps/plugins/opaque~draft/shares")
  ) {
    const parts = [];
    for await (const part of request) parts.push(part);
    const body = JSON.parse(Buffer.concat(parts).toString());
    draftAccess = body.discoverability;
    draftTargets = body.targets;
    summary.share.access.push(body);
    return json({
      discoverability: draftAccess,
      principals: draft().share_principals,
    });
  }
  if (
    request.method === "DELETE" &&
    url.pathname.endsWith("/client/public/plugins/workspace/opaque~draft")
  ) {
    draftCreated = false;
    summary.share.deleted = true;
    response.writeHead(204);
    return response.end();
  }
  if (request.method !== "GET")
    return json({ message: "unexpected mutation" }, 405);
  if (url.pathname.endsWith("/client/ps/plugins/opaque~checkout")) {
    const item = detail();
    if (url.searchParams.get("includeDownloadUrls") !== "true")
      delete item.release.bundle_download_url;
    return json(item);
  }
  if (url.pathname.endsWith("/client/ps/plugins/opaque~draft"))
    return json(draft());
  if (url.pathname.endsWith("/client/ps/plugins/workspace/created"))
    return json({
      plugins: [detail(), ...(draftCreated ? [draft()] : [])],
      pagination: { next_page_token: null },
    });
  if (url.pathname.includes("/client/ps/plugins/"))
    return json({ plugins: [], pagination: { next_page_token: null } });
  const data = url.pathname.endsWith("/client/session")
    ? profile
    : url.pathname.endsWith("/client/bootstrap")
      ? {
          session: profile,
          providerOffersSummary: [],
          providerPreference: {
            tenantId: tenant,
            userId: "owner",
            providerSource: "local",
            providerKey: "fixture",
            needsValidation: false,
          },
          features: {},
          gateway: { basePath: "/gateway-api" },
        }
      : url.pathname.endsWith("/client/cloud-activation")
        ? {
            gateway: { basePath: "/gateway-api" },
            readiness: {
              status: "ready",
              title: "Fixture ready",
              canInvoke: false,
              blockers: [],
              steps: [],
            },
          }
        : { items: [] };
  return json({ code: 200, data });
});

async function launch() {
  console.log("[plugin-checkout] launching Electron");
  handle = await launchElectronFixture({
    options,
    runtimeEnv,
    appServerEnv,
    consoleErrors: summary.consoleErrors,
    pageErrors: summary.pageErrors,
  });
}

async function rpc(method, params = {}) {
  console.log(`[plugin-checkout] ${method}`);
  const response = await appServerCallFromPage(handle.page, method, params);
  assert.equal(response.appServerCommand, "app_server_handle_json_lines");
  assert.equal(response.ipcObservation.electron, true);
  assert.equal(response.ipcObservation.fallback, false);
  summary.rpc.push({
    method,
    command: response.appServerCommand,
    transport: response.ipcObservation.transport,
  });
  return response.result;
}

async function visible(stage) {
  const page = handle.page;
  await page
    .locator(
      '[data-testid="app-sidebar-nav-plugins"]',
    )
    .click();
  await page
    .locator('[data-testid="plugin-catalog-select-research-0@codex-curated"]')
    .click();
  await page.getByText("research-0:research-skill", { exact: true }).waitFor();
  await page.getByText("research-server", { exact: true }).waitFor();
  assert.equal(
    await page
      .locator(
        '[data-testid="plugin-catalog-install-research-0@codex-curated"]',
      )
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator(
        '[data-testid="plugin-catalog-actions-research-0@codex-curated"]',
      )
      .count(),
    0,
  );
  const state = await page.evaluate(
    (secrets) => ({
      realBridge:
        window.__LIME_ELECTRON__ === true &&
        typeof window.electronAPI?.invoke === "function" &&
        window.electronAPI.devBridgeFallback === false,
      leaked: secrets.some((secret) =>
        JSON.stringify([
          ...Object.entries(localStorage),
          ...Object.entries(sessionStorage),
        ]).includes(secret),
      ),
      trace: localStorage.getItem("lime_invoke_trace_buffer_v1"),
      errors: localStorage.getItem("lime_invoke_error_buffer_v1"),
    }),
    [token, signature],
  );
  assert.equal(state.realBridge, true);
  assert.equal(state.leaked, false);
  assert.equal(JSON.parse(state.errors || "[]").length, 0);
  const calls = parseJsonRpcRequestsFromInvokeTrace(state.trace).filter(
    (entry) => entry.method.startsWith("plugin/") && entry.status === "success",
  );
  assert(calls.some((entry) => entry.method === "plugin/list"));
  assert(calls.some((entry) => entry.method === "plugin/read"));
  for (const call of calls) assert.equal(call.transport, "electron-ipc");
  summary.checks[stage] = {
    realBridge: true,
    installed: false,
    personalPluginVisible: true,
    credentialFreeRenderer: true,
  };
  console.log(`[plugin-checkout] ${stage} visible`);
  await page.screenshot({ path: path.join(evidenceDir, `${stage}.png`) });
}

try {
  assert(
    inspectElectronFixtureBuildFreshness({ rootDir: process.cwd() }).ready,
  );
  await new Promise((resolve) => issuer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${issuer.address().port}`;
  const binary = electronAppServerBinaryDestination();
  summary.appServerSha256 = createHash("sha256")
    .update(fs.readFileSync(binary))
    .digest("hex");
  const manifest = JSON.parse(
    fs.readFileSync("dist-electron/desktop-resources.manifest.json", "utf8"),
  );
  assert.equal(
    manifest.resources.find((entry) => entry.id === "app-server")?.sha256,
    summary.appServerSha256,
  );
  appServerEnv = resolveElectronAppServerRuntimeEnv({
    env: { ...runtimeEnv.env, APP_SERVER_BIN: binary },
  });
  appServerEnv.VITE_DEV_SERVER_URL = baseUrl;
  appServerEnv.APP_SERVER_APP_DATA_DIR = runtimeEnv.electronUserDataDir;
  await launch();
  await rpc("account/login/start", {
    type: "cloudAuthTokens",
    baseUrl,
    tenantId: tenant,
    accessToken: token,
  });
  await exercisePluginShareGui({
    handle,
    summary,
    baseUrl,
    draftRoot,
    evidenceDir,
  });
  const checkedOut = await rpc("plugin/share/checkout", {
    remotePluginId: "opaque~checkout",
  });
  const home = fs.realpathSync(runtimeEnv.home);
  assert.equal(checkedOut.pluginPath, path.join(home, "plugins/research-0"));
  assert.equal(
    checkedOut.marketplacePath,
    path.join(home, ".agents/plugins/marketplace.json"),
  );
  assert.equal(checkedOut.pluginId, "research-0@codex-curated");
  summary.identity = checkedOut;
  await visible("checkout");
  const editedFile = path.join(
    checkedOut.pluginPath,
    "skills/research-skill/SKILL.md",
  );
  const edited = `${fs.readFileSync(editedFile, "utf8")}\nUser edits retained.\n`;
  fs.writeFileSync(editedFile, edited);
  await closeElectronFixture(handle);
  handle = null;
  await launch();
  assert.deepEqual(
    await rpc("plugin/share/checkout", { remotePluginId: "opaque~checkout" }),
    checkedOut,
  );
  assert.equal(fs.readFileSync(editedFile, "utf8"), edited);
  await visible("cold-reuse");
  const { connectAppServerSidecar, stdioSidecar } =
    await import("../../packages/app-server-client/dist/index.js");
  peer = await connectAppServerSidecar(
    {
      ...stdioSidecar(binary, undefined, runtimeEnv.appServerDataDir),
      backendMode: "unavailable",
    },
    { clientInfo: { name: "checkout-fixture", version: "1" } },
    {
      env: { ...runtimeEnv.env, ...appServerEnv },
      initializeTimeoutMs: 30_000,
    },
  );
  const repeated = await peer.connection.request(
    peer.client.checkoutPluginShare({ remotePluginId: "opaque~checkout" }),
  );
  assert.deepEqual(repeated.result, checkedOut);
  const read = await peer.connection.request(
    peer.client.readPlugin({
      marketplacePath: checkedOut.marketplacePath,
      pluginName: checkedOut.pluginName,
    }),
  );
  assert.equal(read.result.plugin.summary.installed, false);
  assert.equal(fs.readFileSync(editedFile, "utf8"), edited);
  summary.checks.sharedStdio = true;
  assert.deepEqual(summary.downloads, [
    { accountHeaders: false, renderer: false },
  ]);
  assert(
    summary.requests.every(
      (request) =>
        !request.renderer &&
        !request.path.endsWith("/install") &&
        !request.path.endsWith("/uninstall"),
    ),
  );
  assert.equal(summary.share.uploads.length, 2);
  assert(
    summary.share.uploads.every(
      (upload) => upload.credentialFree && upload.hasHiddenMarker,
    ),
  );
  assert.equal(summary.consoleErrors.length, 0);
  assert.equal(summary.pageErrors.length, 0);
  assert.equal(
    createHash("sha256").update(fs.readFileSync(binary)).digest("hex"),
    summary.appServerSha256,
  );
  summary.ok = true;
} catch (error) {
  summary.failure = error instanceof Error ? error.message : String(error);
  if (handle)
    await handle.page
      .screenshot({ path: path.join(evidenceDir, "failure.png") })
      .catch(() => undefined);
  process.exitCode = 1;
} finally {
  if (peer) await peer.sidecar.close().catch(() => undefined);
  if (handle) await closeElectronFixture(handle);
  issuer.closeAllConnections();
  await new Promise((resolve) => issuer.close(resolve));
  const serialized = JSON.stringify(summary, null, 2);
  assert(
    !serialized.includes(token) && !serialized.includes(signature),
    "evidence must not include credentials",
  );
  fs.writeFileSync(path.join(evidenceDir, "summary.json"), `${serialized}\n`);
  lock.release();
  console.log(
    JSON.stringify({ ok: summary.ok, evidenceDir, failure: summary.failure }),
  );
}
