import React, { act, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { ComposerController } from "@/components/input-kit/ComposerController";
import { useAgentChatWorkspaceLocalDisplayState } from "./useAgentChatWorkspaceLocalDisplayState";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];
afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function mountScope() {
  let current!: ReturnType<typeof useAgentChatWorkspaceLocalDisplayState>;
  let changeSurface!: (value: boolean) => void;
  let observed!: ComposerController;
  function Surface({ controller }: { controller: ComposerController }) {
    observed = controller;
    const snapshot = useSyncExternalStore(
      controller.subscribe,
      controller.getSnapshot,
    );
    return <span>{snapshot.document.text}</span>;
  }
  function Workspace() {
    current = useAgentChatWorkspaceLocalDisplayState({
      defaultTopicSidebarVisible: false,
      normalizedEntryTheme: "general",
      shouldBootstrapCanvasOnEntry: false,
    });
    const [conversation, setConversation] = useState(false);
    changeSurface = setConversation;
    return conversation ? (
      <section>
        <Surface controller={current.composerController} />
      </section>
    ) : (
      <main>
        <Surface controller={current.composerController} />
      </main>
    );
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => root.render(<Workspace />));
  return {
    current: () => current,
    observed: () => observed,
    changeSurface: () => act(() => changeSurface(true)),
    container,
  };
}

describe("workspace composer scope", () => {
  it("空草稿连续切scope每次推进revision并重建读取生命周期", () => {
    const runtime = mountScope();
    const owner = runtime.current().composerController;
    for (let index = 0; index < 3; index += 1) {
      const revision = owner.getSnapshot().revision;
      const plugins = owner.getEditorState().plugins;
      act(() => runtime.current().resetComposerDraft());
      expect(owner.getSnapshot().revision).toBeGreaterThan(revision);
      expect(owner.getEditorState().plugins).not.toBe(plugins);
    }
  });
  it.each(["accepted", "rejected", "failed"] as const)(
    "surface handoff preserves rich draft until deferred result %s",
    async (outcome) => {
      const runtime = mountScope();
      const owner = runtime.current().composerController;
      act(() => {
        owner.setText("A😀 ");
        owner.ingestPaste("完整粘贴".repeat(300));
        owner.setAttachments([
          {
            data: "image-data",
            mediaType: "image/png",
            sourcePath: "/tmp/image.png",
            index: 7,
          },
        ]);
        owner.setPathReferences([
          {
            id: "reference",
            path: "/tmp/reference.ts",
            name: "reference.ts",
            isDir: false,
          },
        ]);
        owner.setInputCapabilityRoute({
          kind: "builtin_command",
          commandKey: "skill-1",
        });
      });
      let receipt!: ReturnType<ComposerController["submit"]>;
      act(() => {
        receipt = owner.submit("start");
      });
      let finish!: (result: boolean) => void;
      let reject!: () => void;
      const result = new Promise<boolean>((resolve, rejectResult) => {
        finish = resolve;
        reject = () => rejectResult(new Error("backend rejected"));
      });
      const completion = result.then(
        (value) => value && owner.commit(receipt),
        () => false,
      );
      runtime.changeSurface();
      expect(runtime.observed()).toBe(owner);
      expect(owner.captureDraft()).toEqual(receipt.draft);
      expect(runtime.current().input).toBe(receipt.draft.text);
      await act(async () => {
        if (outcome === "failed") reject();
        else finish(outcome === "accepted");
        await completion;
      });
      expect(owner.captureDraft()).toEqual(
        outcome === "accepted"
          ? expect.objectContaining({
              text: "",
              attachments: [],
              pathReferences: [],
            })
          : receipt.draft,
      );
    },
  );

  it("deferred acceptance cannot clear a newer surface revision", async () => {
    const runtime = mountScope();
    act(() => runtime.current().setInput("首页输入"));
    const owner = runtime.current().composerController;
    let receipt!: ReturnType<ComposerController["submit"]>;
    act(() => {
      receipt = owner.submit("start");
    });
    runtime.changeSurface();
    act(() => runtime.current().setInput((text) => `${text}，新增内容😀`));
    expect(owner.commit(receipt)).toBe(false);
    expect(runtime.current().input).toBe("首页输入，新增内容😀");
  });

  it("explicit navigation invalidates receipt and clears all draft resources", () => {
    const runtime = mountScope();
    const owner = runtime.current().composerController;
    act(() => {
      owner.setText("旧会话");
      owner.setAttachments([{ data: "image", mediaType: "image/png" }]);
      owner.setPathReferences([
        { id: "old", path: "/tmp/old", name: "old", isDir: false },
      ]);
      owner.setInputCapabilityRoute({
        kind: "builtin_command",
        commandKey: "old",
      });
    });
    let receipt!: ReturnType<ComposerController["submit"]>;
    act(() => {
      receipt = owner.submit("start");
    });
    act(() => runtime.current().resetComposerDraft());
    expect(owner.commit(receipt)).toBe(false);
    expect(owner.getDocument()).toMatchObject({
      text: "",
      attachments: [],
      pathReferences: [],
    });
    expect(owner.getDocument().inputCapabilityRoute).toBeUndefined();
  });
});
