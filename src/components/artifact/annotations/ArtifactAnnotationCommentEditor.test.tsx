import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { hashFileBytes } from "@/lib/artifact/fileRevision";
import { createRuntimeAcceptanceReceipt } from "@/lib/api/agentRuntime/runtimeAcceptance";
import { ArtifactCommentSubmissionContext } from "../ArtifactCommentSubmissionContext";
import { useWorkspaceArtifactCommentSubmission } from "@/components/agent/chat/workspace/useWorkspaceArtifactCommentSubmission";
import {
  fromRuntimeAcceptanceReceipt,
  type RuntimeSubmissionResult,
} from "@/components/agent/chat/hooks/agentSendResult";
import { ArtifactAnnotationDraftStore } from "./ArtifactAnnotationDraftStore";
import { ArtifactAnnotationCommentEditor } from "./ArtifactAnnotationCommentEditor";

const mocks = vi.hoisted(() => ({ readBytes: vi.fn() }));
vi.mock("@/lib/api/fileBrowser", () => ({ readFileBytes: mocks.readBytes }));
vi.mock("@/lib/agentDebug", () => ({ logAgentDebug: vi.fn() }));
const bytes = new Uint8Array([0, 255, 80, 68, 70]);
const target = {
  pageNumber: 2,
  pageSize: { width: 600, height: 800 },
  anchor: { kind: "point" as const, point: { x: 100, y: 200 } },
};
const accepted = () =>
  fromRuntimeAcceptanceReceipt(
    createRuntimeAcceptanceReceipt(
      { sessionId: "s1", threadId: "t1" },
      "start",
      "turn2",
    ),
  );

describe("PDF 批注编辑与真实发送接线", () => {
  let root: Root;
  let container: HTMLDivElement;
  let send: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;
  let sourceSha256: string;
  let store: ArtifactAnnotationDraftStore;
  let inFlight: Promise<unknown> | undefined;
  function Harness() {
    const submission = useWorkspaceArtifactCommentSubmission({
      sessionId: "s1",
      threadId: "t1",
      projectId: "w1",
      isSending: false,
      activeSessionIdRef: { current: "s1" },
      getNavigationEpoch: () => 1,
      send: send as Parameters<
        typeof useWorkspaceArtifactCommentSubmission
      >[0]["send"],
    });
    return (
      <ArtifactCommentSubmissionContext.Provider
        value={
          submission && {
            ...submission,
            submit: (request) => {
              const promise = submission.submit(request);
              inFlight = promise;
              return promise;
            },
          }
        }
      >
        <ArtifactAnnotationCommentEditor
          draft={store.getSnapshot()[0]}
          store={store}
          onClose={close}
        />
      </ArtifactCommentSubmissionContext.Provider>
    );
  }
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("crypto", webcrypto);
    await changeLimeLocale("zh-CN");
    sourceSha256 = await hashFileBytes(bytes);
    store = new ArtifactAnnotationDraftStore();
    store.create("scope1", {
      ...target,
      format: "pdf" as const,
      id: "note1",
      path: "/workspace/report.pdf",
      sourceSha256,
      pageCount: 12,
    });
    inFlight = undefined;
    mocks.readBytes.mockReset().mockResolvedValue(bytes);
    send = vi.fn().mockResolvedValue(accepted());
    close = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    await changeLimeLocale("zh-CN");
  });
  const render = () => act(async () => root.render(<Harness />));
  const input = () => container.querySelector<HTMLTextAreaElement>("textarea")!;
  const edit = (value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(input(), value);
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
  const submit = (settle = true) =>
    act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      if (settle) await inFlight;
    });

  it("自动聚焦，空稿不能提交，接受后清稿并关闭", async () => {
    await render();
    expect(document.activeElement).toBe(input());
    expect(
      container.querySelector<HTMLButtonElement>("button[type=submit]")!
        .disabled,
    ).toBe(true);
    await edit("更新标题");
    await submit();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(container.querySelector("textarea")).toBeNull();
    expect(send).toHaveBeenCalledOnce();
  });

  it("文件变化保持正文，错误有可见终态且可重试", async () => {
    await render();
    await edit("保留这条批注");
    mocks.readBytes.mockResolvedValueOnce(new Uint8Array([1]));
    await submit();
    await vi.waitFor(() =>
      expect(container.querySelector("[role=alert]")?.textContent).toContain(
        "文件",
      ),
    );
    expect(input().value).toBe("保留这条批注");
    expect(send).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    await submit();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("在途期间重复发送被阻止，后输入的新稿不被旧接受清除", async () => {
    let resolve!: (value: RuntimeSubmissionResult) => void;
    send.mockReturnValueOnce(
      new Promise<RuntimeSubmissionResult>((done) => {
        resolve = done;
      }),
    );
    await render();
    await edit("第一条");
    await submit(false);
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    await submit(false);
    await edit("第二条");
    await act(async () => {
      resolve(accepted());
      await inFlight;
    });
    await vi.waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>("button[type=submit]")!
          .disabled,
      ).toBe(false),
    );
    expect(send).toHaveBeenCalledOnce();
    expect(input().value).toBe("第二条");
    expect(close).not.toHaveBeenCalled();
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
    "%s 提交失败保留正文，文案与可访问名称完整",
    async (locale) => {
      await changeLimeLocale(locale);
      send.mockResolvedValueOnce({ kind: "rejected" });
      await render();
      await edit("保留正文");
      await submit();
      await vi.waitFor(() =>
        expect(
          container.querySelector("[role=alert]")?.textContent?.trim(),
        ).toBeTruthy(),
      );
      expect(input().value).toBe("保留正文");
      expect(input().getAttribute("aria-label")).toBeTruthy();
      expect(container.innerHTML).not.toContain(
        "workspace.documentAnnotation.",
      );
      expect(close).not.toHaveBeenCalled();
    },
  );

  it("输入法确认不发送，独立 Ctrl+Enter 发送", async () => {
    await render();
    await edit("正文");
    await act(async () => {
      input().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          isComposing: true,
          bubbles: true,
        }),
      );
    });
    expect(send).not.toHaveBeenCalled();
    await act(async () => {
      input().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await inFlight;
    });
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
  });
});
