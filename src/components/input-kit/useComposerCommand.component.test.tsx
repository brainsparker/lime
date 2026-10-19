import { act, useMemo, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerController } from "./ComposerController";
import { ComposerEditor, type ComposerEditorHandle } from "./ComposerEditor";
import { composerCommands } from "./ComposerCommands";
import { useComposerCommand } from "./useComposerCommand";

function Composer({
  scope,
  addFiles,
  disabled = false,
}: {
  scope: string;
  addFiles: () => void;
  disabled?: boolean;
}) {
  const owner = useMemo(() => new ComposerController(), []);
  const editor = useRef<ComposerEditorHandle>(null);
  useComposerCommand({ scope, editor, disabled, addFiles });
  return (
    <ComposerEditor editorRef={editor} controller={owner} disabled={disabled} />
  );
}

let root: Root, container: HTMLDivElement;
let sequence = 0;
const frames = new Map<number, (timestamp: number) => void>();
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  frames.clear();
  vi.restoreAllMocks();
});
function render(scope: string, addFiles: () => void, disabled = false) {
  act(() =>
    root.render(
      <Composer scope={scope} addFiles={addFiles} disabled={disabled} />,
    ),
  );
  const editor = container.querySelector<HTMLElement>(
    '[data-testid="composer-editor"]',
  )!;
  vi.spyOn(editor, "getClientRects").mockReturnValue([{}] as never);
  return editor;
}
function flushFrames() {
  const queued = [...frames.values()];
  frames.clear();
  act(() => queued.forEach((callback) => callback(0)));
}

describe("scoped Composer command focus", () => {
  it("keeps pending focus across callback updates and dispatches the latest action", async () => {
    const first = vi.fn(),
      next = vi.fn();
    const editor = render("a", first);
    await act(async () => {
      expect(await composerCommands.run("composer.addFiles", "a")).toBe(true);
    });
    render("a", next);
    flushFrames();
    expect(document.activeElement).toBe(editor);
    await act(async () => {
      await composerCommands.run("composer.addFiles", "a");
    });
    expect(first).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(["scope", "disabled", "unmount"])(
    "discards delayed focus after %s changes",
    async (change) => {
      const action = vi.fn();
      const editor = render("a", action);
      await act(async () => {
        expect(await composerCommands.run("composer.addFiles", "a")).toBe(true);
      });
      if (change === "unmount") act(() => root.render(null));
      else
        render(change === "scope" ? "b" : "a", action, change === "disabled");
      flushFrames();
      expect(document.activeElement).not.toBe(editor);
      expect(composerCommands.canRun("a")).toBe(false);
    },
  );
});
