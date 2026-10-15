import { afterEach, describe, expect, it, vi } from "vitest";
import * as namespaceResources from "@/i18n/loadNamespace";

import {
  resolveAgentChatCopy,
  resolveRequiredAgentChatCopy,
} from "./agentChatCopy";

afterEach(() => {
  document.documentElement.lang = "";
  vi.restoreAllMocks();
});

describe("agentChatCopy", () => {
  it("必需展示文案应从 agent namespace 资源读取", () => {
    document.documentElement.lang = "en-US";

    expect(
      resolveRequiredAgentChatCopy("toolCall.group.command.completed", {
        count: 2,
      }),
    ).toBe("Ran 2 commands");
  });

  it("i18n 未初始化时也应读取当前语言资源", () => {
    document.documentElement.lang = "ko-KR";

    expect(
      resolveRequiredAgentChatCopy("toolCall.group.write.running", {
        count: 1,
      }),
    ).toBe("파일 1개 저장 중");
  });

  it("缺失资源时不应静默回落到中文展示兜底", () => {
    document.documentElement.lang = "en-US";

    expect(resolveRequiredAgentChatCopy("toolCall.group.__missing__")).toBe(
      "agentChat.toolCall.group.__missing__",
    );
  });

  it("热路径切换语言应复用已加载资源，保留文案与插值", () => {
    const key = "toolCall.group.command.completed";
    document.documentElement.lang = "ja-JP";
    const japanese = resolveRequiredAgentChatCopy(key, { count: 2 });
    document.documentElement.lang = "zh-TW";
    const traditional = resolveRequiredAgentChatCopy(key, { count: 2 });
    expect(japanese).not.toBe(traditional);

    const resourceLoad = vi.spyOn(namespaceResources, "loadNamespaceResource");
    for (let index = 0; index < 2; index += 1) {
      for (const [locale, expected] of [
        ["ja-JP", japanese],
        ["zh-TW", traditional],
      ]) {
        document.documentElement.lang = locale;
        expect(resolveRequiredAgentChatCopy(key, { count: 2 })).toBe(expected);
        expect(
          resolveAgentChatCopy("__missing__", "fallback {{count}}", {
            count: 2,
          }),
        ).toBe("fallback 2");
      }
    }
    expect(resourceLoad).not.toHaveBeenCalled();
  });
});
