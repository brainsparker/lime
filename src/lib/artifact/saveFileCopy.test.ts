import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveFileCopy } from "./saveFileCopy";

const boundary = vi.hoisted(() => ({ save: vi.fn(), copy: vi.fn() }));
vi.mock("@/lib/desktop-host/dialog", () => ({ save: boundary.save }));
vi.mock("@/lib/api/fileBrowser", () => ({ copyFile: boundary.copy }));
beforeEach(() => vi.resetAllMocks());

describe("本地文件另存为", () => {
  it("原生位置选择后将原路径及目标委托同一复制边界", async () => {
    boundary.save.mockResolvedValue("C:\\exports\\copy.bin");
    await saveFileCopy("/work/source.bin", "Save as…", () => true);
    expect(boundary.save).toHaveBeenCalledExactlyOnceWith({
      title: "Save as…",
      defaultPath: "/work/source.bin",
    });
    expect(boundary.copy).toHaveBeenCalledExactlyOnceWith(
      "/work/source.bin",
      "C:\\exports\\copy.bin",
    );
  });

  it.each([null, "/work/source.bin"])(
    "取消或选中原路径%s不发送文件复制",
    async (destination) => {
      boundary.save.mockResolvedValue(destination);
      await saveFileCopy("/work/source.bin", "Save as…", () => true);
      expect(boundary.copy).not.toHaveBeenCalled();
    },
  );

  it("对话框等待中 scope 退出时不写入任何目标", async () => {
    let resolve!: (path: string) => void;
    boundary.save.mockReturnValue(new Promise<string>((r) => (resolve = r)));
    let current = true;
    const action = saveFileCopy("/work/source.bin", "Save as…", () => current);
    current = false;
    resolve("/exports/copy.bin");
    await action;
    expect(boundary.copy).not.toHaveBeenCalled();
  });

  it("原生对话框或复制失败交回公共动作 owner，不静默成功", async () => {
    boundary.save.mockRejectedValueOnce(new Error("dialog unavailable"));
    await expect(
      saveFileCopy("/work/source.bin", "Save as…", () => true),
    ).rejects.toThrow("dialog unavailable");
    boundary.save.mockResolvedValueOnce("/exports/copy.bin");
    boundary.copy.mockRejectedValueOnce(new Error("permission denied"));
    await expect(
      saveFileCopy("/work/source.bin", "Save as…", () => true),
    ).rejects.toThrow("permission denied");
  });
});
