import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { ComposerDraftStatus as DraftStatus } from "@/components/input-kit/ComposerDraftCoordinator";
import { ComposerDraftStatus } from "./ComposerDraftStatus";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: Array<{ root: Root; element: HTMLDivElement }> = [];
afterEach(async () => {
  act(() => {
    for (const { root, element } of mounted.splice(0)) {
      root.unmount();
      element.remove();
    }
  });
  await changeLimeLocale("en-US");
});
const status: DraftStatus = {
  scope: { workspaceId: "w", kind: "draft", id: "d" },
  generation: 1,
  ready: true,
  identity: { draftId: "d", scopeVersion: "v" },
  remoteIdentity: null,
  mutation: "applied",
  storeRevision: 7,
  persistence: { state: "saved", savedRevision: 7 },
  error: null,
};

function mount() {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  mounted.push({ root, element });
  return {
    element,
    render: (value: DraftStatus | null, restoring = false) =>
      act(() =>
        root.render(
          <ComposerDraftStatus status={value} restoring={restoring} />,
        ),
      ),
  };
}

describe("draft save feedback", () => {
  it.each([
    ["zh-CN", "草稿已保存", "正在恢复草稿…"],
    ["zh-TW", "草稿已儲存", "正在還原草稿…"],
    ["en-US", "Draft saved", "Restoring draft…"],
    ["ja-JP", "下書きを保存しました", "下書きを復元中…"],
    ["ko-KR", "초안 저장됨", "초안 복원 중…"],
  ] as const)(
    "%s uses actual locale resources for saved/restoring states",
    async (locale, saved, restoring) => {
      await changeLimeLocale(locale);
      const view = mount();
      view.render(status);
      expect(view.element.querySelector('[role="status"]')?.textContent).toBe(
        saved,
      );
      view.render(null, true);
      expect(view.element.querySelector('[role="status"]')?.textContent).toBe(
        restoring,
      );
    },
  );
  it("memory application and an old saved revision cannot claim durable saving", () => {
    const view = mount();
    view.render({
      ...status,
      persistence: { state: "pending", savedRevision: 6 },
    });
    expect(view.element.querySelector('[data-state="saving"]')).not.toBeNull();
    view.render({
      ...status,
      persistence: { state: "saved", savedRevision: 6 },
    });
    expect(view.element.querySelector('[data-state="saved"]')).toBeNull();
    view.render({ ...status, mutation: "conflict" });
    expect(
      view.element.querySelector('[data-state="conflict"]'),
    ).not.toBeNull();
    view.render({ ...status, mutation: "invalid", error: "mode_mismatch" });
    expect(view.element.querySelector('[data-state="error"]')).not.toBeNull();
  });
});
