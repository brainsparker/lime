import { describe, expect, it } from "vitest";
import type { Skill } from "@/lib/api/skills";
import {
  isAbsoluteSkillDefinition,
  isSkillPromptLink,
  resolveSkillPromptLink,
} from "./skillPromptLink";

const review: Skill = {
  key: "user:review",
  name: "review",
  displayName: "审阅变更",
  description: "Review changes",
  directory: "review",
  localDirectoryPath: "/skills/review",
  installed: true,
  sourceKind: "other",
};

describe("Skill prompt links", () => {
  it.each([
    ["/skills/review/SKILL.md", "$review", true],
    ["C:\\skills\\review\\SKILL.md", "$review", true],
    ["review/SKILL.md", "$review", true],
    ["/skills/review/SKILL.md", "review", false],
    ["https://example.org/SKILL.md", "$review", false],
    ["plugin://review", "$review", false],
    ["app://review", "$review", false],
    ["javascript:alert(1)", "$review", false],
    ["//example.org/SKILL.md", "$review", false],
  ])("classifies %s with label %s", (href, label, expected) => {
    expect(isSkillPromptLink(href, label)).toBe(expected);
  });

  it("binds by exact normalized path, without falling back to the label", () => {
    expect(
      resolveSkillPromptLink("$different", "/SKILLS/review/SKILL.md", [review]),
    ).toMatchObject({ skill: review, displayLabel: "审阅变更" });
    expect(
      resolveSkillPromptLink("$review", "/other/review/SKILL.md", [review]),
    ).toMatchObject({ skill: null, displayLabel: "$review", path: null });
    expect(
      resolveSkillPromptLink("$review", "/skills/review/../review/SKILL.md", [
        review,
      ]),
    ).toMatchObject({ skill: null });
  });

  it("matches Windows extended drive and UNC carriers", () => {
    const drive = { ...review, localDirectoryPath: "C:\\skills\\review" };
    expect(
      resolveSkillPromptLink("$review", "\\\\?\\C:\\skills\\review\\SKILL.md", [
        drive,
      ]).skill,
    ).toBe(drive);
    const unc = { ...review, localDirectoryPath: "\\\\server\\share\\review" };
    expect(
      resolveSkillPromptLink(
        "$review",
        "\\\\?\\UNC\\server\\share\\review\\SKILL.md",
        [unc],
      ).skill,
    ).toBe(unc);
  });

  it("accepts only one installed catalog match", () => {
    expect(
      resolveSkillPromptLink("$review", "/skills/review/SKILL.md", [
        review,
        { ...review, key: "project:review" },
      ]).skill,
    ).toBeNull();
    expect(
      resolveSkillPromptLink("$review", "/skills/review/SKILL.md", [
        { ...review, installed: false },
      ]).skill,
    ).toBeNull();
  });

  it("uses name or display name only when href is absent", () => {
    expect(resolveSkillPromptLink("$审阅变更", null, [review]).skill).toBe(
      review,
    );
    expect(
      resolveSkillPromptLink("$review", null, [
        review,
        { ...review, key: "second" },
      ]).skill,
    ).toBeNull();
  });

  it("keeps explicit prompt metadata separate from catalog identity", () => {
    expect(
      resolveSkillPromptLink(
        "$review?label=%E5%AE%A1%E9%98%85&icon=unknown",
        "/skills/review/SKILL.md",
        [review],
      ),
    ).toMatchObject({ skill: review, displayLabel: "审阅" });
    expect(
      resolveSkillPromptLink("$review?other=value", null, [review]),
    ).toMatchObject({ skill: null, displayLabel: "$review?other=value" });
  });

  it.each([
    ["/skills/review/SKILL.md", true],
    ["C:\\skills\\review\\SKILL.md", true],
    ["\\\\server\\share\\review\\SKILL.md", true],
    ["review/SKILL.md", false],
    ["https://example.org/SKILL.md", false],
    ["/skills/review/README.md", false],
  ])("checks the local definition target %s", (path, expected) => {
    expect(isAbsoluteSkillDefinition(path)).toBe(expected);
  });
});
