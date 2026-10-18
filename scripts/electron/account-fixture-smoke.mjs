import fs from "node:fs";
import { createHash } from "node:crypto";
import http from "node:http";
import path from "node:path";
import { resolveElectronAppServerRuntimeEnv } from "../lib/electron-app-server-assets.mjs";
import { resolveDevAppServerBinary } from "../lib/electron-dev-sidecar.mjs";
import {
  appServerCallFromPage,
  assert,
  closeElectronFixture,
  createTempRuntimeEnv,
  launchElectronFixture,
  openSettings,
  parseJsonRpcRequestsFromInvokeTrace,
  parseInvokeTraceRaw,
} from "./mcp-config-fixture-smoke.mjs";

const options = { timeoutMs: 120_000, intervalMs: 100 };
const evidenceDir = path.resolve(
  process.env.ACCOUNT_FIXTURE_EVIDENCE_DIR ||
    ".lime/qc/plugin-reconstruction/gui-account/electron",
);
const tenant = "account-fixture";
const tokens = ["fixture-account-private-one", "fixture-account-private-two"];
const runtimeEnv = createTempRuntimeEnv();
const observations = [];
const rendererRequests = [];
const consoleErrors = [];
const pageErrors = [];
const profile = (index) => ({
  token: tokens[index],
  tenant: { id: tenant, name: "Fixture", slug: tenant },
  user: {
    id: `user-${index}`,
    email: `account-${index}@example.test`,
    displayName: `Shared Account Fixture ${index}`,
    passwordConfigured: true,
    roles: ["customer"],
  },
  session: {
    id: `session-${index}`,
    tenantId: tenant,
    userId: `user-${index}`,
    provider: "password",
    roles: ["customer"],
    issuedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  },
});
const issuer = http.createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization",
  );
  response.setHeader("Content-Type", "application/json");
  if (request.method === "OPTIONS") {
    response.end();
    return;
  }
  const url = new URL(request.url, "http://fixture.test");
  if (!url.pathname.startsWith("/api/")) {
    if (url.pathname === "/oem-runtime-config.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(`window.__LIME_OEM_CLOUD__ = ${JSON.stringify(runtime)};`);
      return;
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
    ) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
      }[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file).pipe(response);
    return;
  }
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const tokenIndex = tokens.indexOf(
    String(request.headers.authorization || "").replace(/^Bearer /, ""),
  );
  observations.push({
    path: url.pathname,
    method: request.method,
    authenticated: tokenIndex >= 0,
    renderer: Boolean(
      request.headers.origin || request.headers["sec-fetch-mode"],
    ),
  });
  let data;
  if (url.pathname.endsWith("/auth/password/login")) {
    const input = JSON.parse(raw);
    assert(
      input.identifier === "fixture@example.test" &&
        input.password === "fixture-password",
      "unexpected login input",
    );
    data = profile(0);
  } else if (url.pathname.endsWith("/client/auth-catalog")) {
    data = {
      items: [],
      authPolicy: { required: false, startupTrigger: "none" },
    };
  } else if (tokenIndex < 0) {
    response.statusCode = 401;
    response.end(
      JSON.stringify({ code: 401, message: "fixture session required" }),
    );
    return;
  } else if (url.pathname.endsWith("/client/session")) {
    data = profile(tokenIndex);
  } else if (url.pathname.endsWith("/client/bootstrap")) {
    data = {
      session: profile(tokenIndex),
      providerOffersSummary: [],
      providerPreference: {
        tenantId: tenant,
        userId: `user-${tokenIndex}`,
        providerSource: "local",
        providerKey: "fixture",
        needsValidation: false,
      },
      sceneCatalog: [],
      features: {},
      gateway: { basePath: "/gateway-api" },
    };
  } else if (url.pathname.endsWith("/client/cloud-activation")) {
    data = {
      gateway: { basePath: "/gateway-api" },
      readiness: {
        status: "ready",
        title: "Fixture ready",
        canInvoke: false,
        blockers: [],
        steps: [],
      },
    };
  } else {
    data = { items: [] };
  }
  response.end(JSON.stringify({ code: 200, data }));
});
await new Promise((resolve) => issuer.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${issuer.address().port}`;
const runtime = { enabled: true, baseUrl, tenantId: tenant };
const binary = resolveDevAppServerBinary({
  env: runtimeEnv.env,
  repoRoot: process.cwd(),
  forceBuild: false,
});
const appServerEnv = resolveElectronAppServerRuntimeEnv({
  env: { ...runtimeEnv.env, APP_SERVER_BIN: binary },
});
appServerEnv.VITE_DEV_SERVER_URL = baseUrl;
appServerEnv.APP_SERVER_APP_DATA_DIR = runtimeEnv.electronUserDataDir;
const summary = {
  ok: false,
  proofLevel: "Desktop Gate B + real stdio",
  dependency: "controlled Core-shaped HTTP issuer",
  backendMode: "unavailable",
  modelTurn: false,
  checks: {},
  observations,
  rendererRequests,
  consoleErrors,
  pageErrors,
};
let handle;
let peer;
const methods = new Set();
fs.mkdirSync(evidenceDir, { recursive: true });
const binarySha256 = () =>
  createHash("sha256").update(fs.readFileSync(binary)).digest("hex");
summary.appServerSha256 = binarySha256();

async function launch() {
  console.log("[account-fixture] launching Electron");
  handle = await launchElectronFixture({
    options,
    runtimeEnv,
    appServerEnv,
    consoleErrors,
    pageErrors,
  });
  const { page } = handle;
  page.on("request", (request) => {
    if (request.url().startsWith(baseUrl))
      rendererRequests.push({
        path: new URL(request.url()).pathname,
        authenticated: Boolean(request.headers().authorization),
      });
  });
  await openAccount();
}

async function openAccount() {
  await openSettings(handle.page, options);
  await handle.page
    .locator('[data-testid="settings-sidebar-tab-profile"]')
    .click();
}

async function accountVisible(index) {
  const panel = handle.page.locator('[data-testid="oem-cloud-session-panel"]');
  await panel.waitFor({ state: "visible" });
  await panel
    .getByText(`Shared Account Fixture ${index}`, { exact: true })
    .first()
    .waitFor();
}

async function collectEvidence(stage) {
  const { page } = handle;
  const secretState = await page.evaluate((secrets) => {
    const storage = [
      ...Object.entries(localStorage),
      ...Object.entries(sessionStorage),
    ];
    const globals = [
      Reflect.get(window, "__LIME_SESSION_TOKEN__"),
      Reflect.get(window, "__LIME_BOOTSTRAP__"),
    ];
    return {
      storageContainsCredential: secrets.some((secret) =>
        JSON.stringify(storage).includes(secret),
      ),
      retiredGlobalsPresent: globals.some((value) => value !== undefined),
      retiredStoragePresent:
        localStorage.getItem("lime:oem-cloud-session:v1") !== null,
      preload:
        window.__LIME_ELECTRON__ === true &&
        typeof window.electronAPI?.invoke === "function",
      fallback: window.electronAPI?.devBridgeFallback !== false,
    };
  }, tokens);
  assert(
    secretState.preload && !secretState.fallback,
    "real Electron preload is required",
  );
  assert(
    !secretState.storageContainsCredential &&
      !secretState.retiredGlobalsPresent &&
      !secretState.retiredStoragePresent,
    "renderer retained an account credential",
  );
  const trace = await page.evaluate(() =>
    localStorage.getItem("lime_invoke_trace_buffer_v1"),
  );
  for (const request of parseJsonRpcRequestsFromInvokeTrace(trace))
    methods.add(request.method);
  summary.checks[stage] = secretState;
  await page.bringToFront();
  await page.screenshot({ path: path.join(evidenceDir, `${stage}.png`) });
  console.log(`[account-fixture] ${stage} verified`);
}

try {
  await launch();
  await handle.page.locator('[data-testid="oem-cloud-login-panel"]').waitFor();
  const alternative = handle.page.locator(
    '[data-testid="oem-cloud-toggle-alternative-login"]',
  );
  if (await alternative.isVisible()) await alternative.click();
  await handle.page
    .locator('[data-testid="oem-cloud-password-identifier"]')
    .fill("fixture@example.test");
  await handle.page
    .locator('[data-testid="oem-cloud-password-secret"]')
    .fill("fixture-password");
  await handle.page
    .locator('[data-testid="oem-cloud-password-submit"]')
    .click();
  await accountVisible(0);
  await collectEvidence("login");
  const credentialPath = path.join(
    runtimeEnv.electronUserDataDir,
    "credentials/account.json",
  );
  assert(fs.existsSync(credentialPath), "shared credential file is missing");
  summary.checks.privateFile =
    process.platform === "win32" ||
    (fs.statSync(credentialPath).mode & 0o077) === 0;
  assert(summary.checks.privateFile, "credential file is not private");

  const { connectAppServerSidecar, stdioSidecar } =
    await import("../../packages/app-server-client/dist/index.js");
  peer = await connectAppServerSidecar(
    {
      ...stdioSidecar(binary, undefined, runtimeEnv.appServerDataDir),
      backendMode: "unavailable",
    },
    { clientInfo: { name: "account-fixture", version: "1" } },
    { env: appServerEnv, initializeTimeoutMs: 30_000 },
  );
  const shared = (await peer.connection.request(peer.client.readAccount({})))
    .result;
  assert(
    shared.account?.sessionId === "session-0" &&
      !JSON.stringify(shared).includes(tokens[0]),
    "stdio did not read the GUI account metadata",
  );
  summary.checks.sharedStdioRead = true;
  await peer.connection.request(
    peer.client.loginAccount({
      type: "cloudAuthTokens",
      baseUrl,
      tenantId: tenant,
      accessToken: tokens[1],
    }),
  );
  await handle.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await accountVisible(1);
  await collectEvidence("peer-switch");

  await handle.page.reload();
  await openAccount();
  await accountVisible(1);
  await collectEvidence("reload");
  await closeElectronFixture(handle);
  handle = null;
  await launch();
  await accountVisible(1);
  await collectEvidence("cold-start");
  await handle.page.locator('[data-testid="oem-cloud-logout"]').click();
  await handle.page.locator('[data-testid="oem-cloud-login-panel"]').waitFor();
  const loggedOut = (await peer.connection.request(peer.client.readAccount({})))
    .result;
  assert(
    loggedOut.account === null && !fs.existsSync(credentialPath),
    "GUI logout did not clear the shared owner",
  );
  await collectEvidence("logout");
  assert(
    rendererRequests.every(
      (request) =>
        !request.authenticated &&
        !/\/client\/(session|bootstrap|cloud-activation)$/.test(request.path),
    ),
    "renderer sent an authenticated HTTP request",
  );
  assert(
    observations.some(
      (request) =>
        request.path.endsWith("/client/bootstrap") && request.authenticated,
    ),
    "shared authenticated HTTP was not observed",
  );
  assert(
    observations.every(
      (request) => !request.authenticated || !request.renderer,
    ),
    "issuer observed a renderer authenticated HTTP request",
  );
  const read = await appServerCallFromPage(handle.page, "account/read");
  assert(
    read.result.account === null && !JSON.stringify(read).includes(tokens[1]),
    "RPC metadata leaked a credential",
  );
  summary.methods = [...methods].sort();
  for (const method of [
    "account/login/start",
    "account/read",
    "account/logout",
    "cloud/request",
  ])
    assert(methods.has(method), `missing GUI RPC ${method}`);
  summary.invokeErrorCount = parseInvokeTraceRaw(
    await handle.page.evaluate(() =>
      localStorage.getItem("lime_invoke_error_buffer_v1"),
    ),
  ).length;
  assert(summary.invokeErrorCount === 0, "Electron invoke errors occurred");
  assert(pageErrors.length === 0, "renderer page errors occurred");
  assert(consoleErrors.length === 0, "Electron console errors occurred");
  summary.ok = true;
} catch (error) {
  summary.error = String(error?.stack || error);
  await handle?.page
    .screenshot({ path: path.join(evidenceDir, "failure.png") })
    .catch(() => undefined);
  process.exitCode = 1;
} finally {
  await peer?.sidecar.close().catch(() => undefined);
  await closeElectronFixture(handle);
  await new Promise((resolve) => issuer.close(resolve));
  summary.appServerDigestStable = summary.appServerSha256 === binarySha256();
  if (!summary.appServerDigestStable) {
    summary.ok = false;
    process.exitCode = 1;
  }
  const text = JSON.stringify(summary, null, 2);
  assert(
    tokens.every((token) => !text.includes(token)),
    "evidence contains a credential",
  );
  fs.writeFileSync(path.join(evidenceDir, "summary.json"), `${text}\n`);
  console.log(text);
  fs.rmSync(runtimeEnv.tempRoot, { recursive: true, force: true });
}
