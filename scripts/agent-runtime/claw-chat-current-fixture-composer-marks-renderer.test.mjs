import { afterEach, describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "../../src/components/agent/chat/components/MarkdownRenderer.testHarness.tsx";
import { composerMarksFixture } from "./claw-chat-current-fixture-composer-marks.mjs";
import { readCollapseDom } from "./claw-chat-current-fixture-user-message-collapse.mjs";

const observedBubbles = [];
afterEach(() => {
  for (const bubble of observedBubbles.splice(0)) bubble.remove();
  vi.restoreAllMocks();
});

const selectors = {
  root: '[data-testid="collapsible-user-message-content"]',
  viewport: '[data-testid="user-message-content-viewport"]',
  full: '[data-testid="user-message-content-full"]',
  toggle: '[data-testid="user-message-content-toggle"]',
  footer: '[data-testid="user-message-footer"]',
};

function fixture() {
  return composerMarksFixture({
    prompt: "请结合这个截图、文件和 Capability Report 技能，先不要输出正文。",
    skillIdentity: {
      name: "capability-report",
      key: "user:capability-report",
    },
    pasteText: "历史粘贴验证😀\n".repeat(180),
  });
}

describe("marks fixture against the current Markdown renderer", () => {
  it("retains all independently specified rendered body parts", () => {
    const expected = fixture();
    const container = renderMarkdown(expected.text);
    const normalized = (text) => text.replace(/\s+/gu, " ").trim();
    const observed = normalized(container.textContent);
    let offset = 0;
    for (const [index, part] of expected.renderedTextParts.entries()) {
      const start = observed.indexOf(normalized(part), offset);
      expect(start, `rendered body part ${index}`).toBeGreaterThanOrEqual(0);
      offset = start + normalized(part).length;
    }
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.invalid/marks",
    );
    expect(container.querySelector("a")?.getAttribute("title")).toBe("标题");
    expect(container.querySelector("code")?.textContent).toBe(
      "  const value = '中😀';\n````\n\n",
    );
  });

  it("uses rendered parts while canonical and clipboard expectations keep raw Markdown", () => {
    const expected = fixture();
    const container = renderMarkdown(expected.text);
    const bubble = document.createElement("div");
    bubble.setAttribute("data-message-role", "user");
    bubble.setAttribute("data-thread-item-id", "fixture-item");
    bubble.innerHTML =
      '<div data-testid="collapsible-user-message-content"><div data-testid="user-message-content-viewport"><div data-testid="user-message-content-full"></div></div></div>';
    bubble.querySelector(selectors.full).append(container.cloneNode(true));
    document.body.append(bubble);
    observedBubbles.push(bubble);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });
    const observe = (renderedTextParts) =>
      readCollapseDom({
        selectors,
        copyButtonName: "Copy",
        expected: {
          itemId: "fixture-item",
          text: expected.text,
          headText:
            "请结合这个截图、文件和 Capability Report 技能，先不要输出正文。",
          renderedTextParts,
        },
      }).renderedFullTextPresent;
    expect(observe(undefined)).toBe(false);
    expect(observe(expected.renderedTextParts)).toBe(true);
    expect(expected.text).toContain(
      '[中😀](https://example.invalid/marks "标题")',
    );
    expect(expected.text).toContain(
      "`````typescript\n  const value = '中😀';\n````\n\n\n`````",
    );
  });
});
