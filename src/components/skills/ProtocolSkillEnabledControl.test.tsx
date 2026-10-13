import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalSkillRow } from "./SkillsWorkspaceInstalledSkills";
import type { Skill } from "@/lib/api/skills";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const skill = {
  key: "writer",
  name: "writer",
  description: "write",
  directory: "writer",
  localDirectoryPath: "/skills/writer",
  installed: true,
  sourceKind: "local",
} as Skill;

describe("ProtocolSkillEnabledControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  function renderRow(
    props: Partial<React.ComponentProps<typeof LocalSkillRow>> = {},
  ) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <LocalSkillRow
          installedSkillPresentationCopy={{}}
          onAutoLoadChange={vi.fn()}
          onDetailOpen={vi.fn()}
          preferences={{}}
          skill={skill}
          {...props}
        />,
      );
    });
  }

  it("唯一协议路径匹配时可以切换启用状态", () => {
    const onProtocolSkillEnabledChange = vi.fn();
    renderRow({
      onProtocolSkillEnabledChange,
      protocolSkillEnabledStates: [
        {
          name: "writer",
          path: "/skills/writer/SKILL.md",
          enabled: true,
        },
      ],
    });

    const toggle = container.querySelector(
      '[data-testid="skills-protocol-enabled-switch"]',
    ) as HTMLButtonElement | null;
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    act(() => {
      toggle?.click();
    });
    expect(onProtocolSkillEnabledChange).toHaveBeenCalledWith(skill, false);
  });

  it("没有唯一匹配时不显示启用开关", () => {
    renderRow({
      skill: { ...skill, localDirectoryPath: "/skills" },
      onProtocolSkillEnabledChange: vi.fn(),
      protocolSkillEnabledStates: [
        {
          name: "writer",
          path: "/skills/writer/SKILL.md",
          enabled: true,
        },
        {
          name: "reviewer",
          path: "/skills/reviewer/SKILL.md",
          enabled: false,
        },
      ],
    });

    expect(
      container.querySelector('[data-testid="skills-protocol-enabled-switch"]'),
    ).toBeNull();
  });
});
