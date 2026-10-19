/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StyleSheetManager } from "styled-components";
import { createTestStyleSheet } from "@/test/createTestStyleSheet";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { EmptyStateComposerPanel } from "./EmptyStateComposerPanel";
import { acceptedSubmission } from "../hooks/agentSendResult.testFixtures";
import {
  buildSkillSelectionProps,
  type SkillSelectionProps,
} from "../skill-selection/skillSelectionBindings";
import { agentEnUSResource, agentZhCNResource } from "@/i18n/agentResources";
import {
  buildHomeSurfaceCopy,
  type HomeSurfaceCopyKey,
} from "../home/homeSurfaceCopy";
import {
  buildInputbarCoreCopy,
  type InputbarCoreCopyKey,
} from "./Inputbar/components/inputbarCoreCopy";
import type { InputbarWorkflowCopyKey } from "./Inputbar/inputbarWorkflowCopy";
import { changeLimeLocale } from "@/i18n/createI18n";
import { setComposerEditorText } from "@/components/input-kit/composerEditor.testUtils";
import { stubSuggestionGeometry } from "./Inputbar/components/contextualSuggestions.testFixtures";

vi.mock("./ChatModelSelector", () => ({
  ChatModelSelector: () => <div data-testid="empty-state-model-selector" />,
}));

function translateResource(
  resource: Partial<
    Record<
      HomeSurfaceCopyKey | InputbarCoreCopyKey | InputbarWorkflowCopyKey,
      string
    >
  >,
  key: HomeSurfaceCopyKey | InputbarCoreCopyKey | InputbarWorkflowCopyKey,
  values?: Record<string, number | string>,
) {
  return Object.entries(values ?? {}).reduce(
    (text, [name, value]) => text.split(`{{${name}}}`).join(String(value)),
    resource[key] ?? key,
  );
}

export const TEST_COMPOSER_COPY = buildHomeSurfaceCopy((key, values) =>
  translateResource(agentZhCNResource, key, values),
).composer;

export const TEST_EN_COMPOSER_COPY = buildHomeSurfaceCopy((key, values) =>
  translateResource(agentEnUSResource, key, values),
).composer;

export const TEST_INPUTBAR_CORE_COPY = buildInputbarCoreCopy((key, values) =>
  translateResource(agentZhCNResource, key, values),
);

export const TEST_EN_INPUTBAR_CORE_COPY = buildInputbarCoreCopy((key, values) =>
  translateResource(agentEnUSResource, key, values),
);

const mountedRoots: Array<{
  root: Root;
  container: HTMLDivElement;
  styleTarget: HTMLDivElement;
}> = [];

beforeEach(async () => {
  stubSuggestionGeometry();
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await changeLimeLocale("zh-CN");
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
    mounted.styleTarget.remove();
  }
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

export function createSkillSelection(
  overrides: Partial<SkillSelectionProps> = {},
): SkillSelectionProps {
  return buildSkillSelectionProps({
    skills: [],
    ...overrides,
  });
}

export function renderPanel(
  props?: Partial<React.ComponentProps<typeof EmptyStateComposerPanel>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  // 隔离其它页面的 container query，避免旧 jsdom 解析失败污染本夹具样式。
  const styleTarget = document.createElement("div");
  document.head.appendChild(styleTarget);
  const sheet = createTestStyleSheet(styleTarget);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof EmptyStateComposerPanel> = {
    input: "",
    setInput: vi.fn(),
    placeholder: "输入内容",
    onSend: vi.fn(async () => acceptedSubmission()),
    activeTheme: "general",
    providerType: "openai",
    setProviderType: vi.fn(),
    model: "gpt-4.1",
    setModel: vi.fn(),
    onManageProviders: vi.fn(),
    skillSelection: createSkillSelection(),
    copy: TEST_COMPOSER_COPY,
    inputbarCopy: TEST_INPUTBAR_CORE_COPY,
    subagentEnabled: false,
    onSubagentEnabledChange: vi.fn(),
    pendingImages: [],
    onAddFiles: vi.fn().mockResolvedValue(false),
    onPaste: vi.fn(),
    onRemoveImage: vi.fn(),
  };

  const panelProps = { ...defaultProps, ...props };
  const ControlledPanel = () => {
    const [value, setValue] = React.useState(panelProps.input);
    return (
      <EmptyStateComposerPanel
        {...panelProps}
        input={value}
        setInput={setValue}
      />
    );
  };

  act(() => {
    root.render(
      <StyleSheetManager sheet={sheet}>
        <ControlledPanel />
      </StyleSheetManager>,
    );
  });

  mountedRoots.push({ root, container, styleTarget });
  return container;
}

export function openContextSuggestions(container: HTMLDivElement) {
  const toggleButton = container.querySelector(
    '[data-testid="inputbar-plus-trigger"]',
  ) as HTMLButtonElement | null;

  expect(toggleButton).toBeTruthy();

  act(() => {
    toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  return toggleButton;
}

export function updateComposerEditorValue(
  editor: HTMLElement | null,
  value: string,
) {
  expect(editor).toBeTruthy();

  act(() => {
    setComposerEditorText(editor, value);
  });
}
