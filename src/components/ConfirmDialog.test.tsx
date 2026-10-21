import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { ConfirmDialog } from "./ConfirmDialog";

interface MountedDialog {
  container: HTMLDivElement;
  root: Root;
}

const mountedDialogs: MountedDialog[] = [];

function renderConfirmDialog(title?: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ConfirmDialog
        isOpen={true}
        title={title}
        message="This cannot be undone."
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
  });

  mountedDialogs.push({ container, root });
}

beforeEach(async () => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await changeLimeLocale("en-US");
});

afterEach(async () => {
  while (mountedDialogs.length > 0) {
    const mounted = mountedDialogs.pop();
    if (!mounted) {
      break;
    }
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  document.body.replaceChildren();
  await changeLimeLocale("zh-CN");
});

describe("ConfirmDialog", () => {
  it("每个确认框的名称和说明关联自己的可见标题与正文", () => {
    renderConfirmDialog("Replace current goal?");
    renderConfirmDialog("Delete file?");

    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    expect(dialogs).toHaveLength(2);
    for (const [index, dialog] of dialogs.entries()) {
      const titleId = dialog.getAttribute("aria-labelledby");
      const descriptionId = dialog.getAttribute("aria-describedby");
      expect(titleId).toBeTruthy();
      expect(descriptionId).toBeTruthy();
      const title = document.getElementById(titleId!);
      const description = document.getElementById(descriptionId!);
      expect(dialog.contains(title)).toBe(true);
      expect(dialog.contains(description)).toBe(true);
      expect(title?.textContent).toBe(
        index === 0 ? "Replace current goal?" : "Delete file?",
      );
      expect(description?.textContent).toBe("This cannot be undone.");
    }
    expect(dialogs[0].getAttribute("aria-labelledby")).not.toBe(
      dialogs[1].getAttribute("aria-labelledby"),
    );
  });

  it("未传入显式文案时使用 common namespace 默认 chrome", () => {
    renderConfirmDialog();

    expect(document.body.textContent).toContain("Confirm action");
    expect(document.body.textContent).toContain("Cancel");
    expect(document.body.textContent).toContain("Confirm");
    expect(document.body.textContent).toContain("This cannot be undone.");
    expect(document.body.textContent).not.toContain("确认操作");
    expect(document.body.textContent).not.toContain("确定");
  });
});
