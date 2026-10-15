import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { ComposerEditor } from "@/components/input-kit/ComposerEditor";
import { changeLimeLocale } from "@/i18n/createI18n";

const mounted: { root: Root; container: HTMLElement }[] = [];

afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  await changeLimeLocale("en-US");
});

describe("CodeBlockToolbar actual locale resources", () => {
  it.each([
    ["zh-CN", "纯文本", "代码语言：纯文本", "自动检测", "自动检测代码语言"],
    ["zh-TW", "純文字", "程式碼語言：純文字", "自動偵測", "自動偵測程式碼語言"],
    [
      "en-US",
      "Plain text",
      "Code language: Plain text",
      "Auto detect",
      "Auto detect code language",
    ],
    [
      "ja-JP",
      "プレーンテキスト",
      "コードの言語: プレーンテキスト",
      "自動検出",
      "コードの言語を自動検出",
    ],
    [
      "ko-KR",
      "일반 텍스트",
      "코드 언어: 일반 텍스트",
      "자동 감지",
      "코드 언어 자동 감지",
    ],
  ] as const)(
    "%s 的实际主编辑器消费翻译并区分 Plain 与 Auto",
    async (locale, plain, plainLabel, auto, autoLabel) => {
      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
      await changeLimeLocale(locale);
      const controller = new ComposerController({
        editorDocument: {
          type: "doc",
          content: [
            {
              type: "code_block",
              attrs: { language: "plaintext", autoDetectLanguage: false },
              content: [{ type: "text", text: "body 😀" }],
            },
          ],
        },
      });
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      mounted.push({ root, container });
      act(() => root.render(<ComposerEditor controller={controller} />));
      const button = () =>
        container.querySelector<HTMLButtonElement>(
          '[data-composer-code-block-toolbar="true"] button',
        );
      expect(button()?.getAttribute("aria-label")).toBe(plainLabel);
      expect(button()?.textContent).toBe(plain);
      act(() =>
        controller.codeBlockNodeViewRegistry
          .getSnapshot()[0]
          .selectLanguage("auto"),
      );
      expect(button()?.getAttribute("aria-label")).toBe(autoLabel);
      expect(button()?.textContent).toBe(auto);
      expect(container.querySelector("code")?.textContent).toBe("body 😀");
    },
  );
});
