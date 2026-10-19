import {
  Fragment,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useFileTabLifecycle } from "../text-file-editor/fileTabLifecycleContext";
import type { ThreadSidePanelTab } from "./threadSidePanelTabs";
import {
  getFileTreeContextMenuItems,
  getFileContentContextMenuItems,
  getFileTreeContextMenuPath,
  getWorkspaceFileTabContextMenuItems,
} from "./workspaceFileContextMenuItems";
import { useWorkspaceFileActions } from "./useWorkspaceFileActions";
import { hasDesktopHostInvokeCapability } from "@/lib/desktop-runtime";
import { prefetchOpenInTargets, useTargetApps } from "@/lib/openInTargets";
import type { OpenInParams } from "@/lib/api/openInTypes";
import type { OpenInTarget } from "@/lib/api/openInTypes";

type Target = {
  path: string;
  scope: string | ThreadSidePanelTab;
  origin: HTMLElement | null;
};

const MENU_SURFACE =
  "border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] text-[color:var(--lime-text)] dark:bg-[color:var(--lime-surface)]";

export function WorkspaceFileContextMenu({
  scope,
  filePath,
  cwd,
  hostId,
  openMode = "file",
  children,
}: {
  scope: string | ThreadSidePanelTab;
  filePath?: string | null;
  openMode?: "file" | "workspace";
  children: ReactElement;
} & Pick<OpenInParams, "cwd" | "hostId">) {
  const { t } = useTranslation("workspace");
  const lifecycle = useFileTabLifecycle();
  const [target, setTarget] = useState<Target | null>(null);
  const currentTarget = useRef(target);
  currentTarget.current = target;
  const actionScope = useMemo(
    () => ({ scope, target, cwd, hostId, openMode }),
    [scope, target, cwd, hostId, openMode],
  );
  const isCurrent = () =>
    target != null &&
    target.scope === scope &&
    currentTarget.current === target &&
    (typeof scope === "string" || (lifecycle?.isTabCurrent(scope) ?? true));
  const actions = useWorkspaceFileActions(
    actionScope,
    target?.path ?? null,
    isCurrent,
    { cwd, hostId, openMode },
  );
  const native = hasDesktopHostInvokeCapability();
  const apps = useTargetApps(
    { cwd, hostId, path: target?.path },
    native && isCurrent(),
  );
  const localizeTarget = (entry: OpenInTarget): OpenInTarget => ({
    ...entry,
    label:
      entry.id === "systemDefault"
        ? t("workspace.fileActions.defaultApp")
        : entry.label === "File Manager"
          ? t("workspace.fileActions.fileManager")
          : entry.label,
  });
  const targetActions = {
    primaryTarget: apps.primaryTarget
      ? localizeTarget(apps.primaryTarget)
      : null,
    visibleTargets: apps.visibleTargets.map(localizeTarget),
    revealTarget: apps.data?.targets
      .filter(
        (entry) =>
          entry.target === "fileManager" &&
          entry.available &&
          apps.data?.availableTargets.includes(entry.id),
      )
      .map(localizeTarget)[0],
    loading: apps.isPending,
  };
  const fileActions =
    openMode === "workspace" ? { ...actions, canSaveAs: false } : actions;
  const contentMenu = typeof scope !== "string" || filePath != null;
  const items =
    !isCurrent() || (native && contentMenu && apps.isPending)
      ? []
      : typeof scope === "string"
        ? (filePath != null
            ? getFileContentContextMenuItems
            : getFileTreeContextMenuItems)(
            fileActions,
            native ? targetActions : undefined,
          )
        : getWorkspaceFileTabContextMenuItems(
            fileActions,
            native ? targetActions : undefined,
          );
  const pathFromEvent = (event: Event) =>
    filePath != null
      ? filePath
      : typeof scope === "string"
        ? getFileTreeContextMenuPath(event)
        : filePath || null;
  const openFromEvent = (event: ReactMouseEvent<HTMLElement>) => {
    const path = pathFromEvent(event.nativeEvent);
    if (!path) {
      event.preventDefault();
      return;
    }
    const origin =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            '[role="treeitem"], [role="tab"], button',
          )
        : null;
    setTarget({ path, scope, origin });
  };
  const prefetch = (event: { nativeEvent: Event }) => {
    const path = pathFromEvent(event.nativeEvent);
    if (native && path) void prefetchOpenInTargets({ cwd, hostId, path });
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey))
      return;
    if (!pathFromEvent(event.nativeEvent)) return;
    event.preventDefault();
    event.stopPropagation();
    const element =
      event.target instanceof HTMLElement ? event.target : event.currentTarget;
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left,
        clientY: rect.bottom,
      }),
    );
  };
  return (
    <ContextMenu
      key={
        typeof scope === "string"
          ? scope
          : (scope.contentInstance ?? scope.tabId)
      }
    >
      <ContextMenuTrigger
        asChild
        onContextMenu={openFromEvent}
        onKeyDown={keyboard}
        onPointerOver={prefetch}
        onFocus={prefetch}
      >
        {children}
      </ContextMenuTrigger>
      {items.length ? (
        <ContextMenuContent
          data-testid="workspace-file-context-menu"
          data-file-path={target?.path}
          aria-label={target?.path}
          className={MENU_SURFACE}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (isCurrent() && target?.origin?.isConnected)
              target.origin.focus();
          }}
        >
          {items.map((item) => (
            <Fragment key={item.id}>
              {item.separatorBefore ? <ContextMenuSeparator /> : null}
              {item.children ? (
                <ContextMenuSub key={item.id}>
                  <ContextMenuSubTrigger
                    data-testid={`workspace-file-menu-${item.id}`}
                    disabled={item.disabled}
                  >
                    {t(item.labelKey)}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className={MENU_SURFACE}>
                    {item.children.map((child) => (
                      <ContextMenuItem
                        key={child.id}
                        disabled={child.disabled}
                        onSelect={() => {
                          void child.onSelect();
                        }}
                      >
                        {child.icon ? (
                          <img
                            src={child.icon}
                            className="me-2 size-4"
                            alt=""
                          />
                        ) : null}
                        {child.label ?? t(child.labelKey, child.labelArgs)}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              ) : (
                <ContextMenuItem
                  key={item.id}
                  data-testid={`workspace-file-menu-${item.id}`}
                  disabled={item.disabled}
                  onSelect={() => {
                    void item.onSelect();
                  }}
                >
                  {item.icon ? (
                    <img src={item.icon} className="me-2 size-4" alt="" />
                  ) : null}
                  {item.label ?? t(item.labelKey, item.labelArgs)}
                </ContextMenuItem>
              )}
            </Fragment>
          ))}
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
