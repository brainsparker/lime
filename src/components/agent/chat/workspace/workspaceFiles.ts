export function uniqueWorkspaceFilePaths(paths: readonly string[]): string[] {
  const unique: string[] = [];
  for (const path of paths) {
    const trimmed = path.trim();
    if (trimmed && !unique.includes(trimmed)) {
      unique.push(trimmed);
    }
  }
  return unique;
}

export function selectWorkspaceFileChangePaths(
  threadItems: readonly { type: string; paths?: readonly string[] }[] = [],
): string[] {
  return uniqueWorkspaceFilePaths(
    threadItems.flatMap((item) =>
      item.type === "patch" ? [...(item.paths ?? [])] : [],
    ),
  );
}

export function isWorkspaceFilesSurfaceAvailable(input: {
  targetRelativePath?: string | null;
  threadItems?: readonly { type: string; paths?: readonly string[] }[];
  projectRootPath?: string | null;
}): boolean {
  return (
    Boolean(input.targetRelativePath?.trim()) ||
    Boolean(input.projectRootPath?.trim()) ||
    selectWorkspaceFileChangePaths(input.threadItems).length > 0
  );
}
