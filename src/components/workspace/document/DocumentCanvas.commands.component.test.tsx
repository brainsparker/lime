import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRegisteredCommands } from "@/lib/commands/registry";
import { DocumentCanvas } from "./DocumentCanvas";
import type { DocumentCanvasState } from "./types";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./DocumentToolbar", () => ({ DocumentToolbar: () => null }));
vi.mock("./ContentReviewPanel", () => ({ ContentReviewPanel: () => null }));
vi.mock("./DocumentRenderer", () => ({ DocumentRenderer: () => null }));
vi.mock("./editor/NotionEditor", async () => {
  const { forwardRef } = await import("react");
  return {
    NotionEditor: forwardRef(function EditorFixture(
      {
        content,
        onCommit,
      }: { content: string; onCommit: (content: string) => void },
      _ref,
    ) {
      return (
        <button data-testid="editor-commit" onClick={() => onCommit("After")}>
          {content}
        </button>
      );
    }),
  };
});

let root: Root;
beforeEach(() => {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

function CanvasHarness() {
  const [state, setState] = useState<DocumentCanvasState>({
    type: "document",
    content: "Before",
    platform: "markdown",
    versions: [],
    currentVersionId: "v1",
    isEditing: true,
  });
  return (
    <DocumentCanvas state={state} onStateChange={setState} onClose={() => {}} />
  );
}

describe("DocumentCanvas actual history command registration", () => {
  it("真实历史状态驱动 undo/redo 注册、执行、输入边界与卸载", () => {
    act(() => root.render(<CanvasHarness />));
    expect(getRegisteredCommands()).toEqual([]);
    act(() =>
      document
        .querySelector<HTMLButtonElement>('[data-testid="editor-commit"]')!
        .click(),
    );
    expect(getRegisteredCommands().map((command) => command.id)).toEqual([
      "undoDocument",
    ]);
    const content = () =>
      document.querySelector('[data-testid="editor-commit"]')!.textContent;
    const key = (shiftKey: boolean, target: EventTarget = window) =>
      act(() =>
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "z",
            ctrlKey: true,
            shiftKey,
            cancelable: true,
            bubbles: true,
          }),
        ),
      );
    key(false);
    expect(content()).toBe("Before");
    expect(getRegisteredCommands().map((command) => command.id)).toEqual([
      "redoDocument",
    ]);
    key(true);
    expect(content()).toBe("After");
    expect(getRegisteredCommands().map((command) => command.id)).toEqual([
      "undoDocument",
    ]);
    const input = document.createElement("input");
    document.body.append(input);
    key(false, input);
    expect(content()).toBe("After");
    act(() => root.render(null));
    expect(getRegisteredCommands()).toEqual([]);
  });
});
