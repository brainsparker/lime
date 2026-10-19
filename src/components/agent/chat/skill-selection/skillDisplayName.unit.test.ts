import { describe, expect, it } from "vitest";
import { skillDisplayName } from "./skillDisplayName";

describe("skill mention display name", () => {
  it.each([
    ["review-code", "Review Code"],
    ["plugin:review_code", "Plugin: Review Code"],
    ["work-with-apis", "Work with APIs"],
    ["github-and-sqlite", "GitHub and SQLite"],
    ["openai-llm-to-pdf", "OpenAI LLM to PDF"],
    ["api-ui-up", "API UI up"],
    ["review-PRs", "Review PRs"],
    ["审核_代码", "审核 代码"],
  ])("formats %s as %s without changing canonical name", (name, display) => {
    expect(skillDisplayName({ name })).toBe(display);
  });

  it("uses the explicit display name and trims only surrounding whitespace", () => {
    expect(
      skillDisplayName({
        name: "review-code",
        displayName: "  品牌 A · 审阅  ",
      }),
    ).toBe("品牌 A · 审阅");
    expect(skillDisplayName({ name: "review-code", displayName: "  " })).toBe(
      "Review Code",
    );
  });
});
