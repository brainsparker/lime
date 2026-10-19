import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  materializeThreadGoal,
  type ThreadGoalDraft,
} from "@/lib/api/agentRuntime/threadGoalAttachments";
import {
  acceptedSubmission,
  runtimeReceipt,
} from "../hooks/agentSendResult.testFixtures";
import type { RuntimeSubmissionResult } from "../hooks/agentSendResult";
import { submitNewThreadGoal } from "./newThreadGoalSubmission";

vi.mock("@/lib/api/agentRuntime/threadGoalAttachments", () => ({
  materializeThreadGoal: vi.fn(),
}));

describe("submitNewThreadGoal ownership", () => {
  const draft: ThreadGoalDraft = {
    objective: "目标正文",
    pastedTextAttachments: [{ text: "完整 paste" }],
    imageAttachments: [],
  };
  const cleanup = vi.fn(async () => undefined);
  const assertRequestCurrent = vi.fn();
  const onPreparationFailed = vi.fn();
  const materializedObjective =
    "目标正文\nReferenced pasted text files: /isolated/goal/pasted-text-1.txt";

  beforeEach(() => {
    vi.clearAllMocks();
    assertRequestCurrent.mockReset();
    vi.mocked(materializeThreadGoal).mockResolvedValue({
      objective: materializedObjective,
      cleanup,
    });
  });

  it("首轮与 goal set 消费同一物化目标，接受后保留引用素材", async () => {
    const result = acceptedSubmission();
    const submit = vi.fn(async () => result);
    expect(
      await submitNewThreadGoal({
        draft,
        assertRequestCurrent,
        onPreparationFailed,
        submit,
      }),
    ).toBe(result);
    expect(materializeThreadGoal).toHaveBeenCalledWith(draft, {
      assertRequestCurrent,
    });
    expect(submit).toHaveBeenCalledWith({
      text: `/goal ${materializedObjective}`,
      threadGoal: { objective: materializedObjective },
      observer: {
        onSessionReady: expect.any(Function),
        onRuntimeAccepted: expect.any(Function),
      },
    });
    expect(cleanup).not.toHaveBeenCalled();
  });

  it.each<RuntimeSubmissionResult>([
    { kind: "rejected" },
    { kind: "local-handled" },
  ])("创建前 $kind 应回收本次素材", async (result) => {
    expect(
      await submitNewThreadGoal({
        draft,
        assertRequestCurrent,
        onPreparationFailed,
        submit: async () => result,
      }),
    ).toBe(result);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("未知接受结果保留素材等待既有提交 owner 结算", async () => {
    expect(
      await submitNewThreadGoal({
        draft,
        assertRequestCurrent,
        onPreparationFailed,
        submit: async () => ({ kind: "unknown" }),
      }),
    ).toEqual({ kind: "unknown" });
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("已创建真实 session 后首轮拒绝应保留恢复素材", async () => {
    const result = await submitNewThreadGoal({
      draft,
      assertRequestCurrent,
      onPreparationFailed,
      submit: async ({ observer }) => {
        observer.onSessionReady?.("session-created");
        return { kind: "rejected" };
      },
    });
    expect(result).toEqual({ kind: "rejected" });
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("接受回调后下游异常不能回收首轮已引用的素材", async () => {
    const error = new Error("post acceptance failure");
    await expect(
      submitNewThreadGoal({
        draft,
        assertRequestCurrent,
        onPreparationFailed,
        submit: async ({ observer }) => {
          observer.onRuntimeAccepted?.(runtimeReceipt());
          throw error;
        },
      }),
    ).rejects.toBe(error);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("创建前抛错回收素材并保留原始错误", async () => {
    const error = new Error("session creation rejected");
    await expect(
      submitNewThreadGoal({
        draft,
        assertRequestCurrent,
        onPreparationFailed,
        submit: async () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("物化后 binding 过期应回收素材且不创建线程", async () => {
    const error = new Error("stale binding");
    assertRequestCurrent.mockImplementation(() => {
      throw error;
    });
    const submit = vi.fn();
    expect(
      await submitNewThreadGoal({
        draft,
        assertRequestCurrent,
        onPreparationFailed,
        submit,
      }),
    ).toEqual({ kind: "rejected", error });
    expect(cleanup).toHaveBeenCalledOnce();
    expect(onPreparationFailed).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  it("物化失败不触发线程创建", async () => {
    const error = new Error("disk unavailable");
    vi.mocked(materializeThreadGoal).mockRejectedValueOnce(error);
    const submit = vi.fn();
    expect(
      await submitNewThreadGoal({
        draft,
        assertRequestCurrent,
        onPreparationFailed,
        submit,
      }),
    ).toEqual({ kind: "rejected", error });
    expect(onPreparationFailed).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});
