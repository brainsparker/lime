export interface FilePathBreadcrumbInput {
  path: string;
  cwd?: string | null;
  workspaceRoot?: string | null;
}

export interface FilePathBreadcrumbTarget {
  activePath: string | null;
  directoryPath: string | null;
}

function normalizePath(path: string): string {
  return path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\(?=[a-z]:[\\/])/i, "")
    .replace(/\\/g, "/");
}

function isWindowsPath(path: string): boolean {
  return (
    /^[a-z]:[\\/]/i.test(path) || /^(?:\\\\|\/\/)[^/\\]+[/\\][^/\\]+/.test(path)
  );
}

function isAbsolutePath(path: string): boolean {
  return (
    (path.startsWith("/") && !path.startsWith("//")) || isWindowsPath(path)
  );
}

function basename(path: string): string {
  return normalizePath(path).replace(/\/+$/, "").split("/").at(-1) ?? "";
}

function relativeDisplayPath(path: string, root: string): string {
  const normalizedRoot = root.replace(/\\/g, "/");
  const normalizedPath = path.replace(/\\/g, "/");
  const prefix = normalizedRoot.replace(/\/$/, "");
  const windows = isWindowsPath(normalizedRoot);
  const comparableRoot = windows ? prefix.toLowerCase() : prefix;
  const comparablePath = windows
    ? normalizedPath.toLowerCase()
    : normalizedPath;
  if (comparablePath.startsWith(`${comparableRoot}/`)) {
    return normalizedPath.slice(prefix.length + 1);
  }
  const label = `${comparableRoot.split("/").at(-1) ?? comparableRoot}/`;
  const index = comparablePath.indexOf(label);
  return index !== -1 && (index === 0 || comparablePath[index - 1] === "/")
    ? normalizedPath.slice(index + label.length)
    : normalizedPath;
}

function isWindowsRoot(root: string): boolean {
  const normalized = normalizePath(root);
  const wsl = normalized.match(
    /^\/\/(?:wsl\$|wsl\.localhost)\/[^/]+(?:\/(.*))?$/i,
  );
  return wsl
    ? /^mnt\/[a-z](?:\/|$)/i.test(wsl[1] ?? "")
    : isWindowsPath(normalized.replace(/^\/(?=[a-z]:\/)/i, ""));
}

export function getFilePathBreadcrumb(input: FilePathBreadcrumbInput): {
  displayPath: string;
  segments: string[];
  targets: Array<FilePathBreadcrumbTarget | undefined> | null;
} {
  const { path, cwd, workspaceRoot } = input;
  const displayRoot =
    cwd != null && !isAbsolutePath(relativeDisplayPath(path, cwd))
      ? cwd
      : workspaceRoot;
  const relative =
    displayRoot == null ? path : relativeDisplayPath(path, displayRoot);
  const displayPath = normalizePath(
    displayRoot == null || isAbsolutePath(relative)
      ? relative
      : [basename(displayRoot), normalizePath(relative)]
          .filter(Boolean)
          .join("/"),
  );
  const segments = displayPath.split("/").filter(Boolean);
  if (workspaceRoot == null) return { displayPath, segments, targets: null };

  const normalizedPath = normalizePath(
    path.replace(/^\/(?=[a-z]:[\\/])/i, ""),
  ).replace(/\/+$/, "");
  const normalizedRoot = normalizePath(workspaceRoot).replace(/\/+$/, "");
  let relativePath = normalizedPath;
  if (!relativePath) return { displayPath, segments, targets: null };
  if (isAbsolutePath(normalizedPath)) {
    if (
      !normalizedRoot ||
      !normalizedPath
        .toLowerCase()
        .startsWith(`${normalizedRoot.toLowerCase()}/`)
    ) {
      return { displayPath, segments, targets: null };
    }
    relativePath = normalizedPath.slice(normalizedRoot.length + 1);
  }
  const paths = relativePath.split("/").filter(Boolean);
  const commonCount = Math.min(segments.length, paths.length);
  const segmentOffset = segments.length - commonCount;
  const pathOffset = paths.length - commonCount;
  const windows = isWindowsRoot(workspaceRoot);
  const equal = (left: string, right: string) =>
    windows ? left.toLowerCase() === right.toLowerCase() : left === right;
  if (
    segments
      .slice(segmentOffset)
      .some(
        (segment, index) => !equal(segment, paths[pathOffset + index] ?? ""),
      )
  ) {
    return { displayPath, segments, targets: null };
  }
  const rootIndex =
    pathOffset === 0 &&
    segmentOffset > 0 &&
    equal(segments[segmentOffset - 1], basename(workspaceRoot))
      ? segmentOffset - 1
      : null;
  const targets = segments.map((_, index) => {
    if (index === rootIndex) return { activePath: null, directoryPath: null };
    if (index < segmentOffset) return undefined;
    const count = pathOffset + index - segmentOffset;
    return {
      activePath: paths.slice(0, count + 1).join("/"),
      directoryPath: paths.slice(0, count).join("/") || null,
    };
  });
  return { displayPath, segments, targets };
}

export function joinFileBreadcrumbPath(
  root: string,
  path: string | null,
): string {
  if (path == null) return root;
  const separator = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  return `${root.replace(/[\\/]+$/, "")}${separator}${path.replace(/\//g, separator)}`;
}

export function getSelectedBreadcrumbText(
  list: HTMLOListElement,
): string | null {
  const selection = list.ownerDocument.getSelection();
  if (selection == null || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !list.contains(range.commonAncestorContainer))
    return null;
  const items = range.cloneContents().querySelectorAll("li");
  return (
    (items.length === 0
      ? range.toString()
      : Array.from(items, (item) => item.textContent ?? "")
          .filter(Boolean)
          .join("/")) || null
  );
}
