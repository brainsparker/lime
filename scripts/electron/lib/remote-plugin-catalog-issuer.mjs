import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { remotePluginBundle } from "./remote-plugin-bundle-fixture.mjs";

function respondPluginSkill({ request, response, url, index, state }) {
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

export function createRemotePluginIssuer({
  rootDir,
  evidenceDir,
  tokens,
  tenant,
  remoteScope,
  getBaseUrl,
  profile,
  plugin,
  installedAccounts,
  skillPreview,
  observations,
  bundleRequests,
  issuerErrors,
  preferences = { fail: false, writes: [] },
}) {
  const enabledByAccount = new Map();
  const disabledSkillsByAccount = new Map();
  const respond = async (request, response) => {
    const url = new URL(request.url, "http://fixture.test");
    if (url.pathname.startsWith("/signed-bundle/")) {
      const index = Number(url.pathname.split("/").at(-1));
      const accountHeaders = Boolean(
        request.headers.authorization || request.headers.cookie,
      );
      const renderer = Boolean(
        request.headers.origin || request.headers["sec-fetch-mode"],
      );
      bundleRequests.push({ index, accountHeaders, renderer });
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index > 1 ||
        accountHeaders ||
        renderer
      ) {
        response.writeHead(400).end();
        return;
      }
      response.setHeader("Content-Type", "application/gzip");
      response.end(
        remotePluginBundle(
          index,
          remoteScope === "GLOBAL" ? "bundle-version" : "1.0.0",
        ),
      );
      return;
    }
    if (!url.pathname.startsWith("/api/")) {
      if (url.pathname === "/oem-runtime-config.js") {
        response.setHeader("Content-Type", "application/javascript");
        response.end(
          `window.__LIME_OEM_CLOUD__ = ${JSON.stringify({ enabled: true, baseUrl: getBaseUrl(), tenantId: tenant })};`,
        );
        return;
      }
      const root = path.resolve(rootDir, "dist");
      const file = path.resolve(
        root,
        `.${url.pathname === "/" ? "/index.html" : url.pathname}`,
      );
      if (
        !file.startsWith(`${root}${path.sep}`) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile()
      ) {
        response.writeHead(404).end();
        return;
      }
      response.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".json": "application/json",
          ".png": "image/png",
          ".woff2": "font/woff2",
        }[path.extname(file)] || "application/octet-stream",
      );
      fs.createReadStream(file).pipe(response);
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Access-Control-Allow-Origin", "*");
    const index = tokens.indexOf(
      String(request.headers.authorization || "").replace(/^Bearer /, ""),
    );
    const observation = {
      method: request.method,
      accountIndex: index,
      time: Date.now(),
      path: url.pathname,
      query: url.search,
      authenticated: index >= 0,
      renderer: Boolean(
        request.headers.origin || request.headers["sec-fetch-mode"],
      ),
    };
    observations.push(observation);
    response.once("finish", () => {
      observation.status = response.statusCode;
    });
    request.once("aborted", () => {
      observation.aborted = true;
    });
    if (url.pathname.endsWith("/client/auth-catalog")) {
      response.end(
        JSON.stringify({
          code: 200,
          data: {
            items: [],
            authPolicy: { required: false, startupTrigger: "none" },
          },
        }),
      );
      return;
    }
    if (index < 0) {
      response.writeHead(401).end(
        JSON.stringify({
          code: 401,
          message: "fixture authentication required",
        }),
      );
      return;
    }
    if (url.pathname.endsWith("/client/ps/plugins/installed")) {
      assert.equal(request.method, "GET");
      const includeDownloadUrls = url.searchParams.get("includeDownloadUrls");
      assert(["true", "false"].includes(includeDownloadUrls));
      const installed = {
        ...plugin(index),
        enabled: enabledByAccount.get(index) ?? true,
        disabled_skill_names: disabledSkillsByAccount.get(index) ?? [
          "research-skill",
        ],
        installed_at: "2026-10-18T00:00:00Z",
      };
      if (includeDownloadUrls === "false") {
        delete installed.release.bundle_download_url;
      }
      response.end(
        JSON.stringify({
          plugins: installedAccounts.has(index) ? [installed] : [],
          pagination: { next_page_token: null },
        }),
      );
      return;
    }
    if (
      url.pathname.endsWith("/client/ps/plugins/workspace/created") ||
      url.pathname.endsWith("/client/ps/plugins/workspace/shared")
    ) {
      assert.equal(request.method, "GET");
      response.end(
        JSON.stringify({ plugins: [], pagination: { next_page_token: null } }),
      );
      return;
    }
    if (url.pathname.endsWith("/client/ps/plugins/list")) {
      response.end(
        JSON.stringify({
          plugins:
            url.searchParams.get("scope") === remoteScope
              ? [plugin(index)]
              : [],
          pagination: { next_page_token: null },
        }),
      );
      return;
    }
    if (
      url.pathname.endsWith(
        `/client/ps/plugins/opaque~${index}/skills/research-skill/enable`,
      ) ||
      url.pathname.endsWith(
        `/client/ps/plugins/opaque~${index}/skills/research-skill/disable`,
      )
    ) {
      assert.equal(request.method, "POST");
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      assert.equal(Buffer.concat(chunks).length, 0);
      assert.equal(url.search, "");
      if (!installedAccounts.has(index)) {
        response.writeHead(404).end(JSON.stringify({ code: 404 }));
        return;
      }
      if (preferences.fail) {
        response.writeHead(500).end(JSON.stringify({ code: 500 }));
        return;
      }
      const enabled = url.pathname.endsWith("/enable");
      disabledSkillsByAccount.set(index, enabled ? [] : ["research-skill"]);
      (preferences.skillWrites ??= []).push({
        index,
        skillName: "research-skill",
        enabled,
      });
      response.end(JSON.stringify({ id: `opaque~${index}`, enabled }));
      return;
    }
    if (
      url.pathname.endsWith(`/client/ps/plugins/opaque~${index}/enable`) ||
      url.pathname.endsWith(`/client/ps/plugins/opaque~${index}/disable`)
    ) {
      assert.equal(request.method, "POST");
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      assert.equal(Buffer.concat(chunks).length, 0);
      assert.equal(url.search, "");
      if (!installedAccounts.has(index)) {
        response.writeHead(404).end(JSON.stringify({ code: 404 }));
        return;
      }
      if (preferences.fail) {
        response.writeHead(500).end(
          JSON.stringify({
            code: 500,
            message: "fixture persistence failure",
          }),
        );
        return;
      }
      const enabled = url.pathname.endsWith("/enable");
      enabledByAccount.set(index, enabled);
      preferences.writes.push({ index, enabled });
      response.end(JSON.stringify({ id: `opaque~${index}`, enabled }));
      return;
    }
    if (
      url.pathname.endsWith(`/client/ps/plugins/opaque~${index}/install`) ||
      url.pathname.endsWith(`/client/ps/plugins/opaque~${index}/uninstall`)
    ) {
      assert.equal(request.method, "POST", "remote mutations must use POST");
      const installing = url.pathname.endsWith("/install");
      assert.equal(
        url.searchParams.get("includeAppsNeedingAuth"),
        installing ? "true" : null,
        "install must request the server's app authorization facts",
      );
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      if (body) {
        const payload = JSON.parse(body);
        assert.deepEqual(Object.keys(payload), ["install_attempt_id"]);
      }
      if (installing) {
        installedAccounts.add(index);
        enabledByAccount.set(index, true);
      } else {
        installedAccounts.delete(index);
        enabledByAccount.delete(index);
        disabledSkillsByAccount.delete(index);
      }
      response.end(
        JSON.stringify({ id: `opaque~${index}`, enabled: installing }),
      );
      return;
    }
    if (
      respondPluginSkill({ request, response, url, index, state: skillPreview })
    )
      return;
    if (url.pathname.includes("/client/ps/plugins/")) {
      assert(
        url.pathname.endsWith(`/opaque~${index}`),
        `GUI must send the opaque service ID; actual path=${url.pathname}`,
      );
      assert(
        ["false", "true"].includes(url.searchParams.get("includeDownloadUrls")),
        "detail must declare its download URL requirement",
      );
      response.end(JSON.stringify(plugin(index)));
      return;
    }
    const data = url.pathname.endsWith("/client/session")
      ? profile(index)
      : url.pathname.endsWith("/client/bootstrap")
        ? {
            session: profile(index),
            providerOffersSummary: [],
            providerPreference: {
              tenantId: tenant,
              userId: `user-${index}`,
              providerSource: "local",
              providerKey: "fixture",
              needsValidation: false,
            },
            sceneCatalog: [],
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
    response.end(JSON.stringify({ code: 200, data }));
  };
  return http.createServer((request, response) => {
    void respond(request, response).catch((error) => {
      issuerErrors.push({
        method: request.method,
        path: new URL(request.url, "http://fixture.test").pathname,
        message: error instanceof Error ? error.message : String(error),
      });
      fs.writeFileSync(
        path.join(evidenceDir, "issuer-errors.json"),
        `${JSON.stringify(issuerErrors, null, 2)}\n`,
      );
      if (!response.headersSent) response.writeHead(500);
      response.end(JSON.stringify({ message: "fixture request rejected" }));
    });
  });
}
