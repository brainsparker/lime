import React, { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import {
  ComposerEditor,
  type ComposerEditorHandle,
} from "@/components/input-kit/ComposerEditor";
import { changeLimeLocale } from "@/i18n/createI18n";
import {
  ContextualSuggestions,
  type ContextualSuggestionsConfig,
} from "./ContextualSuggestions";
import {
  createContextualSuggestionsFixture,
  stubSuggestionGeometry,
} from "./contextualSuggestions.testFixtures";

const api = vi.hoisted(() => ({ search: vi.fn(), project: vi.fn() }));
vi.mock("@/lib/api/fuzzyFileSearch", () => ({
  searchProjectFiles: api.search,
}));
vi.mock("@/lib/api/project", () => ({ getProject: api.project }));
const cleanup: (() => void)[] = [];
const rangeDescriptors = new Map(
  ["getClientRects", "getBoundingClientRect"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
  ),
);

beforeEach(async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  stubSuggestionGeometry();
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(),
  });
  await changeLimeLocale("en-US");
});
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.useRealTimers();
  for (const [name, descriptor] of rangeDescriptors) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
    else Reflect.deleteProperty(Range.prototype, name);
  }
});

function mount(overrides: Partial<ContextualSuggestionsConfig> = {}) {
  const controller = new ComposerController();
  const editorRef = createRef<ComposerEditorHandle>();
  const anchorRef = createRef<HTMLDivElement>();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const config = createContextualSuggestionsFixture(overrides);
  const render = (disabled = false) =>
    act(() =>
      root.render(
        <div ref={anchorRef}>
          <ComposerEditor controller={controller} editorRef={editorRef} />
          <ContextualSuggestions
            {...{ controller, editorRef, anchorRef, config, disabled }}
          />
        </div>,
      ),
    );
  render();
  cleanup.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  const editor = editorRef.current!.getElement()!;
  const type = (text: string) =>
    act(() => {
      editorRef.current!.focus();
      controller.applyTransaction(
        controller.getEditorState().tr.insertText(text),
      );
    });
  const click = async (key: string) => {
    const item = document.querySelector<HTMLButtonElement>(
      '[data-suggestion-key="' + key + '"]',
    );
    expect(item).toBeTruthy();
    await act(async () => item!.click());
  };
  const key = (
    value: string,
    extra: ConstructorParameters<typeof KeyboardEvent>[1] = {},
  ) => {
    const event = new KeyboardEvent("keydown", {
      key: value,
      bubbles: true,
      cancelable: true,
      ...extra,
    });
    act(() => editor.dispatchEvent(event));
    return event;
  };
  return { controller, editor, config, type, click, key, render };
}

const reviewSkill = {
  key: "review",
  name: "Review",
  description: "Review code",
  directory: "/skills/review",
  installed: true,
  sourceKind: "other" as const,
};

describe("ContextualSuggestions with the real ProseMirror editor", () => {
  it("+ 与 @ 共用同一个列表；metadata 不污染草稿，Escape 不删除 typed query", () => {
    const view = mount();
    view.type("keep ");
    const before = view.controller.captureDraft();
    act(() => view.controller.toggleContextSuggestions());
    const listId = document.querySelector('[role="listbox"]')!.id;
    expect(view.controller.captureDraft()).toEqual(before);
    expect(view.editor.getAttribute("aria-controls")).toBe(listId);
    view.type("@missing");
    expect(view.controller.getSuggestion().activation).toBe("typed");
    expect(document.querySelectorAll('[role="listbox"]')).toHaveLength(1);
    expect(document.querySelector('[role="listbox"]')!.id).toBe(listId);
    expect(view.key("Escape").defaultPrevented).toBe(true);
    expect(view.controller.getDocument().text).toBe("keep @missing");
    expect(document.activeElement).toBe(view.editor);
    expect(view.editor.hasAttribute("aria-controls")).toBe(false);
  });

  it("键盘选择只替换当前 token，保留两边文字、caret 和 editor identity", async () => {
    const onPlan = vi.fn();
    const view = mount({
      commands: [{ id: "plan-mode", label: "Plan", onSelect: onPlan }],
    });
    view.type("before @plan after");
    act(() => view.controller.setSelection(12));
    expect(view.controller.getSuggestion().query).toBe("plan");
    expect(view.key("Enter").defaultPrevented).toBe(true);
    await act(async () => Promise.resolve());
    expect(onPlan).toHaveBeenCalledOnce();
    expect(view.controller.getDocument().text).toBe("before  after");
    expect(view.controller.getDocument().selectionStart).toBe(7);
    expect(document.activeElement).toBe(view.editor);
    expect(document.querySelector('[data-testid="composer-editor"]')).toBe(
      view.editor,
    );
  });

  it("skill atom 使用安装路径与 canonical mention，空 @ 不展示技能", async () => {
    const onSelectInputCapability = vi.fn();
    const skill = { ...reviewSkill, displayName: "变更审阅" };
    const view = mount({
      skills: [skill, { ...reviewSkill, key: "uninstalled", installed: false }],
      onSelectInputCapability,
    });
    view.type("@");
    expect(
      document.querySelector('[data-suggestion-key="skill:review"]'),
    ).toBeNull();
    view.type("review");
    expect(
      document.querySelector('[data-suggestion-key="skill:uninstalled"]'),
    ).toBeNull();
    await view.click("skill:review");
    expect(view.controller.getDocument().mentionBindings).toEqual([
      expect.objectContaining({
        kind: "skill",
        id: "review",
        path: "/skills/review/SKILL.md",
      }),
    ]);
    const receipt = view.controller.submit("start");
    expect(receipt.kind).toBe("accepted");
    expect(receipt.submission).toMatchObject({
      text: "[$Review](/skills/review/SKILL.md)",
      inputMentions: [
        { type: "skill", name: "Review", path: "/skills/review/SKILL.md" },
      ],
    });
    expect(
      view.editor.querySelector('[data-composer-token="skill"]')?.textContent,
    ).toBe("变更审阅");
    expect(onSelectInputCapability).toHaveBeenCalledWith({
      kind: "installed_skill",
      skill,
    });
    expect(document.activeElement).toBe(view.editor);
  });

  it("$ 技能建议与 / 命令不混入附件和插件", () => {
    const view = mount({
      skills: [reviewSkill],
      plugins: [{ pluginId: "p", displayName: "Review" }],
      commands: [{ id: "plan-mode", label: "Plan", onSelect: vi.fn() }],
    });
    view.type("$");
    expect(
      [...document.querySelectorAll('[role="option"]')].map((node) =>
        node.getAttribute("data-suggestion-key"),
      ),
    ).toEqual(["skill:review"]);
    act(() => view.controller.clearSuggestion());
    view.type("/");
    expect(
      [...document.querySelectorAll('[role="option"]')].map((node) =>
        node.getAttribute("data-suggestion-key"),
      ),
    ).toEqual(["command:plan-mode"]);
  });

  it("disabled plugin 不可选；选择 current plugin 写入 atom 而且保留正文", async () => {
    const plugin = { pluginId: "review", displayName: "Review" };
    const view = mount({
      plugins: [
        {
          pluginId: "blocked",
          displayName: "Blocked",
          blockerCodes: ["login"],
        },
        plugin,
      ],
    });
    view.type("draft @");
    expect(
      document.querySelector<HTMLButtonElement>(
        '[data-suggestion-key="plugin:blocked"]',
      )!.disabled,
    ).toBe(true);
    await view.click("plugin:review");
    expect(view.controller.getDocument().text).toBe("draft @Review");
    expect(view.controller.getDocument().mentionBindings[0]).toMatchObject({
      kind: "plugin",
      path: "plugin://review",
    });
    expect(view.controller.getDocument().mentionBindings).toHaveLength(1);
    expect(view.controller.getDocument().inputCapabilityRoute).toBeUndefined();
  });

  it("IME 与组合键不选择项目；正常 Tab 选择，mouseDown 保留编辑焦点", async () => {
    const view = mount({ skills: [reviewSkill] });
    view.type("$review");
    for (const extra of [
      { isComposing: true },
      { keyCode: 229 },
      { ctrlKey: true },
    ]) {
      view.key("Enter", extra);
      expect(view.controller.getDocument().mentionBindings).toHaveLength(0);
    }
    const item = document.querySelector('[role="option"]')!;
    const mouseDown = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    act(() => item.dispatchEvent(mouseDown));
    expect(mouseDown.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(view.editor);
    expect(view.key("Tab").defaultPrevented).toBe(true);
    await act(async () => Promise.resolve());
    expect(view.controller.getDocument().mentionBindings).toHaveLength(1);
  });

  it("失焦或禁用关闭建议；窗口暂时失焦保留，草稿替换不带回旧列表", () => {
    const view = mount();
    view.type("@query");
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    act(() => view.editor.dispatchEvent(new FocusEvent("blur")));
    expect(view.controller.getSuggestion().active).toBe(true);
    const button = document.createElement("button");
    act(() =>
      view.editor.dispatchEvent(
        new FocusEvent("blur", { relatedTarget: button }),
      ),
    );
    expect(view.controller.getSuggestion().active).toBe(false);
    expect(view.controller.getDocument().text).toBe("@query");
    act(() => view.controller.toggleContextSuggestions());
    view.render(true);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    act(() => view.controller.restoreDraft({ text: "new thread" }));
    view.render(false);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
    "%s 空态与 loading/error 使用当前语言",
    async (locale) => {
      await changeLimeLocale(locale);
      const view = mount();
      view.type("@no-match");
      const text = document.querySelector('[role="status"]')!.textContent;
      expect(text).toBeTruthy();
      expect(text).not.toContain("agentChat.");
      view.config.pluginsLoading = true;
      view.render();
      expect(document.querySelector('[role="status"]')!.textContent).not.toBe(
        text,
      );
      view.config.pluginsLoading = false;
      view.config.pluginsError = "private backend detail";
      view.render();
      expect(document.querySelector('[role="status"]')!.textContent).not.toBe(
        text,
      );
      expect(document.body.textContent).not.toContain("private backend detail");
    },
  );
});
