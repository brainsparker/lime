import { AppServerClient } from "./appServer";
import { open } from "@/lib/desktop-host/dialog";
import { getElectronHostBridge } from "@/lib/electron-host";

export interface PickedFile {
  label: string;
  path: string;
  fsPath: string;
}

export interface PickFilesOptions {
  acceptedFileExtensions?: string[];
  allowMultiple?: boolean;
  imagesOnly?: boolean;
  kind?: "file" | "directory";
  title?: string;
}

export async function pickFilesFromDialog({
  acceptedFileExtensions,
  allowMultiple = true,
  imagesOnly = false,
  kind,
  title,
}: PickFilesOptions = {}): Promise<PickedFile[]> {
  if (!getElectronHostBridge()?.dialog) {
    throw new Error("Native file dialog is unavailable");
  }
  const extensions = imagesOnly
    ? ["png", "jpg", "jpeg", "gif", "webp"]
    : acceptedFileExtensions;
  const filesAndDirectories =
    kind === undefined &&
    allowMultiple &&
    !imagesOnly &&
    extensions === undefined;
  const selected = await open({
    title,
    multiple: allowMultiple,
    directory: kind === "directory",
    filesAndDirectories,
    filters: extensions?.length
      ? [{ name: title || extensions.join(", "), extensions }]
      : undefined,
  });
  if (selected === null) return [];
  const paths = typeof selected === "string" ? [selected] : selected;
  if (
    !Array.isArray(paths) ||
    paths.some((path) => typeof path !== "string" || !path)
  ) {
    throw new Error("Native file dialog returned invalid paths");
  }
  const client = filesAndDirectories ? new AppServerClient() : null;
  return Promise.all(
    paths.map(async (fsPath) => {
      const isDirectory =
        kind === "directory" ||
        (client !== null &&
          (await client.getMetadata({ path: fsPath })).result.isDirectory);
      const separator =
        fsPath.includes("\\") && !fsPath.includes("/") ? "\\" : "/";
      const label =
        fsPath
          .replace(/[\\/]+$/, "")
          .split(/[\\/]/)
          .at(-1) || fsPath;
      return {
        label,
        path:
          isDirectory && !/[\\/]$/.test(fsPath) ? fsPath + separator : fsPath,
        fsPath,
      };
    }),
  );
}
