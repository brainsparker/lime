import { expect, it } from "vitest";
import { assertBrowserPreferenceReadback } from "./settings-browser-preferences-scenario.mjs";

const preferences = {
  "open-link-in-target-preference": "in-app-browser",
  "open-local-url-in-target-preference": "external-browser",
  "external-browser-link-shortcut": "alt",
};
function facts() {
  return {
    snapshot: {
      config: { desktop: { ...preferences }, untouched: "private-credential" },
      filePath: "/isolated/config.yaml",
      response: {
        ipcObservation: {
          electron: true,
          fallback: false,
          command: "app_server_handle_json_lines",
          transport: "electron-ipc",
          status: "success",
          method: "config/read",
          requestId: "same-read",
          responseId: "same-read",
        },
      },
    },
    disk: { desktop: { ...preferences } },
    expected: { ...preferences },
    initial: { untouched: "private-credential" },
    configPath: "/isolated/config.yaml",
  };
}

it("requires native identity, exact public/disk values and unchanged unrelated configuration without serializing credentials", () => {
  const proof = assertBrowserPreferenceReadback(facts());
  expect(Object.values(proof).every(Boolean)).toBe(true);
  expect(JSON.stringify(proof)).not.toMatch(/private-credential|same-read/);
});

it.each([
  { electron: false },
  { fallback: true },
  { transport: "renderer-mock" },
  { command: "legacy" },
  { method: "config/batchWrite" },
  { status: "error" },
  { responseId: "another-read" },
])("rejects substituted readback provenance %j", (patch) => {
  const input = facts();
  Object.assign(input.snapshot.response.ipcObservation, patch);
  expect(() => assertBrowserPreferenceReadback(input)).toThrow(
    /current preload/,
  );
});

it.each(["snapshot", "disk"])(
  "rejects one lost preference in %s even when the other two match",
  (part) => {
    for (const key of Object.keys(preferences)) {
      const input = facts();
      const config = part === "snapshot" ? input.snapshot.config : input.disk;
      delete config.desktop[key];
      expect(() => assertBrowserPreferenceReadback(input)).toThrow(
        /exact preference/,
      );
    }
  },
);

it("rejects the wrong user layer and unrelated writes without exposing config values", () => {
  const input = facts();
  input.snapshot.filePath = "/another/config.yaml";
  expect(() => assertBrowserPreferenceReadback(input)).toThrow(
    /isolated user layer/,
  );
  input.snapshot.filePath = input.configPath;
  input.snapshot.config.untouched = "changed-credential";
  try {
    assertBrowserPreferenceReadback(input);
    throw new Error("unexpected pass");
  } catch (error) {
    expect(error.message).toContain("unrelated configuration");
    expect(error.message).not.toMatch(/private-credential|changed-credential/);
  }
});

it("retains absent Web/Local identities while accepting the canonical primary shortcut default", () => {
  const input = facts();
  input.expected = {};
  input.disk = {};
  delete input.snapshot.config.desktop;
  expect(assertBrowserPreferenceReadback(input).publicValues).toBe(true);
  input.snapshot.config.desktop = {
    "open-link-in-target-preference": "external-browser",
  };
  expect(() => assertBrowserPreferenceReadback(input)).toThrow(
    /exact preference/,
  );
});
