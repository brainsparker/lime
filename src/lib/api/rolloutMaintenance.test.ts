import { describe, expect, it, vi } from "vitest";
import { compressRollouts } from "./rolloutMaintenance";

describe("rollout maintenance gateway", () => {
  it("通过共享 JSON-RPC 触发并只消费 ACK", async () => {
    const request = vi.fn().mockResolvedValue({ result: {} });
    await expect(compressRollouts({ request })).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith("rollout/compress");
  });

  it.each([null, [], false, { completed: true }])(
    "拒绝非合同 ACK，避免把响应猜测成完成状态：%j",
    async (result) => {
      const request = vi.fn().mockResolvedValue({ result });
      await expect(compressRollouts({ request })).rejects.toThrow(
        "Invalid rollout/compress acknowledgement",
      );
    },
  );
});
