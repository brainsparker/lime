import type { ReactNode } from "react";
import type {
  RightSurfaceDefinition,
  WorkspaceRightSurfaceKind,
} from "./rightSurfaceTypes";

interface RightSurfaceHostProps {
  activeSurface: WorkspaceRightSurfaceKind | null;
  definitions: readonly RightSurfaceDefinition[];
  idPrefix: string;
}

/** Pane only. 标签由同一份 projection 交给共享 UnifiedTabStrip。 */
export function RightSurfaceHost({
  activeSurface,
  definitions,
  idPrefix,
}: RightSurfaceHostProps): ReactNode {
  const definition = definitions.find((item) => item.kind === activeSurface);
  if (!activeSurface || !definition) return null;
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-testid="workspace-right-surface-host"
      data-surface={activeSurface}
    >
      <div
        id={`${idPrefix}-panel`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${activeSurface}`}
        className="min-h-0 flex-1 w-full overflow-hidden"
        data-testid="workspace-right-surface-active-pane"
      >
        {definition.render({ activeSurface })}
      </div>
    </div>
  );
}
