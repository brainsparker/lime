import { importWorkbook } from "./workbookDocument";
import {
  WorkbookImportError,
  type WorkbookImportResult,
  type WorkbookSourceFormat,
} from "./workbookSnapshot";

self.onmessage = async (
  event: MessageEvent<{ bytes: Uint8Array; format: WorkbookSourceFormat }>,
) => {
  let result: WorkbookImportResult;
  try {
    result = {
      ok: true,
      sheets: await importWorkbook(event.data.bytes, event.data.format),
    };
  } catch (error) {
    result = {
      ok: false,
      reason: error instanceof WorkbookImportError ? error.reason : "invalid",
    };
  }
  self.postMessage(result);
};
