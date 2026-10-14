import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ReviewThreadSidePanelTarget } from "./ReviewThreadSidePanelTab";
import {
  canOpenWorkspaceRightSurface,
  type WorkspaceRightSurfaceKind,
} from "./right-surface";
import type { WorkspaceArticleWorkspace } from "./workspaceArticleWorkspaceModel";
import type { WorkspacePluginSurfaceDescriptor } from "./workspacePluginSurfaceModel";
import type { WorkspaceRightSurfaceBrowserIntent } from "./workspaceRightSurfaceBrowserIntent";

export interface WorkspaceRightSurfaceOwner {
  workspaceId: string | null;
  sessionId: string | null;
  threadId: string | null;
}

interface RightSurfaceLocalState {
  owner: WorkspaceRightSurfaceOwner;
  manualRightSurface: WorkspaceRightSurfaceKind | null;
  openedRightSurfaces: readonly WorkspaceRightSurfaceKind[];
  activeFilesRightSurfaceTarget: ReviewThreadSidePanelTarget | null;
  activeArticleWorkspace: WorkspaceArticleWorkspace | null;
  rightSurfaceBrowserTitle: string | null;
  activeBrowserRightSurfaceIntent: WorkspaceRightSurfaceBrowserIntent | null;
  activePluginSurfaces: WorkspacePluginSurfaceDescriptor[];
  activePluginSurfaceContainerId: string | null;
  dismissedPluginSurfaceContainerIds: string[];
}

function emptyState(owner: WorkspaceRightSurfaceOwner): RightSurfaceLocalState {
  return {
    owner,
    manualRightSurface: null,
    openedRightSurfaces: [],
    activeFilesRightSurfaceTarget: null,
    activeArticleWorkspace: null,
    rightSurfaceBrowserTitle: null,
    activeBrowserRightSurfaceIntent: null,
    activePluginSurfaces: [],
    activePluginSurfaceContainerId: null,
    dismissedPluginSurfaceContainerIds: [],
  };
}

function ownerKey(owner: WorkspaceRightSurfaceOwner): string {
  return JSON.stringify([owner.workspaceId, owner.sessionId, owner.threadId]);
}

function stateForOwner(
  current: RightSurfaceLocalState,
  owner: WorkspaceRightSurfaceOwner,
): RightSurfaceLocalState {
  if (ownerKey(current.owner) === ownerKey(owner)) {
    return current;
  }
  const canAdopt =
    current.owner.workspaceId === owner.workspaceId &&
    (!current.owner.sessionId || current.owner.sessionId === owner.sessionId) &&
    (!current.owner.threadId || current.owner.threadId === owner.threadId);
  return canAdopt ? { ...current, owner } : emptyState(owner);
}

function appendSurface(
  current: readonly WorkspaceRightSurfaceKind[],
  kind: WorkspaceRightSurfaceKind,
): readonly WorkspaceRightSurfaceKind[] {
  return canOpenWorkspaceRightSurface(kind, "user") && !current.includes(kind)
    ? [...current, kind]
    : current;
}

export function useWorkspaceRightSurfaceLocalStateRuntime({
  workspaceId,
  sessionId,
  threadId,
}: WorkspaceRightSurfaceOwner) {
  const owner = useMemo(
    () => ({ workspaceId, sessionId, threadId }),
    [workspaceId, sessionId, threadId],
  );
  const key = ownerKey(owner);
  const ownerRef = useRef({ key, version: 0 });
  if (ownerRef.current.key !== key) {
    ownerRef.current = { key, version: ownerRef.current.version + 1 };
  }
  const version = ownerRef.current.version;
  const [stored, setStored] = useState(() => emptyState(owner));
  const state = stateForOwner(stored, owner);

  useEffect(() => {
    setStored((current) => stateForOwner(current, owner));
  }, [owner]);

  const actions = useMemo(() => {
    const update = (
      transform: (current: RightSurfaceLocalState) => RightSurfaceLocalState,
    ) => {
      if (ownerRef.current.version !== version) {
        return;
      }
      setStored((current) =>
        ownerRef.current.version === version
          ? transform(stateForOwner(current, owner))
          : current,
      );
    };
    const setter =
      <K extends Exclude<keyof RightSurfaceLocalState, "owner">>(
        field: K,
      ): Dispatch<SetStateAction<RightSurfaceLocalState[K]>> =>
      (value) => {
        update((current) => {
          const next =
            typeof value === "function"
              ? (
                  value as (
                    previous: RightSurfaceLocalState[K],
                  ) => RightSurfaceLocalState[K]
                )(current[field])
              : value;
          if (current[field] === next) {
            return current;
          }
          return {
            ...current,
            [field]: next,
            openedRightSurfaces:
              field === "manualRightSurface" && next
                ? appendSurface(
                    current.openedRightSurfaces,
                    next as WorkspaceRightSurfaceKind,
                  )
                : current.openedRightSurfaces,
          };
        });
      };
    return {
      setActiveArticleWorkspace: setter("activeArticleWorkspace"),
      setActiveBrowserRightSurfaceIntent: setter(
        "activeBrowserRightSurfaceIntent",
      ),
      setActiveFilesRightSurfaceTarget: setter("activeFilesRightSurfaceTarget"),
      setActivePluginSurfaceContainerId: setter(
        "activePluginSurfaceContainerId",
      ),
      setActivePluginSurfaces: setter("activePluginSurfaces"),
      setDismissedPluginSurfaceContainerIds: setter(
        "dismissedPluginSurfaceContainerIds",
      ),
      setManualRightSurface: setter("manualRightSurface"),
      setRightSurfaceBrowserTitle: setter("rightSurfaceBrowserTitle"),
      rememberRightSurface: (kind: WorkspaceRightSurfaceKind) =>
        update((current) => {
          const opened = appendSurface(current.openedRightSurfaces, kind);
          return opened === current.openedRightSurfaces
            ? current
            : { ...current, openedRightSurfaces: opened };
        }),
      closeRightSurface: (kind: WorkspaceRightSurfaceKind) =>
        update((current) => {
          const opened = current.openedRightSurfaces.filter(
            (surface) => surface !== kind,
          );
          if (
            opened.length === current.openedRightSurfaces.length &&
            current.manualRightSurface !== kind
          ) {
            return current;
          }
          return {
            ...current,
            openedRightSurfaces: opened,
            manualRightSurface:
              current.manualRightSurface === kind
                ? (opened.at(-1) ?? null)
                : current.manualRightSurface,
          };
        }),
      pruneRightSurfaces: (available: ReadonlySet<WorkspaceRightSurfaceKind>) =>
        update((current) => {
          const opened = current.openedRightSurfaces.filter((kind) =>
            available.has(kind),
          );
          const manual = current.manualRightSurface;
          if (
            opened.length === current.openedRightSurfaces.length &&
            (!manual || available.has(manual))
          ) {
            return current;
          }
          return {
            ...current,
            openedRightSurfaces: opened,
            manualRightSurface:
              manual && !available.has(manual)
                ? (opened.at(-1) ?? null)
                : manual,
          };
        }),
      clearActiveRightSurfaceTargets: () =>
        update((current) => ({
          ...current,
          manualRightSurface: null,
          activeFilesRightSurfaceTarget: null,
          activeArticleWorkspace: null,
        })),
      openArticleWorkspaceRightSurface: (
        articleWorkspace: WorkspaceArticleWorkspace,
      ) =>
        update((current) => ({
          ...current,
          activeArticleWorkspace: articleWorkspace,
          manualRightSurface: "articleWorkspace",
          openedRightSurfaces: appendSurface(
            current.openedRightSurfaces,
            "articleWorkspace",
          ),
        })),
    };
  }, [owner, version]);

  return { ...state, ...actions };
}

export type WorkspaceRightSurfaceLocalStateRuntime = ReturnType<
  typeof useWorkspaceRightSurfaceLocalStateRuntime
>;
