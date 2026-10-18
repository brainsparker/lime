import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashFileBytes } from "./fileRevision";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe("文件版本摘要", () => {
  it("跨 realm 的字节视图仍按选定范围计算摘要", async () => {
    const bytes = runInNewContext(
      "new Uint8Array([99, 0, 255, 128, 3, 88]).subarray(1, 5)",
    ) as Uint8Array;
    await expect(hashFileBytes(bytes)).resolves.toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  });

  it("仅摘要指定的原字节切片，保留零字节和非 UTF-8 数据", async () => {
    const bytes = new Uint8Array([99, 0, 255, 128, 3, 88]);
    const slice = bytes.subarray(1, 5);
    const expected = createHash("sha256").update(slice).digest("hex");
    const pending = hashFileBytes(slice);
    // Parser transfer/detach must not change the revision being computed.
    structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
    expect(await pending).toBe(expected);
    expect(expected).not.toBe(
      createHash("sha256").update("\0�\u0080\u0003").digest("hex"),
    );
  });

  it("空文件具有确定摘要；不支持摘要时拒绝而不发送未知版本", async () => {
    expect(await hashFileBytes(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    vi.stubGlobal("crypto", {});
    await expect(hashFileBytes(new Uint8Array([1]))).rejects.toThrow();
  });
});
