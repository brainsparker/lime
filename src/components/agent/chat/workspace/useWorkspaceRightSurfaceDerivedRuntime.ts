import type { ReviewThreadSidePanelTarget } from "./ReviewThreadSidePanelTab";
import { isWorkspaceFilesSurfaceAvailable } from "./workspaceFiles";
import type { WorkspacePluginSurfaceDescriptor } from "./workspacePluginSurfaceModel";
import { selectWorkspacePluginSurfaceDescriptor } from "./workspacePluginSurfaceModel";
import type { WorkspaceRightSurfaceBrowserIntent } from "./workspaceRightSurfaceBrowserIntent";

interface UseWorkspaceRightSurfaceDerivedRuntimeParams {
  activeBrowserRightSurfaceIntent: WorkspaceRightSurfaceBrowserIntent | null;
  activeFilesRightSurfaceTarget: ReviewThreadSidePanelTarget | null;
  activePluginSurfaceContainerId: string | null;
  activePluginSurfaces: WorkspacePluginSurfaceDescriptor[];
  pendingBrowserRightSurfaceIntent: WorkspaceRightSurfaceBrowserIntent | null;
  pendingFileTarget: ReviewThreadSidePanelTarget | null;
  pendingPluginSurfaces: WorkspacePluginSurfaceDescriptor[];
  preferredServiceSkillResultFileTarget: ReviewThreadSidePanelTarget | null;
  projectRootPath?: string | null;
  threadItems?: readonly { type: string; paths?: readonly string[] }[];
}

interface UseWorkspaceRightSurfaceDerivedRuntimeResult {
  browserRightSurfaceAvailable: boolean;
  browserRightSurfaceIntent: WorkspaceRightSurfaceBrowserIntent | null;
  filesRightSurfaceAvailable: boolean;
  filesRightSurfaceTarget: ReviewThreadSidePanelTarget | null;
  pluginSurfaceRightSurface: WorkspacePluginSurfaceDescriptor | null;
  pluginSurfaceRightSurfaceAvailable: boolean;
  pluginSurfaceRightSurfaces: WorkspacePluginSurfaceDescriptor[];
}

export function useWorkspaceRightSurfaceDerivedRuntime({
  activeBrowserRightSurfaceIntent,
  activeFilesRightSurfaceTarget,
  activePluginSurfaceContainerId,
  activePluginSurfaces,
  pendingBrowserRightSurfaceIntent,
  pendingFileTarget,
  pendingPluginSurfaces,
  preferredServiceSkillResultFileTarget,
  projectRootPath,
  threadItems,
}: UseWorkspaceRightSurfaceDerivedRuntimeParams): UseWorkspaceRightSurfaceDerivedRuntimeResult {
  const browserRightSurfaceAvailable = true;
  const browserRightSurfaceIntent =
    activeBrowserRightSurfaceIntent ?? pendingBrowserRightSurfaceIntent;
  const liveFilesRightSurfaceTarget: ReviewThreadSidePanelTarget | null =
    preferredServiceSkillResultFileTarget ?? pendingFileTarget;
  const pluginSurfaceRightSurfaces =
    activePluginSurfaces.length > 0
      ? activePluginSurfaces
      : pendingPluginSurfaces;
  const pluginSurfaceRightSurface = selectWorkspacePluginSurfaceDescriptor(
    pluginSurfaceRightSurfaces,
    activePluginSurfaceContainerId,
  );
  const pluginSurfaceRightSurfaceAvailable =
    pluginSurfaceRightSurfaces.length > 0;
  const filesRightSurfaceTarget: ReviewThreadSidePanelTarget | null =
    activeFilesRightSurfaceTarget ?? liveFilesRightSurfaceTarget;
  const filesRightSurfaceAvailable = isWorkspaceFilesSurfaceAvailable({
    targetRelativePath: filesRightSurfaceTarget?.relativePath,
    threadItems,
    projectRootPath,
  });
  return {
    browserRightSurfaceAvailable,
    browserRightSurfaceIntent,
    filesRightSurfaceAvailable,
    filesRightSurfaceTarget,
    pluginSurfaceRightSurface,
    pluginSurfaceRightSurfaceAvailable,
    pluginSurfaceRightSurfaces,
  };
}
