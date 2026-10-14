import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyUserMessageFullText,
  readCollapseDom,
} from "./claw-chat-current-fixture-user-message-collapse.mjs";
import { collapseTextIdentity } from "./claw-chat-current-fixture-user-message-collapse-evidence.mjs";

describe("rendered Markdown body observations", () => {
  const selectors = {
    root: '[data-testid="collapsible-user-message-content"]',
    viewport: '[data-testid="user-message-content-viewport"]',
    full: '[data-testid="user-message-content-full"]',
    toggle: '[data-testid="user-message-content-toggle"]',
    footer: '[data-testid="user-message-footer"]',
  };

  function observe(body, parts) {
    document.body.innerHTML = `<div data-message-role="user" data-thread-item-id="fixture-item"><div data-testid="collapsible-user-message-content"><div data-testid="user-message-content-viewport"><div data-testid="user-message-content-full">${body}</div></div></div></div>`;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });
    return readCollapseDom({
      selectors,
      copyButtonName: "Copy",
      expected: {
        itemId: "fixture-item",
        text: "prompt [label](https://example.invalid) ```ts\ncode\n``` tail",
        headText: "prompt",
        renderedTextParts: parts,
      },
    }).renderedFullTextPresent;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("keeps ordered Markdown material despite code header controls", () => {
    expect(
      observe(
        "<p>prompt</p><p><a>label</a></p><div>ts 1 line</div><pre><code>code</code></pre><p>tail</p>",
        ["prompt", "label", "code", "tail"],
      ),
    ).toBe(true);
  });

  it.each([
    ["<p>prompt label tail</p>", ["prompt", "label", "code", "tail"]],
    ["<p>prompt code label tail</p>", ["prompt", "label", "code", "tail"]],
    ["<p>prompt label code tail</p>", []],
    ["<p>prompt label code tail</p>", ["prompt", "", "tail"]],
  ])(
    "rejects missing, reordered, or empty body expectations",
    (body, parts) => {
      expect(observe(body, parts)).toBe(false);
    },
  );

  it("keeps exact plain-text expectations when no parts are supplied", () => {
    expect(observe("<p>prompt label code tail</p>")).toBe(false);
  });
});
describe("UserMessage clipboard delivery helper with controlled callbacks", () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  afterEach(() => {
    window.__limeClipboardWriteObservation?.stop();
    if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
    else delete navigator.clipboard;
  });
  function clipboardFixture({
    delivered = "完整正文😀",
    clickFailure = false,
    stale = false,
    count = 1,
  } = {}) {
    let clipboard = "original clipboard";
    let clicks = 0;
    let writes = 0;
    const expectedText = "完整正文😀";
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          clipboard = text;
        },
      },
      configurable: true,
    });
    const args = {
      page: { evaluate: async (callback, argument) => callback(argument) },
      expectedText,
      phase: "collapsed",
      timeoutMs: 1,
      readClipboardText: async () => clipboard,
      writeClipboardText: async (value) => {
        writes += 1;
        if (!stale || writes > 1) clipboard = value;
      },
      copyButton: {
        count: async () => count,
        click: async () => {
          clicks += 1;
          if (clickFailure) throw new Error("controlled click failure");
          await navigator.clipboard.writeText(delivered);
        },
      },
    };
    return { args, state: () => ({ clipboard, clicks, writes }) };
  }

  it("requires a fresh sentinel before accepting precise Unicode delivery and restores the clipboard", async () => {
    const fixture = clipboardFixture();
    const result = await copyUserMessageFullText(fixture.args);
    expect(result).toMatchObject({
      sentinelObserved: true,
      buttonClicked: true,
      fullTextMatched: true,
      textIdentity: collapseTextIdentity(fixture.args.expectedText),
    });
    expect(fixture.state()).toEqual({
      clipboard: "original clipboard",
      clicks: 1,
      writes: 2,
    });
    expect(result).not.toHaveProperty("text");
  });

  it("does not accept an old clipboard when sentinel delivery fails", async () => {
    const fixture = clipboardFixture({ stale: true });
    await expect(copyUserMessageFullText(fixture.args)).rejects.toThrow(
      "sentinel",
    );
    expect(fixture.state()).toEqual({
      clipboard: "original clipboard",
      clicks: 0,
      writes: 2,
    });
  });

  it("restores the previous clipboard when a real-action callback fails", async () => {
    const fixture = clipboardFixture({ clickFailure: true });
    await expect(copyUserMessageFullText(fixture.args)).rejects.toThrow(
      "controlled click failure",
    );
    expect(fixture.state()).toEqual({
      clipboard: "original clipboard",
      clicks: 1,
      writes: 2,
    });
  });

  it("reports prefix delivery as a failure and restores the clipboard", async () => {
    const fixture = clipboardFixture({ delivered: "完整" });
    const result = await copyUserMessageFullText(fixture.args);
    expect(result.fullTextMatched).toBe(false);
    expect(result.textIdentity).toEqual(collapseTextIdentity("完整"));
    expect(fixture.state().clipboard).toBe("original clipboard");
  });

  it("rejects duplicate copy controls before modifying the clipboard", async () => {
    const fixture = clipboardFixture({ count: 2 });
    await expect(copyUserMessageFullText(fixture.args)).rejects.toThrow(
      "exact UserMessage",
    );
    expect(fixture.state()).toEqual({
      clipboard: "original clipboard",
      clicks: 0,
      writes: 0,
    });
  });

  it("fails closed without a host clipboard reader", async () => {
    const fixture = clipboardFixture();
    delete fixture.args.readClipboardText;
    await expect(copyUserMessageFullText(fixture.args)).rejects.toThrow(
      "exact UserMessage",
    );
    expect(fixture.state().writes).toBe(0);
  });
});
