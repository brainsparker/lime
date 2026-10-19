import type { OpenInTarget } from "@/lib/api/openInTypes";

export interface WorkspaceFileMenuActions {
  canSaveAs: boolean;
  busy: boolean;
  copyPath(): Promise<void>;
  saveAs(): Promise<void>;
  openTarget(target: OpenInTarget): Promise<void>;
}

export interface WorkspaceFileMenuItem {
  id: string;
  labelKey: string;
  label?: string;
  labelArgs?: { app: string };
  icon?: string | null;
  children?: WorkspaceFileMenuItem[];
  separatorBefore?: boolean;
  disabled: boolean;
  onSelect(): Promise<void>;
}

export interface WorkspaceFileTargets {
  primaryTarget: OpenInTarget | null;
  visibleTargets: OpenInTarget[];
  revealTarget?: OpenInTarget;
  loading: boolean;
}

function targetItems(
  actions: WorkspaceFileMenuActions,
  apps?: WorkspaceFileTargets,
): WorkspaceFileMenuItem[] {
  if (!apps) return [];
  if (apps.loading && !apps.primaryTarget)
    return [
      {
        id: "loading-targets",
        labelKey: "workspace.fileActions.openInLoading",
        disabled: true,
        onSelect: async () => {},
      },
    ];
  const primary = apps.primaryTarget;
  if (!primary) return [];
  const item = (target: OpenInTarget): WorkspaceFileMenuItem => ({
    id: `open:${target.id}`,
    labelKey:
      target.target === "fileManager"
        ? "workspace.fileActions.revealIn"
        : "workspace.fileActions.openIn",
    labelArgs: { app: target.label },
    icon: target.icon,
    disabled: actions.busy,
    onSelect: () => actions.openTarget(target),
  });
  return [
    item(primary),
    {
      id: "open-with",
      labelKey: "workspace.fileActions.openWith",
      disabled: actions.busy,
      children: apps.visibleTargets.map((target) => ({
        ...item(target),
        label: target.label,
      })),
      onSelect: async () => {},
    },
  ];
}

function localFileItems(
  actions: WorkspaceFileMenuActions,
  apps?: WorkspaceFileTargets,
): WorkspaceFileMenuItem[] {
  const items = targetItems(actions, apps);
  if (actions.canSaveAs)
    items.push({
      id: "save-as",
      separatorBefore: items.length > 0,
      labelKey: "workspace.artifactPreviewHeader.saveAs",
      disabled: actions.busy,
      onSelect: actions.saveAs,
    });
  items.push({
    id: "copy-path",
    separatorBefore: !actions.canSaveAs && items.length > 0,
    labelKey: "workspace.fileActions.copyPath",
    disabled: actions.busy,
    onSelect: actions.copyPath,
  });
  return items;
}

export function getWorkspaceFileTabContextMenuItems(
  actions: WorkspaceFileMenuActions,
  apps?: WorkspaceFileTargets,
) {
  return getFileContentContextMenuItems(actions, apps);
}

export function getFileTreeContextMenuItems(
  actions: WorkspaceFileMenuActions,
  apps?: WorkspaceFileTargets,
) {
  return localFileItems(actions, apps);
}

export function getFileContentContextMenuItems(
  actions: WorkspaceFileMenuActions,
  apps?: WorkspaceFileTargets,
) {
  const items = localFileItems(actions, apps);
  const reveal = apps?.revealTarget;
  if (reveal)
    items.push({
      id: "reveal-path",
      labelKey: "workspace.fileActions.revealIn",
      labelArgs: { app: reveal.label },
      disabled: actions.busy,
      onSelect: () => actions.openTarget(reveal),
    });
  return items;
}

/** 只接受实际file行的操作path，不取flatten显示文案或目录节点。 */
export function getFileTreeContextMenuPath(event: Event): string | null {
  for (const target of event.composedPath()) {
    if (
      !(target instanceof Element) ||
      target.getAttribute("data-item-type") !== "file"
    )
      continue;
    const path = target.getAttribute("data-item-path");
    if (path) return path;
  }
  return null;
}
