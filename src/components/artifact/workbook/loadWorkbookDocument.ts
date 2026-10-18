import { readFileBytes } from "@/lib/api/fileBrowser";
import { hashFileBytes } from "@/lib/artifact/fileRevision";
import {
  resolveWorkbookSourceFormat,
  WorkbookImportError,
  type WorkbookImportResult,
  type WorkbookSnapshot,
} from "./workbookSnapshot";

export interface WorkbookDocumentTask {
  promise: Promise<WorkbookSnapshot>;
  destroy: () => void;
}

export function loadWorkbookDocument(path: string): WorkbookDocumentTask {
  let worker: Worker | undefined;
  let canceled = false;
  let rejectImport: ((error: Error) => void) | undefined;
  const cancelError = () => new DOMException("Preview canceled", "AbortError");
  const promise = (async () => {
    const format = resolveWorkbookSourceFormat(path);
    if (!format) throw new WorkbookImportError("invalid");
    const bytes = await readFileBytes(path);
    if (canceled) throw cancelError();
    const sourceSha256 = await hashFileBytes(bytes);
    if (canceled) throw cancelError();
    worker = new Worker(
      new URL("./workbookImport.worker.ts", import.meta.url),
      { type: "module" },
    );
    const sheets = await new Promise<WorkbookSnapshot["sheets"]>(
      (resolve, reject) => {
        rejectImport = reject;
        worker!.onmessage = (event: MessageEvent<WorkbookImportResult>) => {
          if (event.data.ok) resolve(event.data.sheets);
          else reject(new WorkbookImportError(event.data.reason));
        };
        worker!.onerror = () => reject(new WorkbookImportError("invalid"));
        worker!.onmessageerror = () =>
          reject(new WorkbookImportError("invalid"));
        const data = bytes.slice();
        worker!.postMessage({ bytes: data, format }, [data.buffer]);
      },
    );
    if (canceled) throw cancelError();
    return { sourceSha256, sheets };
  })().finally(() => {
    worker?.terminate();
    worker = undefined;
    rejectImport = undefined;
  });
  return {
    promise,
    destroy() {
      if (canceled) return;
      canceled = true;
      worker?.terminate();
      rejectImport?.(cancelError());
    },
  };
}
