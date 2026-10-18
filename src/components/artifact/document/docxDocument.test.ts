import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDocxDocument, buildDocxPreviewHtml } from "./docxDocument";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/api/fileBrowser", () => ({ readFileBytes: mocks.read }));
const fixture = (name = "layout.docx") =>
  new Uint8Array(
    readFileSync(
      path.resolve("src/components/artifact/document/__fixtures__", name),
    ),
  );
beforeEach(() => mocks.read.mockReset().mockResolvedValue(fixture()));
afterEach(() => vi.restoreAllMocks());

describe("DOCX 原字节与版式隔离", () => {
  it("真实ZIP保留分页、表格、页眉与修订，禁用altChunk，HTTP链接只向外打开", async () => {
    const result = await loadDocxDocument(
      "/tmp/report.docx",
      false,
      new AbortController().signal,
    );
    expect(mocks.read).toHaveBeenCalledWith("/tmp/report.docx");
    expect(result.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.pageCount).toBe(2);
    expect(buildDocxPreviewHtml(result, 1, 0.1)).toContain("zoom:0.1");
    expect(result.hasRedlines).toBe(true);
    const document = new DOMParser().parseFromString(
      buildDocxPreviewHtml(result, 1, 0.75),
      "text/html",
    );
    expect(document.querySelectorAll("section.docx")).toHaveLength(2);
    expect(document.querySelector("table")?.textContent).toContain("Revenue42");
    expect(document.querySelector("header")?.textContent).toContain(
      "DOCX_HEADER",
    );
    expect(document.body.textContent).toContain("INSERTED_REVISION");
    expect(document.body.textContent).not.toContain("DELETED_REVISION");
    expect(document.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.invalid/blocked",
    );
    expect(document.querySelector("a")?.getAttribute("target")).toBe("_blank");
    expect(document.querySelector("iframe,script,object,embed")).toBeNull();
    expect(document.body.textContent).not.toContain(
      "ALT_CHUNK_MUST_NOT_RENDER",
    );
    expect(
      document.querySelector("meta[http-equiv]")?.getAttribute("content"),
    ).toContain("default-src 'none'");
    const changed = await loadDocxDocument(
      "/tmp/report.docx",
      true,
      new AbortController().signal,
    );
    expect(changed.html).toContain("DELETED_REVISION");
    expect(changed.sourceSha256).toBe(result.sourceSha256);
  });

  it("损坏ZIP与非法Unicode symbol显式失败", async () => {
    mocks.read.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    await expect(
      loadDocxDocument("/tmp/broken.docx", false, new AbortController().signal),
    ).rejects.toThrow();
    mocks.read.mockResolvedValueOnce(fixture("invalid-symbol.docx"));
    await expect(
      loadDocxDocument(
        "/tmp/invalid.docx",
        false,
        new AbortController().signal,
      ),
    ).rejects.toThrow("Invalid DOCX symbol");
  });

  it("取消后的迟到字节不进入解析/渲染", async () => {
    let resolve!: (bytes: Uint8Array) => void;
    mocks.read.mockReturnValueOnce(
      new Promise<Uint8Array>((done) => {
        resolve = done;
      }),
    );
    const controller = new AbortController();
    const promise = loadDocxDocument("/tmp/old.docx", false, controller.signal);
    controller.abort();
    resolve(new Uint8Array([0]));
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});
