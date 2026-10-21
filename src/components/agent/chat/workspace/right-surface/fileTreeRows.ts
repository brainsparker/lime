import type { DirectoryListing, FileEntry } from "@/lib/api/fileBrowser";
import type { ProjectFileSearchResult } from "@/lib/api/fuzzyFileSearch";
import { sortFileTreeEntries } from "../fileTreeOrder";
import { resolveAbsoluteWorkspacePath } from "../workspacePath";

type TreeEntry = Pick<FileEntry, "name" | "path" | "isDir">;
export type FileTreeRow =
  | {
      kind: "entry";
      entry: TreeEntry;
      parentPath: string;
      depth: number;
      position: number;
      setSize: number;
      loading?: boolean;
    }
  | { kind: "loading"; path: string; depth: number }
  | { kind: "error"; path: string; depth: number }
  | { kind: "empty"; path: string; depth: number };

/** 目录读取结果只投影可见行；不改变唯一目录缓存与展开 owner。 */
export function getDirectoryTreeRows(
  directoryPath: string,
  directoryCache: Readonly<Record<string, DirectoryListing>>,
  loadingDirectories: Readonly<Record<string, boolean>>,
  expandedDirectories: Readonly<Record<string, boolean>>,
): FileTreeRow[] {
  const rows: FileTreeRow[] = [];
  const visit = (path: string, depth: number) => {
    const listing = directoryCache[path];
    if (!listing) {
      if (loadingDirectories[path]) rows.push({ kind: "loading", path, depth });
      return;
    }
    if (listing.error) {
      rows.push({ kind: "error", path, depth });
      return;
    }
    if (!listing.entries.length) {
      rows.push({ kind: "empty", path, depth });
      return;
    }
    const entries = sortFileTreeEntries(listing.entries);
    entries.forEach((entry, position) => {
      rows.push({
        kind: "entry",
        entry,
        parentPath: path,
        depth,
        position,
        setSize: entries.length,
        loading: Boolean(loadingDirectories[entry.path]),
      });
      if (entry.isDir && expandedDirectories[entry.path])
        visit(entry.path, depth + 1);
    });
  };
  visit(directoryPath, 0);
  return rows;
}

interface SearchTreeEntry extends TreeEntry {
  children: Map<string, SearchTreeEntry>;
}

/** 搜索结果的目录只是视图节点，不写入真实 directoryCache。 */
export function createSearchFileTree(
  root: string,
  files: readonly ProjectFileSearchResult[],
) {
  const children = new Map<string, SearchTreeEntry>();
  const filePaths = new Set<string>();
  const expandedDirectories: Record<string, boolean> = {};
  const seen = new Set<string>();
  for (const file of files) {
    const absolutePath = resolveAbsoluteWorkspacePath(
      file.root || root,
      file.path,
    );
    if (!absolutePath) continue;
    const normalizedPath = absolutePath.replace(/\\/g, "/");
    if (seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);
    filePaths.add(absolutePath);
    const normalizedRoot = (file.root || root)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
    const withinRoot = normalizedPath.startsWith(normalizedRoot + "/");
    const relativePath = withinRoot
      ? normalizedPath.slice(normalizedRoot.length + 1)
      : normalizedPath;
    const segments = relativePath.split("/").filter(Boolean);
    let branch = children;
    let parentPath = withinRoot
      ? normalizedRoot || "/"
      : normalizedPath.startsWith("//")
        ? "//"
        : normalizedPath.startsWith("/")
          ? "/"
          : "";
    segments.forEach((name, index) => {
      const isDir = index < segments.length - 1;
      const path = parentPath
        ? `${parentPath}${parentPath.endsWith("/") ? "" : "/"}${name}`
        : name;
      let entry = branch.get(name);
      if (!entry) {
        entry = {
          name,
          path: isDir ? path : absolutePath,
          isDir,
          children: new Map(),
        };
        branch.set(name, entry);
      }
      if (isDir) expandedDirectories[path] = true;
      branch = entry.children;
      parentPath = path;
    });
  }
  return { root, children, expandedDirectories, filePaths };
}

export function getSearchFileTreeRows(
  tree: ReturnType<typeof createSearchFileTree>,
  expandedDirectories: Readonly<Record<string, boolean>>,
): FileTreeRow[] {
  const rows: FileTreeRow[] = [];
  const visit = (
    children: ReadonlyMap<string, SearchTreeEntry>,
    parentPath: string,
    depth: number,
  ) => {
    const entries = sortFileTreeEntries([...children.values()]);
    entries.forEach((original, position) => {
      let entry = original;
      let name = entry.name;
      // 与上游 flattenEmptyDirectories 一致，只合并无文件分支的单目录链。
      while (entry.isDir && entry.children.size === 1) {
        const child = entry.children.values().next().value;
        if (!child?.isDir) break;
        name += `/${child.name}`;
        entry = child;
      }
      rows.push({
        kind: "entry",
        entry: { name, path: entry.path, isDir: entry.isDir },
        parentPath,
        depth,
        position,
        setSize: entries.length,
      });
      if (entry.isDir && expandedDirectories[entry.path])
        visit(entry.children, entry.path, depth + 1);
    });
  };
  visit(tree.children, tree.root, 0);
  return rows;
}
