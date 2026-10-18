import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTranslation } from "react-i18next";
import { changeLimeLocale } from "@/i18n/createI18n";
import { accountFixture, seedCloudAccount } from "@/test/cloudAccountFixture";
import { readCloudAccount } from "@/lib/cloudAccount";
import type { AppServerPluginDetail } from "@/lib/api/appServerTypes";
import { PluginSkillsSection } from "./PluginSkillsSection";

const mocks = vi.hoisted(() => ({ read: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/api/pluginCatalog", () => ({ readPluginSkill: mocks.read }));
vi.mock("@/lib/api/fileBrowser", () => ({ readFileBytes: mocks.file }));

function detail(path: string | null = null): AppServerPluginDetail {
  return {
    marketplaceName: "workspace-directory",
    marketplacePath: null,
    summary: {
      id: "research@workspace-directory",
      remotePluginId: "opaque~1",
      name: "research",
      version: "1.0.0",
      localVersion: null,
      source: { type: "remote" },
      installed: false,
      enabled: false,
      installPolicy: "AVAILABLE",
      authPolicy: "ON_USE",
    },
    shareUrl: null,
    description: "Research plugin",
    onboardingSkill: null,
    skills: [
      {
        name: "research",
        description: "Research topics",
        shortDescription: null,
        interface: { displayName: "Researcher" },
        path,
        enabled: false,
      },
    ],
    hooks: [],
    apps: [],
    appTemplates: [],
    mcpServers: [],
    scheduledTasks: null,
  };
}

function Harness({ plugin }: { plugin: AppServerPluginDetail }) {
  const { t } = useTranslation("agent");
  return <PluginSkillsSection detail={plugin} t={t} />;
}
let root: Root;
let container: HTMLDivElement;
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

async function mount(plugin = detail()) {
  await act(async () => {
    root.render(<Harness plugin={plugin} />);
  });
  const card = container.querySelector<HTMLButtonElement>(
    "[data-testid=plugin-skill-card]",
  )!;
  expect(card.disabled).toBe(false);
  await act(async () => {
    card.focus();
    card.click();
  });
  return card;
}
function contents() {
  return document.querySelector("[data-testid=plugin-skill-contents]");
}
function button(label: string) {
  return [...document.querySelectorAll("button")].find(
    (element) => element.textContent === label,
  )!;
}

beforeEach(async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.read.mockReset();
  mocks.file.mockReset();
  await changeLimeLocale("zh-CN");
  await seedCloudAccount({
    tenant: { id: "tenant" },
    user: { id: "one" },
    session: { id: "session-one" },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("plugin skill preview", () => {
  it("未安装/未启用仍能读取远端授权正文，只在点击后读取，关闭恢复焦点", async () => {
    let resolve!: (result: { contents: string }) => void;
    mocks.read.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await act(async () => {
      root.render(<Harness plugin={detail()} />);
    });
    expect(mocks.read).not.toHaveBeenCalled();
    const card = container.querySelector<HTMLButtonElement>("button")!;
    await act(async () => {
      card.focus();
      card.click();
    });
    expect(contents()?.textContent).toContain("正在加载技能正文");
    expect(mocks.read).toHaveBeenCalledWith(
      {
        remoteMarketplaceName: "workspace-directory",
        remotePluginId: "opaque~1",
        skillName: "research",
      },
      { signal: expect.any(AbortSignal) },
    );
    await act(async () => {
      resolve({
        contents:
          "---\r\nname: research\r\n---\r\n# Different\r\n\r\n## Usage\r\n**Real body**",
      });
    });
    expect(contents()?.querySelector("h1")).toBeNull();
    expect(contents()?.querySelector("h2")?.textContent).toBe("Usage");
    expect(contents()?.querySelector("strong")?.textContent).toBe("Real body");
    const signal = mocks.read.mock.calls[0][1].signal as AbortSignal;
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label=关闭]")!.click();
    });
    await settle();
    expect(
      document.querySelector("[data-testid=plugin-skill-preview]"),
    ).toBeNull();
    expect(document.activeElement).toBe(card);
    expect(signal.aborted).toBe(true);
  });

  it.each([null, "", "---\nname: research\n---\n# Research\n"])(
    "成功但无指令显示空态：%s",
    async (body) => {
      mocks.read.mockResolvedValue({ contents: body });
      await mount();
      expect(contents()?.textContent).toBe("暂无可用指令");
      expect(document.querySelector("[role=alert]")).toBeNull();
    },
  );

  it("失败不伪造空正文，同技能可重试，优先本地path且本地失败不转远端", async () => {
    mocks.file.mockRejectedValueOnce(new Error("private file error"));
    mocks.file.mockResolvedValueOnce(
      new TextEncoder().encode("# Local\n\nLocal body"),
    );
    await mount(detail("/workspace/skills/research/SKILL.md"));
    expect(document.querySelector("[role=alert]")?.textContent).toContain(
      "无法加载技能正文",
    );
    expect(document.body.textContent).not.toContain("private file error");
    expect(mocks.read).not.toHaveBeenCalled();
    await act(async () => {
      button("重试").click();
    });
    expect(contents()?.textContent).toContain("Local body");
    expect(mocks.file).toHaveBeenCalledTimes(2);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("远端失败可重新读取，切换账号丢弃迟到正文", async () => {
    mocks.read.mockRejectedValueOnce(new Error("HTTP 404"));
    let resolve!: (result: { contents: string }) => void;
    mocks.read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await mount();
    expect(document.querySelector("[role=alert]")).not.toBeNull();
    await act(async () => {
      button("重试").click();
    });
    await act(async () => {
      await seedCloudAccount({
        tenant: { id: "tenant" },
        user: { id: "two" },
        session: { id: "session-two" },
      });
    });
    expect(
      document.querySelector("[data-testid=plugin-skill-preview]"),
    ).toBeNull();
    await act(async () => {
      resolve({ contents: "Stale private body" });
    });
    expect(document.body.textContent).not.toContain("Stale private body");
    mocks.read.mockResolvedValueOnce({ contents: "Fresh account body" });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")!.click();
    });
    expect(contents()?.textContent).toContain("Fresh account body");
    await act(async () => {
      accountFixture.account = null;
      await readCloudAccount();
    });
    expect(
      document.querySelector("[data-testid=plugin-skill-preview]"),
    ).toBeNull();
  });

  it("关闭后打开另一个技能，旧技能迟到正文不覆盖新技能", async () => {
    const plugin = detail();
    plugin.skills.push({
      ...plugin.skills[0],
      name: "another-skill",
      interface: null,
    });
    let resolve!: (result: { contents: string }) => void;
    mocks.read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    mocks.read.mockResolvedValueOnce({ contents: "Second skill contents" });
    await mount(plugin);
    const signal = mocks.read.mock.calls[0][1].signal as AbortSignal;
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label=关闭]")!.click();
    });
    await act(async () => {
      container
        .querySelectorAll<HTMLButtonElement>(
          "[data-testid=plugin-skill-card]",
        )[1]
        .click();
    });
    expect(mocks.read.mock.calls[1][0].skillName).toBe("another-skill");
    expect(contents()?.textContent).toContain("Second skill contents");
    await act(async () => {
      resolve({ contents: "Old skill contents" });
    });
    expect(contents()?.textContent).toContain("Second skill contents");
    expect(contents()?.textContent).not.toContain("Old skill contents");
    expect(signal.aborted).toBe(true);
  });

  it.each([
    ["zh-CN", "无法加载技能正文。", "重试"],
    ["zh-TW", "無法載入技能正文。", "重試"],
    ["en-US", "Unable to load skill contents.", "Retry"],
    ["ja-JP", "スキルの内容を読み込めません。", "再試行"],
    ["ko-KR", "스킬 내용을 불러올 수 없습니다.", "다시 시도"],
  ])("%s显示可操作的失败终态", async (locale, error, retry) => {
    await changeLimeLocale(locale as "zh-CN");
    mocks.read.mockRejectedValue(new Error("HTTP 500"));
    await mount();
    expect(document.querySelector("[role=alert]")?.textContent).toContain(
      error,
    );
    expect(button(retry)).toBeDefined();
  });
});
