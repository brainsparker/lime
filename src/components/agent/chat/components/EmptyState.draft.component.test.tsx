import {
  mountedRoots,
  prepareCoordinator,
  renderEmptyState,
  flushAsyncEffects,
  expectEmptyStateSend,
} from "./EmptyState.testFixtures";

import {
  a,
  b,
  deferred,
} from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import type { RuntimeSubmissionResult } from "../hooks/agentSendResult";
import { getInputbarSendOptions } from "./Inputbar/inputbarSendPayload";
import { acceptedSubmission } from "../hooks/agentSendResult.testFixtures";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { insertComposerSkill } from "../skill-selection/composerCapabilityMention";
import { getComposerEditorText } from "@/components/input-kit/composerEditor.testUtils";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

import type { Skill } from "@/lib/api/skills";

import type { InputbarSendHandler } from "./Inputbar/inputbarSendPayload";

describe("EmptyState draft current integration", () => {
  it("首页中断恢复请求应由 EmptyState 完整恢复文本、图片、路径和技能 route", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const onInputRestoreRequestHandled = vi.fn();
    const pathReference = {
      id: "file:/tmp/report.md",
      path: "/tmp/report.md",
      name: "report.md",
      isDir: false,
      source: "file_manager" as const,
    };
    const image = {
      data: "image-data",
      mediaType: "image/png",
    };
    const skill = {
      key: "local:draft",
      name: "起草",
      description: "恢复输入用技能",
      directory: "draft",
      installed: true,
      sourceKind: "other",
    } as Skill;
    const draftController = new ComposerController({
      text: "继续生成提纲",
      attachments: [image],
      pathReferences: [pathReference],
    });
    insertComposerSkill(draftController, skill);
    const originalDraft = draftController.captureDraft();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ root, container });

    function RestoreHarness() {
      const [input, setInput] = React.useState("");
      const [pathReferences, setPathReferences] = React.useState<
        (typeof pathReference)[]
      >([]);
      const [restoreRequest, setRestoreRequest] = React.useState<
        React.ComponentProps<typeof EmptyState>["inputRestoreRequest"]
      >({
        requestId: "restore-empty-state-1",
        reason: "output_free_interrupted_turn",
        draft: {
          ...originalDraft,
          images: [image],
          pathReferences: [pathReference],
        },
      });

      return (
        <EmptyState
          input={input}
          setInput={setInput}
          onSend={onSend}
          providerType="openai"
          setProviderType={vi.fn()}
          model="gpt-4.1"
          setModel={vi.fn()}
          activeTheme="general"
          skills={[skill]}
          pathReferences={pathReferences}
          onClearPathReferences={() => setPathReferences([])}
          onAddPathReferences={(references) =>
            setPathReferences(references as (typeof pathReference)[])
          }
          inputRestoreRequest={restoreRequest}
          onInputRestoreRequestHandled={(requestId) => {
            onInputRestoreRequestHandled(requestId);
            setRestoreRequest(null);
          }}
        />
      );
    }

    await act(async () => {
      root.render(<RestoreHarness />);
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushAsyncEffects();

    expect(
      getComposerEditorText(
        container.querySelector<HTMLElement>(
          '[data-testid="composer-editor"][role="textbox"]',
        ),
      ),
    ).toBe(originalDraft.text);
    expect(
      container.querySelector('[data-composer-token="skill"]'),
    ).toBeTruthy();
    expect(onInputRestoreRequestHandled).toHaveBeenCalledWith(
      "restore-empty-state-1",
    );

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      images: [image],
      textOverride: "继续生成提纲 [$起草](draft/SKILL.md)",
      sendOptions: expect.objectContaining({
        inputRestoreDraft: expect.objectContaining({
          ...originalDraft,
          images: [image],
          pathReferences: [pathReference],
        }),
      }),
    });
  });

  it("starts real consume from the early observer while final send completion is pending", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<RuntimeSubmissionResult>();
    const commit = vi.spyOn(h.controller, "commit");
    const setInput = vi.fn();
    const onSend = vi.fn<InputbarSendHandler>((payload) => {
      getInputbarSendOptions(payload!)?.observer?.onRuntimeAccepted?.(
        acceptedSubmission().receipt,
      );
      return gate.promise;
    });
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      setInput,
      onSend,
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
      await h.coordinator.idle();
    });
    expect(onSend).toHaveBeenCalledOnce();
    expect(
      onSend.mock.calls[0][0]?.composerDraftCapture?.receipt.submission.text,
    ).toBe("EmptyState persistent draft");
    expect(commit).toHaveBeenCalledOnce();
    expect(setInput).toHaveBeenCalledWith("");
    await act(async () => {
      gate.resolve({ kind: "unknown" });
      await Promise.resolve();
    });
    expect(commit).toHaveBeenCalledOnce();
  });

  it("settles old capture after navigating and unmounting without clearing the new document", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<RuntimeSubmissionResult>();
    const setInput = vi.fn();
    const onSend = vi.fn<InputbarSendHandler>(() => gate.promise);
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      setInput,
      onSend,
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await h.coordinator.bindCommitted(b);
      h.controller.setText("new target draft");
    });
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
    setInput.mockClear();
    await act(async () => {
      gate.resolve(acceptedSubmission());
      await Promise.resolve();
      await h.coordinator.idle();
    });
    expect(await h.read(a)).toBeNull();
    expect(h.controller.getDocument().text).toBe("new target draft");
    expect(setInput).not.toHaveBeenCalledWith("");
  });

  it("rejects persistent restore without the original capture token", async () => {
    const h = await prepareCoordinator();
    const handled = vi.fn();
    renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      inputRestoreRequest: {
        requestId: "old",
        reason: "output_free_interrupted_turn",
        draft: { text: "stale other scope" },
      },
      onInputRestoreRequestHandled: handled,
    });
    await flushAsyncEffects();
    expect(h.controller.getDocument().text).toBe("EmptyState persistent draft");
    expect(handled).toHaveBeenCalledWith("old");
  });

  it("restores the accepted draft with a matching original token after consume", async () => {
    const h = await prepareCoordinator();
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      onSend,
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await h.coordinator.idle();
    });
    const payload = onSend.mock.calls[0][0]!;
    expect(h.controller.getDocument().text).toBe("");
    const first = mountedRoots.pop()!;
    act(() => first.root.unmount());
    first.container.remove();
    const handled = vi.fn();
    renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: "",
      inputRestoreRequest: {
        requestId: "same",
        reason: "output_free_interrupted_turn",
        draft: payload.sendOptions!.inputRestoreDraft!,
        composerRestoreToken: payload.composerRestoreToken,
      },
      onInputRestoreRequestHandled: handled,
    });
    await flushAsyncEffects();
    expect(h.controller.getDocument().text).toBe("EmptyState persistent draft");
    expect(handled).toHaveBeenCalledWith("same");
  });

  it("defers an early stop restore until the same token finishes consuming", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<unknown>();
    h.intercept((command, args, execute) =>
      command === "persisted_atom_update" &&
      (args.mutation as { op: string }).op === "consume"
        ? gate.promise.then(execute)
        : execute(),
    );
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      onSend,
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });
    const payload = onSend.mock.calls[0][0]!;
    const first = mountedRoots.pop()!;
    act(() => first.root.unmount());
    first.container.remove();
    const handled = vi.fn();
    renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      inputRestoreRequest: {
        requestId: "early",
        reason: "output_free_interrupted_turn",
        draft: payload.sendOptions!.inputRestoreDraft!,
        composerRestoreToken: payload.composerRestoreToken,
      },
      onInputRestoreRequestHandled: handled,
    });
    await flushAsyncEffects();
    expect(handled).not.toHaveBeenCalled();
    await act(async () => {
      gate.resolve(null);
      await h.coordinator.idle();
    });
    await flushAsyncEffects();
    expect(handled).toHaveBeenCalledWith("early");
    expect(h.controller.getDocument().text).toBe("EmptyState persistent draft");
  });
  it.each([
    { kind: "unknown" as const },
    { kind: "local-handled" as const },
    { kind: "rejected" as const },
  ])("preserves draft for %j", async (result) => {
    const controller = new ComposerController({ text: "保留首页富草稿😀" });
    const onSend = vi.fn<InputbarSendHandler>(async () => result);
    const setInput = vi.fn();
    const container = renderEmptyState({
      input: controller.getDocument().text,
      composerController: controller,
      onSend,
      setInput,
      activeTheme: "general",
    });
    await flushAsyncEffects();
    const before = controller.captureDraft();
    const button = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(onSend).toHaveBeenCalledOnce();
    expect(controller.captureDraft()).toEqual(before);
    expect(setInput).not.toHaveBeenCalledWith("");
  });
  it("发送失败时保留同一技能 atom、selection 和完整文档", async () => {
    const skill: Skill = {
      key: "review",
      name: "Review",
      directory: "/skills/review",
      description: "Review",
      installed: true,
      sourceKind: "other",
    };
    const controller = new ComposerController({ text: "检查代码😀 " });
    insertComposerSkill(controller, skill);
    const onSend = vi.fn<InputbarSendHandler>(async () => {
      throw new Error("offline");
    });
    const container = renderEmptyState({
      input: controller.getDocument().text,
      composerController: controller,
      onSend,
      skills: [skill],
    });
    await flushAsyncEffects();
    const before = controller.captureDraft();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="发送"]')!
        .click();
      await Promise.resolve();
    });
    expect(onSend).toHaveBeenCalledOnce();
    expect(controller.captureDraft()).toEqual(before);
  });
});
