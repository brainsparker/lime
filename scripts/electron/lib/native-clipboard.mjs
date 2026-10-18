import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// 原始 pasteboard 数据仅经子进程管道留在内存；不放入 argv、日志或文件。
const pasteboardScript = `
ObjC.import("AppKit");
ObjC.import("Foundation");
function run(argv) {
  const board = $.NSPasteboard.generalPasteboard;
  function snapshot() {
    const result = [], items = board.pasteboardItems;
    for (let i = 0; i < items.count; i++) {
      const item = items.objectAtIndex(i), formats = [];
      for (let j = 0; j < item.types.count; j++) {
        const type = item.types.objectAtIndex(j);
        const data = ObjC.unwrap(item.dataForType(type).base64EncodedStringWithOptions(0));
        if (typeof data !== "string") throw new Error("Unreadable native clipboard format");
        formats.push({type: ObjC.unwrap(type), data});
      }
      result.push(formats);
    }
    return result;
  }
  if (argv[0] === "read") return JSON.stringify(snapshot());
  const input = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
  const original = JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding(input, $.NSUTF8StringEncoding)));
  // 先完整解码所有数据并构造 item，失败时不清空当前剪贴板。
  const items = original.map(formats => {
    const item = $.NSPasteboardItem.alloc.init;
    formats.forEach(format => {
      const data = $.NSData.alloc.initWithBase64EncodedStringOptions($(format.data), 0);
      if (!item.setDataForType(data, $(format.type))) throw new Error("Native clipboard format cannot be restored");
    });
    return item;
  });
  board.clearContents;
  if (items.length && !board.writeObjects($(items))) throw new Error("Native clipboard restore failed");
  return JSON.stringify(JSON.stringify(snapshot()) === JSON.stringify(original));
}
`;

export function runMacPasteboard(operation, snapshot) {
  assert.ok(
    ["read", "restore"].includes(operation),
    "invalid clipboard operation",
  );
  return new Promise((resolve, reject) => {
    const child = spawn(
      "/usr/bin/osascript",
      ["-l", "JavaScript", "-e", pasteboardScript, operation],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const output = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("native clipboard operation timed out"));
    }, 15_000);
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error("native clipboard helper unavailable"));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal) {
        reject(
          new Error("native clipboard helper failed; no user data logged"),
        );
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(output).toString("utf8")));
      } catch {
        reject(new Error("invalid native clipboard helper response"));
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(snapshot === undefined ? "" : JSON.stringify(snapshot));
  });
}

export async function withNativeClipboard(
  app,
  perform,
  { platform = process.platform, native = runMacPasteboard } = {},
) {
  assert.equal(
    typeof app?.evaluate,
    "function",
    "real Electron main clipboard API is required",
  );
  let restore;
  if (platform === "darwin") {
    await app.evaluate(({ clipboard }) => {
      if (
        !clipboard
          .availableFormats()
          .every((format) =>
            [
              "text/plain",
              "text/html",
              "text/rtf",
              "application/rtf",
              "image/png",
            ].includes(format),
          )
      )
        throw new Error(
          "Clipboard has unsupported formats; refusing to overwrite user clipboard",
        );
    });
    const backup = await native("read");
    restore = async () => {
      assert.equal(
        await native("restore", backup),
        true,
        "native clipboard restoration failed; user content is never written to evidence",
      );
    };
  } else {
    const backup = await app.evaluate(({ clipboard }) => {
      const formats = clipboard.availableFormats();
      if (
        !formats.every((format) =>
          [
            "text/plain",
            "text/html",
            "text/rtf",
            "application/rtf",
            "image/png",
          ].includes(format),
        )
      )
        throw new Error(
          "Clipboard has unsupported formats; refusing to overwrite user clipboard",
        );
      const data = {};
      if (formats.includes("text/plain")) data.text = clipboard.readText();
      if (formats.includes("text/html")) data.html = clipboard.readHTML();
      if (
        formats.some((format) =>
          ["text/rtf", "application/rtf"].includes(format),
        )
      )
        data.rtf = clipboard.readRTF();
      if (formats.includes("image/png"))
        data.image = clipboard.readImage().toDataURL();
      return { formats, data };
    });
    restore = async () => {
      const restored = await app.evaluate(
        ({ clipboard, nativeImage }, original) => {
          clipboard.clear();
          if (original.formats.length) {
            const data = { ...original.data };
            if (data.image)
              data.image = nativeImage.createFromDataURL(data.image);
            clipboard.write(data);
          }
          return (
            JSON.stringify(clipboard.availableFormats().sort()) ===
              JSON.stringify([...original.formats].sort()) &&
            (original.data.text === undefined ||
              clipboard.readText() === original.data.text) &&
            (original.data.html === undefined ||
              clipboard.readHTML() === original.data.html) &&
            (original.data.rtf === undefined ||
              clipboard.readRTF() === original.data.rtf) &&
            (original.data.image === undefined ||
              clipboard.readImage().toDataURL() === original.data.image)
          );
        },
        backup,
      );
      assert.equal(
        restored,
        true,
        "native clipboard restoration failed; user content is never written to evidence",
      );
    };
  }
  let failed = false,
    failure;
  try {
    return await perform();
  } catch (error) {
    failed = true;
    failure = error;
    throw error;
  } finally {
    try {
      await restore();
    } catch (error) {
      if (failed)
        throw new AggregateError(
          [failure, error],
          "scenario and native clipboard restoration both failed",
        );
      throw error;
    }
  }
}
