import { AppServerClient } from "./appServer";
import { readFileBytes, writeFileBytes } from "./fileBrowser";

export interface TextFileSnapshot {
  content: string;
  mtimeMs: number;
  sizeBytes: number;
}

export interface TextFileStorage {
  read(signal: AbortSignal): Promise<TextFileSnapshot>;
  write(
    content: string,
    expectedMtimeMs: number,
    signal: AbortSignal,
  ): Promise<{ outcome: "saved"; mtimeMs: number } | { outcome: "conflict" }>;
}

export function createTextFileStorage(path: string): TextFileStorage {
  const client = new AppServerClient();
  const metadata = async () => (await client.getMetadata({ path })).result;
  return {
    async read(signal) {
      // 文件读取与metadata不是原子快照；版本变化时重新读取，不能配上错误mtime。
      for (let attempt = 0; attempt < 3; attempt++) {
        signal.throwIfAborted();
        const before = await metadata();
        const bytes = await readFileBytes(path);
        const after = await metadata();
        signal.throwIfAborted();
        if (before.modifiedAtMs !== after.modifiedAtMs) continue;
        if (bytes.includes(0)) throw new Error("Binary file");
        return {
          content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          mtimeMs: after.modifiedAtMs,
          sizeBytes: bytes.byteLength,
        };
      }
      throw new Error("File changed while reading");
    },
    async write(content, expectedMtimeMs, signal) {
      signal.throwIfAborted();
      const before = await metadata();
      signal.throwIfAborted();
      if (before.modifiedAtMs !== expectedMtimeMs)
        return { outcome: "conflict" };
      // 对齐参考App Server的比较后写入序列；fs/writeFile不提供原子CAS。
      await writeFileBytes(path, new TextEncoder().encode(content));
      const after = await metadata();
      signal.throwIfAborted();
      return { outcome: "saved", mtimeMs: after.modifiedAtMs };
    },
  };
}
