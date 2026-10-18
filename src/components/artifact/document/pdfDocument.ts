import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { readFileBytes } from "@/lib/api/fileBrowser";
import { hashFileBytes } from "@/lib/artifact/fileRevision";

GlobalWorkerOptions.workerSrc = workerSrc;

const binaryResources = import.meta.glob<string>(
  "/node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/*.{bcmap,ttf,pfb,wasm}",
  { query: "?url", import: "default", eager: true },
);

class PdfBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    const directory = {
      cMapUrl: "cmaps",
      standardFontDataUrl: "standard_fonts",
      wasmUrl: "wasm",
    }[kind];
    const url =
      binaryResources[`/node_modules/pdfjs-dist/${directory}/${filename}`];
    if (!url) throw new Error("PDF resource is unavailable");
    const response = await fetch(url);
    if (!response.ok) throw new Error("PDF resource could not be read");
    return new Uint8Array(await response.arrayBuffer());
  }
}

export interface PdfDocumentTask {
  promise: Promise<PdfDocumentSnapshot>;
  destroy: () => Promise<void>;
}

export interface PdfDocumentSnapshot {
  document: PDFDocumentProxy;
  sourceSha256: string;
}

// 字节走现有 App Server fs/readFile；PDF 脚本、表单和链接不交给页面执行。
export function loadPdfDocument(path: string): PdfDocumentTask {
  let loadingTask: PDFDocumentLoadingTask | undefined;
  let destroyed = false;
  let destroyPromise: Promise<void> | undefined;
  const promise = (async () => {
    const data = await readFileBytes(path);
    if (destroyed) throw new DOMException("Preview canceled", "AbortError");
    const sourceHash = hashFileBytes(data);
    loadingTask = getDocument({
      data,
      enableXfa: false,
      useSystemFonts: false,
      useWorkerFetch: false,
      BinaryDataFactory: PdfBinaryDataFactory,
    });
    const [document, sourceSha256] = await Promise.all([
      loadingTask.promise,
      sourceHash,
    ]);
    return { document, sourceSha256 };
  })();
  return {
    promise,
    destroy: () => {
      if (destroyPromise) return destroyPromise;
      destroyed = true;
      destroyPromise = loadingTask?.destroy() ?? Promise.resolve();
      return destroyPromise;
    },
  };
}

export function isPdfPasswordError(error: unknown): boolean {
  return error instanceof Error && error.name === "PasswordException";
}
