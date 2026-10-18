import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWorkbookDocument } from "./loadWorkbookDocument";
import type { WorkbookImportResult } from "./workbookSnapshot";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/api/fileBrowser", () => ({ readFileBytes: mocks.read }));

class ImportWorker {
  static instances: ImportWorker[] = [];
  onmessage?: (event: MessageEvent<WorkbookImportResult>) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(
    public url: URL,
    public options: { type: "module" },
  ) {
    ImportWorker.instances.push(this);
  }
}

beforeEach(() => {
  ImportWorker.instances = [];
  mocks.read
    .mockReset()
    .mockResolvedValue(new TextEncoder().encode("name,value\nA,001"));
  vi.stubGlobal("Worker", ImportWorker);
});
afterEach(() => vi.unstubAllGlobals());
const workerReady = async () => {
  await vi.waitFor(() => expect(ImportWorker.instances).toHaveLength(1));
  return ImportWorker.instances[0];
};

describe("Workbook 导入生命周期", () => {
  it("原字节经 gateway 读取、SHA 绑定并传输，成功后释放 Worker", async () => {
    const bytes = new TextEncoder().encode("name,value\nA,001");
    const task = loadWorkbookDocument("/tmp/report.csv");
    const worker = await workerReady();
    expect(mocks.read).toHaveBeenCalledWith("/tmp/report.csv");
    expect(worker.postMessage).toHaveBeenCalledWith({ bytes, format: "csv" }, [
      bytes.buffer,
    ]);
    expect(worker.options.type).toBe("module");
    worker.onmessage?.({
      data: { ok: true, sheets: [] },
    } as unknown as MessageEvent<WorkbookImportResult>);
    await expect(task.promise).resolves.toEqual({
      sheets: [],
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("读取期间取消，迟到字节不创建 Worker", async () => {
    let resolve!: (value: Uint8Array) => void;
    mocks.read.mockReturnValueOnce(
      new Promise<Uint8Array>((done) => {
        resolve = done;
      }),
    );
    const task = loadWorkbookDocument("/tmp/old.xlsx");
    task.destroy();
    task.destroy();
    const rejected = expect(task.promise).rejects.toMatchObject({
      name: "AbortError",
    });
    resolve(Uint8Array.of(1));
    await rejected;
    expect(ImportWorker.instances).toHaveLength(0);
  });

  it("解析期间取消立即结算并终止，不接受迟到成功", async () => {
    const task = loadWorkbookDocument("/tmp/old.xlsx");
    const worker = await workerReady();
    const rejected = expect(task.promise).rejects.toMatchObject({
      name: "AbortError",
    });
    task.destroy();
    worker.onmessage?.({
      data: { ok: true, sheets: [] },
    } as unknown as MessageEvent<WorkbookImportResult>);
    await rejected;
    expect(worker.terminate).toHaveBeenCalled();
  });

  it.each(["import", "worker", "message"])(
    "%s 失败显式结算并释放资源",
    async (kind) => {
      const task = loadWorkbookDocument("/tmp/fail.xlsx");
      const rejected = expect(task.promise).rejects.toMatchObject({
        reason: kind === "import" ? "tooLarge" : "invalid",
      });
      const worker = await workerReady();
      if (kind === "import")
        worker.onmessage?.({
          data: { ok: false, reason: "tooLarge" },
        } as MessageEvent<WorkbookImportResult>);
      else if (kind === "worker") worker.onerror?.();
      else worker.onmessageerror?.();
      await rejected;
      expect(worker.terminate).toHaveBeenCalledOnce();
    },
  );

  it("不支持格式不读文件，读取失败也不进入 Worker", async () => {
    await expect(
      loadWorkbookDocument("/tmp/old.xls").promise,
    ).rejects.toMatchObject({ reason: "invalid" });
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.read.mockRejectedValueOnce(new Error("permission"));
    await expect(
      loadWorkbookDocument("/tmp/locked.xlsx").promise,
    ).rejects.toThrow("permission");
    expect(ImportWorker.instances).toHaveLength(0);
  });
});
