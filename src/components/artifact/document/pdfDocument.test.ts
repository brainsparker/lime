import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPdfDocument } from "./pdfDocument";

const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), readBytes: vi.fn() }));
vi.mock("@/lib/api/fileBrowser", () => ({ readFileBytes: mocks.readBytes }));
vi.mock("pdfjs-dist", () => ({
  getDocument: mocks.getDocument,
  GlobalWorkerOptions: {},
}));

describe("PDF 字节读取与资源释放", () => {
  const document = { numPages: 2 };
  const destroy = vi.fn();
  const fetchFile = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    destroy.mockReset().mockResolvedValue(undefined);
    mocks.getDocument
      .mockReset()
      .mockReturnValue({ promise: Promise.resolve(document), destroy });
    mocks.readBytes
      .mockReset()
      .mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    fetchFile.mockReset().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer,
    });
    vi.stubGlobal("fetch", fetchFile);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("读取源字节后使用本地 worker/字体资源，释放幂等", async () => {
    const task = loadPdfDocument("/tmp/fixture.pdf");
    expect(await task.promise).toEqual({
      document,
      sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(mocks.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: new Uint8Array([37, 80, 68, 70]),
        enableXfa: false,
        useWorkerFetch: false,
        useSystemFonts: false,
      }),
    );
    await task.destroy();
    await task.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("取消在途读取后，即使旧响应迟到也不创建解析器", async () => {
    let finish!: (value: unknown) => void;
    mocks.readBytes.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const task = loadPdfDocument("/tmp/old.pdf");
    const rejected = expect(task.promise).rejects.toMatchObject({
      name: "AbortError",
    });
    await task.destroy();
    finish(new Uint8Array(4));
    await rejected;
    expect(mocks.getDocument).not.toHaveBeenCalled();
  });

  it("文件读取失败不把响应正文交给解析器", async () => {
    mocks.readBytes.mockRejectedValueOnce(new Error("unavailable"));
    const task = loadPdfDocument("/tmp/missing.pdf");
    await expect(task.promise).rejects.toThrow("unavailable");
    expect(mocks.getDocument).not.toHaveBeenCalled();
    await task.destroy();
  });

  it("字体/CMap 请求只能选择打包资源，任意文件名不触发网络", async () => {
    await loadPdfDocument("/tmp/fixture.pdf").promise;
    const Factory = mocks.getDocument.mock.calls[0][0].BinaryDataFactory;
    const factory = new Factory();
    await expect(
      factory.fetch({ kind: "cMapUrl", filename: "../../secret" }),
    ).rejects.toThrow("unavailable");
    expect(fetchFile).not.toHaveBeenCalled();
    await factory.fetch({
      kind: "cMapUrl",
      filename: "Adobe-Japan1-UCS2.bcmap",
    });
    expect(fetchFile).toHaveBeenCalledTimes(1);
    expect(fetchFile.mock.calls[0][0]).toContain("Adobe-Japan1-UCS2.bcmap");
  });
});
