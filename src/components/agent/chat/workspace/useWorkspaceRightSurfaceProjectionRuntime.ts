import { useMemo } from "react";
import type { LayoutMode } from "@/lib/workspace/workbenchContract";
import {
  resolveWorkspaceRightSurfaceState,
  type WorkspaceRightSurfaceIntent,
  type WorkspaceRightSurfaceKind,
  type WorkspaceRightSurfaceLauncherProjection,
  type WorkspaceRightSurfaceState,
} from "./right-surface";
import {
  buildWorkspaceRightSurfaceRuntimeAvailableSurfaces,
  buildWorkspaceRightSurfaceRuntimeLaunchers,
  buildWorkspaceRightSurfaceRuntimePendingIntents,
  hasWorkspaceRightSurfaceRuntimePendingSignals,
} from "./workspaceRightSurfaceRuntimeProjection";

interface UseWorkspaceRightSurfaceProjectionRuntimeParams {
  appServerPendingIntents: readonly WorkspaceRightSurfaceIntent[];
  appSurfaceAvailable: boolean;
  articleWorkspaceAvailable: boolean;
  expertInfoVisible: boolean;
  filesAvailable: boolean;
  harnessPendingCount: number;
  hasExpertInfoPanel: boolean;
  manualRightSurface: WorkspaceRightSurfaceKind | null;
  openedRightSurfaces: readonly WorkspaceRightSurfaceKind[];
  preferredServiceSkillResultFileTargetRelativePath?: string | null;
  sceneLayoutMode: LayoutMode;
  shellAvailable: boolean;
  showHarnessToggle: boolean;
  suppressHomeNavbarUtilityActions: boolean;
  traceAvailable: boolean;
}

interface UseWorkspaceRightSurfaceProjectionRuntimeResult {
  availableSurfaces: ReadonlySet<WorkspaceRightSurfaceKind>;
  rightSurfaceLaunchers: WorkspaceRightSurfaceLauncherProjection[];
  rightSurfacePendingIntents: WorkspaceRightSurfaceIntent[];
  rightSurfaceState: WorkspaceRightSurfaceState;
}

export function useWorkspaceRightSurfaceProjectionRuntime({
  appServerPendingIntents,
  appSurfaceAvailable,
  articleWorkspaceAvailable,
  expertInfoVisible,
  filesAvailable,
  harnessPendingCount,
  hasExpertInfoPanel,
  manualRightSurface,
  openedRightSurfaces,
  preferredServiceSkillResultFileTargetRelativePath,
  sceneLayoutMode,
  shellAvailable,
  showHarnessToggle,
  suppressHomeNavbarUtilityActions,
  traceAvailable,
}: UseWorkspaceRightSurfaceProjectionRuntimeParams): UseWorkspaceRightSurfaceProjectionRuntimeResult {
  const availableSurfaces = useMemo(
    () =>
      buildWorkspaceRightSurfaceRuntimeAvailableSurfaces({
        appSurfaceAvailable,
        articleWorkspaceAvailable,
        filesAvailable,
        hasExpertInfoPanel,
        shellAvailable,
        showHarnessToggle,
        suppressHomeNavbarUtilityActions,
        traceAvailable,
      }),
    [
      appSurfaceAvailable,
      articleWorkspaceAvailable,
      filesAvailable,
      hasExpertInfoPanel,
      shellAvailable,
      showHarnessToggle,
      suppressHomeNavbarUtilityActions,
      traceAvailable,
    ],
  );
  const openSurfaces = useMemo(
    () => openedRightSurfaces.filter((kind) => availableSurfaces.has(kind)),
    [availableSurfaces, openedRightSurfaces],
  );
  const selectedSurface =
    manualRightSurface && !availableSurfaces.has(manualRightSurface)
      ? (openSurfaces.at(-1) ?? null)
      : manualRightSurface;
  const rightSurfaceState = useMemo(
    () =>
      resolveWorkspaceRightSurfaceState({
        layoutMode: sceneLayoutMode,
        hasExpertInfo: hasExpertInfoPanel,
        expertInfoVisible,
        openSurfaces,
        requestedSurface: selectedSurface ?? undefined,
        source: selectedSurface ? "user" : undefined,
      }),
    [
      expertInfoVisible,
      hasExpertInfoPanel,
      selectedSurface,
      openSurfaces,
      sceneLayoutMode,
    ],
  );
  const runtimePendingIntents = useMemo(() => {
    const params = {
      createdAt: Date.now(),
      harnessPendingCount,
      preferredServiceSkillResultFileTargetRelativePath,
      showHarnessToggle,
      suppressHomeNavbarUtilityActions,
    };
    return hasWorkspaceRightSurfaceRuntimePendingSignals(params)
      ? buildWorkspaceRightSurfaceRuntimePendingIntents(params)
      : [];
  }, [
    harnessPendingCount,
    preferredServiceSkillResultFileTargetRelativePath,
    showHarnessToggle,
    suppressHomeNavbarUtilityActions,
  ]);
  const rightSurfacePendingIntents = useMemo(
    () => [...runtimePendingIntents, ...appServerPendingIntents],
    [appServerPendingIntents, runtimePendingIntents],
  );
  const rightSurfaceLaunchers = useMemo(
    () =>
      buildWorkspaceRightSurfaceRuntimeLaunchers({
        surfaceState: rightSurfaceState,
        pendingIntents: rightSurfacePendingIntents,
        filesAvailable,
        appSurfaceAvailable,
        hasExpertInfoPanel,
        articleWorkspaceAvailable,
        shellAvailable,
        showHarnessToggle,
        traceAvailable,
        suppressHomeNavbarUtilityActions,
      }),
    [
      appSurfaceAvailable,
      articleWorkspaceAvailable,
      filesAvailable,
      hasExpertInfoPanel,
      rightSurfacePendingIntents,
      rightSurfaceState,
      shellAvailable,
      showHarnessToggle,
      suppressHomeNavbarUtilityActions,
      traceAvailable,
    ],
  );

  return {
    availableSurfaces,
    rightSurfaceLaunchers,
    rightSurfacePendingIntents,
    rightSurfaceState,
  };
}
