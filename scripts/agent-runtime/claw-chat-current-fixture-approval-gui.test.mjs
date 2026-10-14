import { describe, expect, it } from "vitest";
import { isGuiApprovalPendingSnapshotReady } from "./claw-chat-current-fixture-approval-gui.mjs";

function pendingCard() {
  return {
    hasSection: true,
    hasCurrentInteractionLayer: true,
    interactionKind: "approval",
    hasApprovalContent: true,
    hasPrompt: true,
    hasToolName: true,
    hasCommand: true,
    hasDetails: true,
    hasPreformattedArguments: true,
    isApprovalCard: true,
    editorVisible: true,
    editorDisabled: false,
    approveButtonVisible: true,
    approveButtonDisabled: false,
  };
}

describe("approval GUI fixture readiness", () => {
  it("接受展示命令的 current pending 卡，不以固定高度判定成功", () => {
    expect(
      isGuiApprovalPendingSnapshotReady({
        ...pendingCard(),
        promptHeight: 240,
      }),
    ).toBe(true);
  });

  it.each([
    "hasCommand",
    "hasDetails",
    "hasPreformattedArguments",
    "hasCurrentInteractionLayer",
    "isApprovalCard",
  ])("缺少 %s 不能证明审批 UI 完成", (field) => {
    expect(
      isGuiApprovalPendingSnapshotReady({ ...pendingCard(), [field]: false }),
    ).toBe(false);
  });

  it("只读记录、禁用审批和未恢复 Composer 不计为 pending UI 通过", () => {
    expect(
      isGuiApprovalPendingSnapshotReady({
        ...pendingCard(),
        interactionKind: "request_user_input",
      }),
    ).toBe(false);
    expect(
      isGuiApprovalPendingSnapshotReady({
        ...pendingCard(),
        approveButtonDisabled: true,
      }),
    ).toBe(false);
    expect(
      isGuiApprovalPendingSnapshotReady({
        ...pendingCard(),
        editorDisabled: true,
      }),
    ).toBe(false);
    expect(isGuiApprovalPendingSnapshotReady(null)).toBe(false);
  });
});
