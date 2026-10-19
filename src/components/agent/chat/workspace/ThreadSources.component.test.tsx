import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { composerCommands } from "@/components/input-kit/ComposerCommands";
import { ThreadSummaryPanel } from "./ThreadSummaryPanel";

let root: Root, container: HTMLDivElement;
const disposers: (() => void)[] = [];
beforeEach(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await changeLimeLocale("en-US");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  disposers.splice(0).forEach((dispose) => dispose());
});
function render(projectless = true, onOpenPluginDirectory = vi.fn()) {
  act(() =>
    root.render(
      <ThreadSummaryPanel
        threadId="source-thread"
        projectless={projectless}
        onOpenPluginDirectory={onOpenPluginDirectory}
      />,
    ),
  );
}
async function openSourceMenu() {
  const row = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Add source",
  );
  expect(row).toBeDefined();
  await act(async () => row!.click());
  return document.querySelector('[role="menu"]')!;
}

describe("Summary Sources", () => {
  it("shows an actionable empty Sources section for projectless threads", async () => {
    render();
    expect(container.textContent).toContain("Sources");
    expect(container.textContent).toContain("Add source");
    const menu = await openSourceMenu();
    expect(menu.textContent).toContain("Plugins");
    expect(menu.textContent).toContain("Attach files or folders");
    const triggers = container.querySelectorAll('[aria-haspopup="menu"]');
    expect(triggers).toHaveLength(2);
    expect(
      [...triggers].every(
        (trigger) => trigger.getAttribute("aria-expanded") === "true",
      ),
    ).toBe(true);
  });
  it("does not leave a contentless border for an empty project Summary", () => {
    render(false);
    expect(
      container.querySelector('[data-testid="thread-summary-panel"]'),
    ).toBeNull();
  });
  it("dispatches files to the active Composer in the same thread", async () => {
    const current = vi.fn(),
      foreign = vi.fn();
    disposers.push(
      composerCommands.register("source-thread", {
        isActive: () => true,
        run: current,
      }),
    );
    disposers.push(
      composerCommands.register("foreign-thread", {
        isActive: () => true,
        run: foreign,
      }),
    );
    render();
    const menu = await openSourceMenu();
    const item = [
      ...menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((node) => node.textContent === "Attach files or folders");
    await act(async () => item!.click());
    expect(current).toHaveBeenCalledOnce();
    expect(foreign).not.toHaveBeenCalled();
  });
  it("disables file selection when there is no connected current Composer", async () => {
    render();
    const menu = await openSourceMenu();
    const item = [
      ...menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((node) => node.textContent === "Attach files or folders");
    expect(item?.getAttribute("aria-disabled")).toBe("true");
  });
  it("opens the existing plugin directory without replacing Sources with installed tools", async () => {
    const open = vi.fn();
    render(true, open);
    const menu = await openSourceMenu();
    const item = [
      ...menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((node) => node.textContent === "Plugins");
    await act(async () => item!.click());
    expect(open).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Installed");
  });
  it.each([
    ["zh-CN", "添加来源", "附加文件或文件夹"],
    ["zh-TW", "加入來源", "附加檔案或資料夾"],
    ["ja-JP", "ソースを追加", "ファイルまたはフォルダーを添付"],
    ["ko-KR", "소스 추가", "파일 또는 폴더 첨부"],
  ])("covers Sources actions in %s", async (locale, add, attach) => {
    await changeLimeLocale(locale);
    render();
    const row = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === add,
    );
    expect(row).toBeDefined();
    await act(async () => row!.click());
    expect(document.querySelector('[role="menu"]')?.textContent).toContain(
      attach,
    );
  });
});
