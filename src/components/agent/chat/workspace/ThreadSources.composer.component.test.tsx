import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { getLimeI18n, changeLimeLocale } from "@/i18n/createI18n";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { InputbarCore } from "../components/Inputbar/components/InputbarCore";
import { buildInputbarCoreCopy } from "../components/Inputbar/components/inputbarCoreCopy";
import { createContextualSuggestionsFixture } from "../components/Inputbar/components/contextualSuggestions.testFixtures";
import { useComposerAttachments } from "../components/useComposerAttachments";
import { ThreadSummaryPanel } from "./ThreadSummaryPanel";

const native = vi.hoisted(() => ({ pick: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/api/filePicker", () => ({ pickFilesFromDialog: native.pick }));
vi.mock("@/lib/api/fileBrowser", () => ({ readFileBytes: native.read }));

function Composer({ owner }: { owner: ComposerController }) {
  const attachments = useComposerAttachments({ controller: owner });
  return (
    <InputbarCore
      uiCopy={buildInputbarCoreCopy((key, values) =>
        String(getLimeI18n().t(key, { ...values, ns: "agent" })),
      )}
      controller={owner}
      sessionId="source-thread"
      text={owner.getDocument().text}
      setText={(text) => owner.setText(text)}
      onSend={vi.fn()}
      onToolClick={vi.fn()}
      contextualSuggestions={createContextualSuggestionsFixture({
        onAddFiles: () => {
          void attachments.openFileDialog();
        },
      })}
      pendingImages={attachments.pendingImages}
    />
  );
}

describe("Sources and current Composer integration (explicit native boundary fixture)", () => {
  it.each([true, false])(
    "preserves rich content and Composer focus (selection accepted: %s)",
    async (accepted) => {
      (
        globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;
      vi.clearAllMocks();
      await changeLimeLocale("en-US");
      native.pick.mockResolvedValue(
        accepted
          ? [
              {
                fsPath: "/work/photo.png",
                path: "/work/photo.png",
                label: "photo.png",
              },
              {
                fsPath: "/work/brief.md",
                path: "/work/brief.md",
                label: "brief.md",
              },
            ]
          : [],
      );
      native.read.mockResolvedValue(new Uint8Array([1, 2, 3]));
      const owner = new ComposerController({
        text: "Draft from the active thread",
      });
      owner.insertMention(
        {
          id: "review",
          kind: "skill",
          name: "review",
          path: "/skills/review/SKILL.md",
          label: "/review",
        },
        { start: 0, end: 0 },
      );
      const before = owner.captureDraft();
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      let dispose = () => {};
      const restoreRectangles: (() => void)[] = [];
      try {
        act(() =>
          root.render(
            <>
              <Composer owner={owner} />
              <ThreadSummaryPanel threadId="source-thread" projectless />
            </>,
          ),
        );
        for (const editor of container.querySelectorAll(
          '[data-testid="composer-editor"]',
        )) {
          const spy = vi
            .spyOn(editor, "getClientRects")
            .mockReturnValue([{}] as never);
          restoreRectangles.push(() => spy.mockRestore());
        }
        const row = [...container.querySelectorAll("button")].find(
          (button) => button.textContent === "Add source",
        )!;
        await act(async () => row.click());
        const item = [
          ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        ].find((node) => node.textContent === "Attach files or folders")!;
        expect(item.getAttribute("aria-disabled")).not.toBe("true");
        const attached = accepted
          ? new Promise<void>((resolve) => {
              dispose = owner.subscribe(() => {
                if (
                  owner.getDocument().attachments.length &&
                  owner.getDocument().pathReferences.length
                )
                  resolve();
              });
            })
          : Promise.resolve();
        await act(async () => {
          item.click();
        });
        await act(async () => attached);
        expect(native.pick).toHaveBeenCalledOnce();
        if (accepted)
          expect(native.read).toHaveBeenCalledExactlyOnceWith(
            "/work/photo.png",
          );
        else expect(native.read).not.toHaveBeenCalled();
        expect(owner.getDocument().attachments).toEqual(
          accepted ? [{ data: "AQID", mediaType: "image/png" }] : [],
        );
        expect(
          owner.getDocument().pathReferences.map((path) => path.path),
        ).toEqual(accepted ? ["/work/brief.md"] : []);
        expect(owner.getDocument().editorDocument).toEqual(
          before.editorDocument,
        );
        expect(container.querySelector('input[type="file"]')).toBeNull();
        await vi.waitFor(() => {
          expect(document.activeElement).toBe(
            container.querySelector('[data-testid="composer-editor"]'),
          );
        });
      } finally {
        dispose();
        act(() => root.unmount());
        container.remove();
        restoreRectangles.forEach((restore) => restore());
      }
    },
  );
});
