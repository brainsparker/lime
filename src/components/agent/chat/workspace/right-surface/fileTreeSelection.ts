export interface FileTreeSelection {
  paths: ReadonlySet<string>;
  anchor: string | null;
}

export type FileTreeSelectionAction =
  | { kind: "single"; path: string }
  | { kind: "toggle"; path: string }
  | { kind: "range"; path: string; additive: boolean }
  | { kind: "extend"; from: string; to: string }
  | { kind: "all"; focusedPath: string | null };

export function createFileTreeSelection(
  path: string | null,
): FileTreeSelection {
  return { paths: new Set(path ? [path] : []), anchor: path };
}

/** 只投影可见树的选择交互；文件读取、预览与展开仍由原 owner 持有。 */
export function selectFileTreePaths(
  selection: FileTreeSelection,
  visiblePaths: readonly string[],
  action: FileTreeSelectionAction,
): FileTreeSelection {
  if (action.kind === "all") {
    return {
      paths: new Set(visiblePaths),
      anchor: action.focusedPath ?? selection.anchor,
    };
  }
  if (action.kind === "extend") {
    if (!visiblePaths.includes(action.to)) return selection;
    const paths = new Set(selection.paths);
    if (paths.has(action.from) && paths.has(action.to))
      paths.delete(action.from);
    else paths.add(action.to);
    return { paths, anchor: selection.anchor ?? action.from };
  }
  const index = visiblePaths.indexOf(action.path);
  if (index < 0) return selection;
  if (action.kind === "single") return createFileTreeSelection(action.path);
  const paths = new Set(selection.paths);
  if (action.kind === "toggle") {
    if (paths.has(action.path)) paths.delete(action.path);
    else paths.add(action.path);
    return { paths, anchor: action.path };
  }
  const anchorIndex =
    selection.anchor === null ? -1 : visiblePaths.indexOf(selection.anchor);
  if (anchorIndex < 0) {
    return {
      paths: action.additive ? paths.add(action.path) : new Set([action.path]),
      anchor: action.path,
    };
  }
  const range = visiblePaths.slice(
    Math.min(anchorIndex, index),
    Math.max(anchorIndex, index) + 1,
  );
  return {
    paths: new Set(action.additive ? [...paths, ...range] : range),
    anchor: selection.anchor,
  };
}
