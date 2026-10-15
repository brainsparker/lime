import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EditorState } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { composerSchema } from "@/components/input-kit/composerSchema";
import { CodeBlockNodeViewRegistry } from "./CodeBlockNodeViewRegistry";
import { CodeBlockToolbar, CodeBlockToolbars } from "./CodeBlockToolbar";
import type { CodeBlockNodeViewEntry } from "./CodeBlockNodeViewRegistry";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
beforeAll(() => {
  // JSDOM only: these no-layout shims do not establish geometry/native input.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});
const mounted: { root: Root; host: HTMLElement; cleanup?: () => void }[] = [];
afterEach(async () => {
  for (const { root, host, cleanup } of mounted.splice(0)) {
    await act(async () => {
      root.unmount();
      cleanup?.();
    });
    host.remove();
  }
  expect(document.querySelector("[data-radix-popper-content-wrapper]")).toBe(
    null,
  );
});

const prefix = "composer.codeBlock.";
const messages = {
  "language.none": "Plain text",
  "language.auto": "Auto detect",
  languagePickerLabel: "Choose {{language}}",
  autoLanguagePickerLabel: "Choose Auto",
  autoPlainTextLanguage: "Auto (Plain text)",
  autoPlainTextLanguagePickerLabel: "Choose Auto Plain",
  autoDetectedLanguage: "Auto ({{language}})",
  autoDetectedLanguagePickerLabel: "Choose Auto {{language}}",
  searchLanguages: "Search languages",
  noLanguagesFound: "No languages found",
  "language.math": "Math",
  "language.plaintext": "Plain text",
};
async function i18nFor(locale = "en-US") {
  const i18n = createInstance();
  const translation = Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [
      prefix + key,
      locale === "en-US" ? value : locale + " " + value,
    ]),
  );
  await i18n.init({
    lng: locale,
    fallbackLng: false,
    keySeparator: false,
    resources: { [locale]: { agent: translation } },
    interpolation: { escapeValue: false },
  });
  return i18n;
}
function entry(
  overrides: Partial<CodeBlockNodeViewEntry> = {},
): CodeBlockNodeViewEntry {
  const toolbarPortalContainer = document.createElement("div");
  return {
    id: "entry",
    language: null,
    autoDetectLanguage: true,
    selectLanguage: vi.fn(() => true),
    focusEditor: vi.fn(),
    getContent: () => "code",
    toolbarPortalContainer,
    ...overrides,
  };
}
async function renderToolbar(
  current: CodeBlockNodeViewEntry,
  locale = "en-US",
  disabled = false,
) {
  const i18n = await i18nFor(locale);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const render = async (item = current, nextDisabled = disabled) => {
    await act(async () =>
      root.render(
        <I18nextProvider i18n={i18n}>
          <CodeBlockToolbar entry={item} disabled={nextDisabled} />
        </I18nextProvider>,
      ),
    );
  };
  await render();
  return { host, render };
}
async function click(element: Element | null) {
  if (!element) throw new Error("Missing click target");
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  // Radix schedules close autofocus after the committed unmount.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
async function search(value: string) {
  const input = document.querySelector<HTMLInputElement>("[cmdk-input]");
  if (!input) throw new Error("Missing language search");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("CodeBlockToolbar", () => {
  it.each([
    [null, true, "Auto detect", "Choose Auto"],
    ["plaintext", true, "Auto (Plain text)", "Choose Auto Plain"],
    ["python", true, "Auto (Python)", "Choose Auto Python"],
    ["python", false, "Python", "Choose Python"],
    ["plaintext", false, "Plain text", "Choose Plain text"],
    [null, null, "Plain text", "Choose Plain text"],
    ["custom-lang", false, "custom-lang", "Choose custom-lang"],
  ] as const)(
    "metadata %s/%s determines label/aria without inspecting code",
    async (language, auto, label, aria) => {
      const current = entry({
        language,
        autoDetectLanguage: auto,
        getContent: () => {
          throw new Error("UI must not read body");
        },
      });
      const { host } = await renderToolbar(current);
      const button = host.querySelector("button")!;
      expect(button.textContent).toBe(label);
      expect(button.getAttribute("aria-label")).toBe(aria);
    },
  );

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
    "consumes translated picker/search/empty keys in %s fixtures",
    async (locale) => {
      const { host } = await renderToolbar(
        entry({ language: "math", autoDetectLanguage: false }),
        locale,
      );
      const translated = (value: string) =>
        locale === "en-US" ? value : locale + " " + value;
      expect(host.querySelector("button")?.textContent).toBe(
        translated("Math"),
      );
      expect(host.querySelector("button")?.getAttribute("aria-label")).toBe(
        translated("Choose " + translated("Math")),
      );
      await click(host.querySelector("button"));
      expect(
        document.querySelector("[cmdk-input]")?.getAttribute("aria-label"),
      ).toBe(translated("Search languages"));
      await search("no-language-matches-123");
      expect(document.querySelector("[cmdk-empty]")?.textContent).toBe(
        translated("No languages found"),
      );
    },
  );

  it("search trims/lowercases label/value, selecting canonical language closes and restores editor focus", async () => {
    const current = entry();
    const { host } = await renderToolbar(current);
    await click(host.querySelector("button"));
    await search("  TyPeScRiPt  ");
    expect(
      [...document.querySelectorAll("[data-code-language]")].map((item) =>
        item.getAttribute("data-code-language"),
      ),
    ).toEqual(["typescript"]);
    await click(document.querySelector('[data-code-language="typescript"]'));
    expect(current.selectLanguage).toHaveBeenCalledWith("typescript");
    expect(current.focusEditor).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[cmdk-input]")).toBe(null);
    await click(host.querySelector("button"));
    expect(
      (document.querySelector("[cmdk-input]") as HTMLInputElement).value,
    ).toBe("");
  });

  it("Auto/Plain actions are distinct; schema without auto has no Auto option", async () => {
    const current = entry();
    const { host, render } = await renderToolbar(current);
    await click(host.querySelector("button"));
    await click(document.querySelector('[data-code-language="plaintext"]'));
    expect(current.selectLanguage).toHaveBeenLastCalledWith(null);
    await click(host.querySelector("button"));
    await click(document.querySelector('[data-code-language="auto"]'));
    expect(current.selectLanguage).toHaveBeenLastCalledWith("auto");
    await render(entry({ autoDetectLanguage: null }));
    await click(host.querySelector("button"));
    expect(document.querySelector('[data-code-language="auto"]')).toBe(null);
  });

  it("search/menu keyboard and paste do not bubble into editor submit handlers; Escape restores focus", async () => {
    const current = entry();
    const { host } = await renderToolbar(current);
    const key = vi.fn();
    const paste = vi.fn();
    host.addEventListener("keydown", key);
    host.addEventListener("paste", paste);
    await click(host.querySelector("button"));
    const input = document.querySelector<HTMLInputElement>("[cmdk-input]")!;
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true }),
      );
      input.dispatchEvent(new Event("paste", { bubbles: true }));
    });
    expect(key).not.toHaveBeenCalled();
    expect(paste).not.toHaveBeenCalled();
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector("[cmdk-input]")).toBe(null);
    expect(current.focusEditor).toHaveBeenCalled();
    expect(current.selectLanguage).not.toHaveBeenCalled();
  });

  it("disabled picker cannot open or select, and disabling an open menu discards search state", async () => {
    const current = entry();
    const { host, render } = await renderToolbar(current, "en-US", true);
    await click(host.querySelector("button"));
    expect(document.querySelector("[cmdk-input]")).toBe(null);
    expect(current.selectLanguage).not.toHaveBeenCalled();
    await render(current, false);
    await click(host.querySelector("button"));
    await search("python");
    await render(current, true);
    expect(document.querySelector("[cmdk-input]")).toBe(null);
    await render(current, false);
    expect(document.querySelector("[cmdk-input]")).toBe(null);
    await click(host.querySelector("button"));
    expect(
      (document.querySelector("[cmdk-input]") as HTMLInputElement).value,
    ).toBe("");
  });

  it("two real NodeViews get one Portal each; mutation/delete/destroy unmount menus and subscriptions", async () => {
    const registry = new CodeBlockNodeViewRegistry();
    const host = document.createElement("div");
    document.body.append(host);
    const editorHost = document.createElement("div");
    host.append(editorHost);
    const node = (text: string) =>
      composerSchema.node("code_block", null, composerSchema.text(text));
    const view = new EditorView(editorHost, {
      state: EditorState.create({
        doc: composerSchema.node("doc", null, [node("one"), node("two")]),
      }),
      nodeViews: { code_block: registry.createNodeView },
      dispatchTransaction(tr) {
        view.updateState(view.state.apply(tr));
      },
    });
    const reactHost = document.createElement("div");
    host.append(reactHost);
    const root = createRoot(reactHost);
    const i18n = await i18nFor();
    mounted.push({
      root,
      host,
      cleanup: () => {
        view.destroy();
        registry.destroy();
      },
    });
    await act(async () =>
      root.render(
        <React.StrictMode>
          <I18nextProvider i18n={i18n}>
            <CodeBlockToolbars registry={registry} />
          </I18nextProvider>
        </React.StrictMode>,
      ),
    );
    expect(host.querySelectorAll(".composer-code-toolbar")).toHaveLength(2);
    const old = registry.getSnapshot()[0];
    await click(old.toolbarPortalContainer.querySelector("button"));
    await click(document.querySelector('[data-code-language="python"]'));
    expect(view.state.doc.firstChild?.attrs.language).toBe("python");
    expect(view.state.doc.firstChild?.textContent).toBe("one");
    expect(
      old.toolbarPortalContainer.querySelector("button")?.textContent,
    ).toBe("Python");
    await act(async () =>
      view.dispatch(
        view.state.tr.delete(0, view.state.doc.firstChild!.nodeSize),
      ),
    );
    expect(host.querySelectorAll(".composer-code-toolbar")).toHaveLength(1);
    expect(old.selectLanguage("typescript")).toBe(false);
    await act(async () => view.destroy());
    expect(registry.getSnapshot()).toHaveLength(0);
    expect(host.querySelectorAll(".composer-code-toolbar")).toHaveLength(0);
    await act(async () => registry.destroy());
  });
});
