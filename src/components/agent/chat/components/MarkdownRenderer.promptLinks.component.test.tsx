import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Skill } from "@/lib/api/skills";
import {
  getMarkdownRendererMocks,
  renderMarkdown,
  renderMarkdownHarness,
} from "./MarkdownRenderer.testHarness";

const skill: Skill = {
  key: "user:review",
  name: "review",
  displayName: "审阅变更",
  description: "Review changes",
  directory: "review",
  localDirectoryPath: "/skills/review",
  installed: true,
  sourceKind: "other",
};

function scope(skills: Skill[] = [skill], loading = false) {
  return { skills, loading, requestSkills: vi.fn(), openSkill: vi.fn() };
}

describe("Markdown Skill prompt links", () => {
  it("renders the inline glyph and display name, preserving canonical copy identity", () => {
    const catalog = scope();
    const container = renderMarkdown(
      "中😀 [$review](/skills/review/SKILL.md) end",
      {
        promptLinkScope: catalog,
        promptLinkItemId: "item-user-1",
      },
    );
    const mention = container.querySelector<HTMLElement>(
      "[data-prompt-link-href]",
    )!;
    expect(container.textContent).toBe("中😀 审阅变更 end");
    expect(mention.dataset.promptLinkHref).toBe("/skills/review/SKILL.md");
    expect(mention.dataset.promptLinkLabel).toBe("$review");
    expect(mention.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 20 20",
    );
    expect(mention.getAttribute("role")).toBe("button");
    expect(mention.tabIndex).toBe(0);
    expect(catalog.requestSkills).toHaveBeenCalledOnce();
    act(() => mention.click());
    expect(catalog.openSkill).toHaveBeenCalledExactlyOnceWith(
      "/skills/review/SKILL.md",
      "item-user-1",
    );
    expect(
      getMarkdownRendererMocks().openExternalUrlWithSystemBrowser,
    ).not.toHaveBeenCalled();
  });

  it("opens Enter on keydown and Space on keyup without duplicate activation", () => {
    const catalog = scope();
    const container = renderMarkdown("[$review](/skills/review/SKILL.md)", {
      promptLinkScope: catalog,
      promptLinkItemId: "item-user-2",
    });
    const mention = container.querySelector<HTMLElement>("[role=button]")!;
    act(() =>
      mention.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    act(() =>
      mention.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(catalog.openSkill).toHaveBeenCalledTimes(1);
    act(() =>
      mention.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(catalog.openSkill).toHaveBeenCalledTimes(1);
    act(() =>
      mention.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(catalog.openSkill).toHaveBeenCalledTimes(2);
  });

  it("keeps unresolved, ambiguous, loading and context-free references visible and noninteractive", () => {
    for (const catalog of [
      scope([]),
      scope([skill, { ...skill, key: "second" }]),
      scope([skill], true),
      undefined,
    ]) {
      const container = renderMarkdown("[$review](/skills/review/SKILL.md)", {
        promptLinkScope: catalog,
        promptLinkItemId: "item-user-3",
      });
      const mention = container.querySelector<HTMLElement>(
        "[data-prompt-link-href]",
      )!;
      expect(mention).not.toBeNull();
      expect(mention.getAttribute("role")).toBeNull();
      expect(mention.getAttribute("tabindex")).toBeNull();
      act(() => mention.click());
      expect(catalog?.openSkill ?? vi.fn()).not.toHaveBeenCalled();
    }
  });

  it("updates the same body from late catalog data and removes stale navigation", () => {
    const catalog = scope([], true);
    const body = "[$review](/skills/review/SKILL.md)";
    const { container, rerender } = renderMarkdownHarness(body, {
      promptLinkScope: catalog,
      promptLinkItemId: "item-user-4",
    });
    expect(container.textContent).toBe("$review");
    const loaded = { ...catalog, skills: [skill], loading: false };
    rerender(body, { promptLinkScope: loaded });
    expect(container.textContent).toBe("审阅变更");
    expect(container.querySelector("[role=button]")).not.toBeNull();
    rerender(body, { promptLinkScope: { ...loaded, skills: [] } });
    expect(container.textContent).toBe("$review");
    expect(container.querySelector("[role=button]")).toBeNull();
  });

  it("does not turn bare text, code or an HTTP label into a local Skill binding", () => {
    const catalog = scope();
    const container = renderMarkdown(
      "$review `[$review](/skills/review/SKILL.md)` [$review](https://example.org)",
      { promptLinkScope: catalog },
    );
    expect(container.querySelector("[data-prompt-link-href]")).toBeNull();
    expect(container.querySelector<HTMLAnchorElement>("a")?.href).toBe(
      "https://example.org/",
    );
    expect(catalog.requestSkills).not.toHaveBeenCalled();
  });

  it("preserves a formatted Markdown label without dropping its child content", () => {
    const catalog = scope();
    const container = renderMarkdown(
      "[$review **details**](/missing/SKILL.md)",
      { promptLinkScope: catalog },
    );
    expect(container.textContent).toBe("$review **details**");
    expect(
      container.querySelector<HTMLElement>("[data-prompt-link-label]")?.dataset
        .promptLinkLabel,
    ).toBe("$review **details**");
    expect(container.querySelector("[role=button]")).toBeNull();
  });

  it.each([
    ["/skills/中文 审阅/SKILL.md", "[$review](/skills/中文 审阅/SKILL.md)"],
    ["C:/skills/review/SKILL.md", "[$review](C:/skills/review/SKILL.md)"],
  ])(
    "preserves the original resource path %s before URL transforms",
    (path, body) => {
      const catalog = scope([{ ...skill, localDirectoryPath: path }]);
      const container = renderMarkdown(body, {
        promptLinkScope: catalog,
        promptLinkItemId: "item-path",
      });
      const mention = container.querySelector<HTMLElement>(
        "[data-prompt-link-href]",
      )!;
      expect(mention.dataset.promptLinkHref).toBe(path);
      expect(container.textContent).toBe("审阅变更");
      act(() => mention.click());
      expect(catalog.openSkill).toHaveBeenCalledWith(path, "item-path");
    },
  );

  it("uses explicit display metadata without changing the linked catalog path", () => {
    const catalog = scope();
    const container = renderMarkdown(
      "[$review?label=%E5%AE%A1%E9%98%85](/skills/review/SKILL.md)",
      { promptLinkScope: catalog, promptLinkItemId: "item-user-5" },
    );
    expect(container.textContent).toBe("审阅");
    act(() => container.querySelector<HTMLElement>("[role=button]")!.click());
    expect(catalog.openSkill).toHaveBeenCalledWith(
      "/skills/review/SKILL.md",
      "item-user-5",
    );
  });

  it("keeps multiple Skill links distinct from surrounding math", () => {
    const container = renderMarkdown(
      "中😀 [$review](/skills/review/SKILL.md) [$missing](/missing/SKILL.md) [$review?label=目录引用](/skills/review/SKILL.md) $x+y$",
      { promptLinkScope: scope(), promptLinkItemId: "item-multiple" },
    );
    const mentions = container.querySelectorAll<HTMLElement>(
      "[data-prompt-link-label]",
    );
    expect(
      Array.from(mentions, (mention) => mention.dataset.promptLinkLabel),
    ).toEqual(["$review", "$missing", "$review?label=目录引用"]);
    expect(Array.from(mentions, (mention) => mention.textContent)).toEqual([
      "审阅变更",
      "$missing",
      "目录引用",
    ]);
    expect(container.querySelectorAll(".katex")).toHaveLength(1);
    expect(container.querySelector(".katex")?.textContent).not.toContain(
      "SKILL.md",
    );
  });

  it("unescapes resource identity without URL encoding or losing label syntax", () => {
    const container = renderMarkdown(
      String.raw`[$missing \[中😀\] **details**](/skills/a\(b\) 中文/SKILL.md)`,
      { promptLinkScope: scope() },
    );
    const mention = container.querySelector<HTMLElement>(
      "[data-prompt-link-href]",
    )!;
    expect(mention?.dataset.promptLinkHref).toBe("/skills/a(b) 中文/SKILL.md");
    expect(mention?.dataset.promptLinkLabel).toBe(
      "$missing [中😀] **details**",
    );
    expect(mention?.textContent).toBe("$missing [中😀] **details**");
  });

  it("gives native Markdown titles priority over paths containing spaces", () => {
    const catalog = scope();
    const container = renderMarkdown(
      '[$review](/skills/review/SKILL.md "Review changes") [$missing](/missing/SKILL.md)',
      { promptLinkScope: catalog, promptLinkItemId: "item-titled" },
    );
    const mentions = container.querySelectorAll<HTMLElement>(
      "[data-prompt-link-href]",
    );
    expect(mentions).toHaveLength(2);
    expect(mentions[0].dataset.promptLinkHref).toBe("/skills/review/SKILL.md");
    expect(mentions[0].textContent).toBe("审阅变更");
    act(() => mentions[0].click());
    expect(catalog.openSkill).toHaveBeenCalledExactlyOnceWith(
      "/skills/review/SKILL.md",
      "item-titled",
    );
  });

  it.each([
    "`[$review](/skills/review/SKILL.md)`",
    "```text\n[$review](/skills/review/SKILL.md)\n```",
    String.raw`\[$review](/skills/review/SKILL.md)`,
    "![$review](/skills/review/SKILL.md)",
  ])(
    "does not bind resource syntax in code, escaped brackets or images: %s",
    (body) => {
      const catalog = scope();
      const container = renderMarkdown(body, { promptLinkScope: catalog });
      expect(container.querySelector("[data-prompt-link-href]")).toBeNull();
      expect(catalog.requestSkills).not.toHaveBeenCalled();
    },
  );
});
