import { describe, expect, it, vi } from "vitest";
vi.mock("./api/appConfig", () => ({}));
import {
  externalBrowserUrl,
  isLocalLink,
  readLinkClickIntent,
  resolveLinkOpening,
} from "./linkOpening";

describe("packaged link opening policy", () => {
  it.each([
    ["http://LOCALHOST/", true],
    ["https://demo.localhost/", true],
    ["http://127.0.0.1:4100/", true],
    ["http://127.0.0.2/", false],
    ["http://0.0.0.0/", true],
    ["http://[::1]/", true],
    ["https://localhost.example.com/", false],
    ["file:///tmp/report.pdf", true],
    ["file:///C:/report.txt", true],
    ["file://localhost/tmp/a.txt", true],
    ["file://server/share/a.html", false],
    ["file:////server/share/a.html", false],
    ["file://///server/share/a.html", false],
    ["file:///%2F%2Fserver/share/a.html", true],
  ])(
    "classifies %s without expanding localhost or decoding file paths",
    (url, local) => {
      expect(isLocalLink(new URL(url as string))).toBe(local);
    },
  );

  it.each([
    [
      "MacIntel",
      { metaKey: true },
      { clickModifiers: "primary", disposition: "new-background-tab" },
    ],
    ["MacIntel", { ctrlKey: true }, {}],
    [
      "Win32",
      { ctrlKey: true, shiftKey: true },
      { clickModifiers: "primary-shift", disposition: "new-tab" },
    ],
    ["Win32", { metaKey: true }, {}],
    [
      "iPad",
      { metaKey: true, altKey: true },
      { disposition: "new-background-tab" },
    ],
    [
      "MacIntel",
      { metaKey: true, ctrlKey: true },
      { disposition: "new-background-tab" },
    ],
    ["Linux", { altKey: true }, { clickModifiers: "alt" }],
    ["Linux", { altKey: true, shiftKey: true }, {}],
    ["MacIntel", { button: 1 }, { disposition: "new-background-tab" }],
    ["Win32", { button: 1, shiftKey: true }, { disposition: "new-tab" }],
  ] as const)(
    "preserves exact platform/modifier intent on %s with %j",
    (platform, click, expected) => {
      expect(readLinkClickIntent(click, platform)).toEqual(expected);
    },
  );

  it("keeps web/local preferences independent and gives the configured shortcut priority over new-tab disposition", () => {
    const input = {
      url: "http://localhost:4000",
      browserAvailable: true,
      platform: "MacIntel",
    };
    expect(resolveLinkOpening(input)).toEqual({ target: "in-app-browser" });
    expect(
      resolveLinkOpening({ ...input, url: "https://example.com" }),
    ).toEqual({ target: "external-browser" });
    expect(
      resolveLinkOpening({
        ...input,
        preferences: {
          "open-local-url-in-target-preference": "external-browser",
        },
      }),
    ).toEqual({ target: "external-browser" });
    expect(resolveLinkOpening({ ...input, click: { metaKey: true } })).toEqual({
      target: "external-browser",
      disposition: "new-background-tab",
    });
    expect(
      resolveLinkOpening({
        ...input,
        click: { metaKey: true, shiftKey: true },
      }),
    ).toEqual({ target: "in-app-browser", disposition: "new-tab" });
    expect(
      resolveLinkOpening({
        ...input,
        click: { metaKey: true },
        preferences: { "external-browser-link-shortcut": "unassigned" },
      }),
    ).toEqual({ target: "in-app-browser", disposition: "new-background-tab" });
    expect(
      resolveLinkOpening({
        ...input,
        click: { button: 1 },
        preferences: {
          "open-local-url-in-target-preference": "external-browser",
        },
      }),
    ).toEqual({ target: "in-app-browser", disposition: "new-background-tab" });
  });

  it("honors explicit/forced targets, capability and native default-browser precedence", () => {
    const input = {
      url: "http://localhost:4000",
      browserAvailable: true,
      platform: "Win32",
      click: { ctrlKey: true },
    };
    expect(
      resolveLinkOpening({ ...input, openTarget: "in-app-browser" })?.target,
    ).toBe("in-app-browser");
    expect(
      resolveLinkOpening({ ...input, useExternalBrowser: true })?.target,
    ).toBe("external-browser");
    expect(
      resolveLinkOpening({ ...input, browserAvailable: false })?.target,
    ).toBe("external-browser");
    expect(
      resolveLinkOpening({ ...input, isDefaultBrowser: true })?.target,
    ).toBe("in-app-browser");
    expect(
      resolveLinkOpening({
        ...input,
        openTarget: "external-browser",
        isDefaultBrowser: true,
      })?.target,
    ).toBe("external-browser");
    for (const url of [
      "invalid",
      "javascript:alert(1)",
      "data:text/html,hello",
    ])
      expect(resolveLinkOpening({ ...input, url })).toBeNull();
    expect(resolveLinkOpening({ ...input, click: { button: 2 } })).toBeNull();
  });

  it("adds the native ChatGPT external return parameter without changing other hosts or protocols", () => {
    expect(externalBrowserUrl("https://chatgpt.com/demo?foo=1#bar")).toBe(
      "https://chatgpt.com/demo?foo=1&no_universal_links=1#bar",
    );
    for (const url of [
      "http://chatgpt.com/",
      "https://example.com/",
      "https://chatgpt.com.example.com/",
    ])
      expect(externalBrowserUrl(url)).toBe(url);
  });
});
