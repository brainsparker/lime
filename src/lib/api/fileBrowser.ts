import { AppServerClient } from "@/lib/api/appServer";
import { safeInvoke } from "@/lib/dev-bridge";
import { assertNotDiagnosticFacade } from "./diagnosticFacade";

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedAt: number;
  permissions?: string;
  fileType?: string;
  isHidden?: boolean;
  modeStr?: string;
  mode?: number;
  mimeType?: string;
  isSymlink?: boolean;
  iconDataUrl?: string | null;
}

export interface DirectoryListing {
  path: string;
  parentPath: string | null;
  entries: FileEntry[];
  error: string | null;
}

export interface FilePreview {
  path: string;
  content: string | null;
  isBinary: boolean;
  size: number;
  error: string | null;
}

export type FileBrowserAppServerClient = Pick<
  AppServerClient,
  | "readFile"
  | "writeFile"
  | "createDirectory"
  | "getMetadata"
  | "readDirectory"
  | "remove"
  | "copy"
>;

function createFileBrowserAppServerClient(): FileBrowserAppServerClient {
  return new AppServerClient();
}

async function invokeFileBrowserCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const result = args
    ? await safeInvoke(command, args)
    : await safeInvoke(command);
  assertNotDiagnosticFacade(command, result, "真实文件管理 current 通道");
  return result as T;
}

function assertFileIconDataUrl(value: unknown): asserts value is string | null {
  if (value !== null && typeof value !== "string") {
    throw new Error("get_file_icon_data_url did not return file icon data URL");
  }
}

function joinPath(parentPath: string, fileName: string): string {
  const separator =
    parentPath.includes("\\") && !parentPath.includes("/") ? "\\" : "/";
  return `${parentPath.replace(/[\\/]$/, "")}${separator}${fileName}`;
}

function resolveParentPath(path: string): string | null {
  const normalized = path.replace(/[\\/]$/, "");
  const separatorIndex = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\"),
  );
  if (separatorIndex < 0) {
    return null;
  }
  if (separatorIndex === 0) {
    return normalized === "" ? null : normalized.slice(0, 1);
  }
  if (separatorIndex === 2 && normalized[1] === ":") {
    return normalized.slice(0, 3);
  }
  return normalized.slice(0, separatorIndex);
}

function fileTypeFromName(fileName: string): string | undefined {
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0 || extensionIndex === fileName.length - 1) {
    return undefined;
  }
  return fileName.slice(extensionIndex + 1).toLowerCase();
}

function mimeTypeFromFileType(
  fileType: string | undefined,
): string | undefined {
  switch (fileType) {
    case "md":
    case "markdown":
      return "text/markdown";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    case "html":
    case "htm":
      return "text/html";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "zip":
      return "application/zip";
    default:
      return undefined;
  }
}

function decodeBase64(dataBase64: string): Uint8Array {
  const binary = atob(dataBase64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeTextPreview(bytes: Uint8Array, maxSize: number): string | null {
  if (bytes.includes(0)) {
    return null;
  }
  const limit = Math.max(0, Math.floor(maxSize));
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const content = decoder.decode(bytes);
    // 分类基于完整文件；预览边界截断的多字节字符不能被误判为二进制。
    return bytes.length <= limit
      ? content
      : decoder.decode(bytes.subarray(0, limit), { stream: true });
  } catch {
    return null;
  }
}

export async function listDirectory(path: string): Promise<DirectoryListing> {
  const client = createFileBrowserAppServerClient();
  const response = await client.readDirectory({ path });
  const entries = await Promise.all(
    response.result.entries.map(async (entry): Promise<FileEntry> => {
      const entryPath = joinPath(path, entry.fileName);
      const metadata = await client.getMetadata({ path: entryPath });
      const fileType = entry.isDirectory
        ? undefined
        : fileTypeFromName(entry.fileName);
      return {
        name: entry.fileName,
        path: entryPath,
        isDir: entry.isDirectory,
        size: 0,
        modifiedAt: metadata.result.modifiedAtMs,
        fileType,
        isHidden: entry.fileName.startsWith("."),
        mimeType: entry.isDirectory
          ? "directory"
          : mimeTypeFromFileType(fileType),
        isSymlink: metadata.result.isSymlink,
        iconDataUrl: null,
      };
    }),
  );
  return {
    path,
    parentPath: resolveParentPath(path),
    entries,
    error: null,
  };
}

export async function getFileIconDataUrl(path: string): Promise<string | null> {
  const result = await invokeFileBrowserCommand<unknown>(
    "get_file_icon_data_url",
    {
      path,
    },
  );
  assertFileIconDataUrl(result);
  return result;
}

export async function readFilePreview(
  path: string,
  maxSize: number,
): Promise<FilePreview> {
  const bytes = await readFileBytes(path);
  const content = decodeTextPreview(bytes, maxSize);
  return {
    path,
    content,
    isBinary: content === null,
    size: bytes.length,
    error: null,
  };
}

export async function readFileBytes(path: string): Promise<Uint8Array> {
  const response = await createFileBrowserAppServerClient().readFile({ path });
  return decodeBase64(response.result.dataBase64);
}

export async function writeFileBytes(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192)
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  await createFileBrowserAppServerClient().writeFile({
    path,
    dataBase64: btoa(chunks.join("")),
  });
}

export async function createFileAtPath(path: string): Promise<void> {
  await createFileBrowserAppServerClient().writeFile({ path, dataBase64: "" });
}

export async function createDirectoryAtPath(path: string): Promise<void> {
  await createFileBrowserAppServerClient().createDirectory({
    path,
    recursive: true,
  });
}

export async function copyFile(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await createFileBrowserAppServerClient().copy({
    sourcePath,
    destinationPath,
    recursive: false,
  });
}

export async function renamePath(
  oldPath: string,
  newPath: string,
): Promise<void> {
  const client = createFileBrowserAppServerClient();
  const metadata = await client.getMetadata({ path: oldPath });
  await client.copy({
    sourcePath: oldPath,
    destinationPath: newPath,
    recursive: metadata.result.isDirectory,
  });
  await client.remove({
    path: oldPath,
    recursive: metadata.result.isDirectory,
    force: false,
  });
}

export async function deletePath(
  path: string,
  recursive: boolean,
): Promise<void> {
  await createFileBrowserAppServerClient().remove({
    path,
    recursive,
    force: false,
  });
}
