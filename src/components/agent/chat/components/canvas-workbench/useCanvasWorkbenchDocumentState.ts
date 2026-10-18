import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Artifact } from "@/lib/artifact/types";
import { isAbsoluteLocalFilePath } from "@/lib/api/fileSystem";
import { usePublicFileAction } from "@/components/artifact/usePublicFileAction";
import type { CanvasStateUnion } from "@/components/workspace/canvas/canvasUtils";
import type { HarnessFilePreviewResult } from "../HarnessStatusPanel";
import type { TaskFile } from "../TaskFiles";
import {
  buildDefaultPreviewSelection,
  buildEntries,
  resolveSavedContentBundleRoot,
  resolveSelectionContext,
  resolveWorkspacePanelDisplayPath,
  type CanvasWorkbenchCopy,
  type CanvasWorkbenchResolvedSelection,
} from "../CanvasWorkbenchLayoutViewModel";
import {
  isCanvasWorkbenchPreviewMode,
  resolveCanvasWorkbenchPreferredPreviewModeFromPath,
  resolveCanvasWorkbenchPreviewModeState,
  type CanvasWorkbenchPreviewMode,
  type CanvasWorkbenchPreviewModeState,
} from "./CanvasWorkbenchPreviewModeViewModel";
import {
  resolveCanvasWorkbenchToolTabKind,
  resolveInitialCanvasWorkbenchTab,
  type CanvasWorkbenchDefaultPreview,
  type CanvasWorkbenchTab,
} from "./CanvasWorkbenchLayoutState";
import { useCanvasWorkbenchFileTreeState } from "./files/useCanvasWorkbenchFileTreeState";
import type { CanvasWorkbenchChangeView } from "./changes/CanvasWorkbenchChangesPanelViewModel";
import { resolveAbsoluteWorkspacePath } from "../../workspace/workspacePath";

type CanvasWorkbenchTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

interface UseCanvasWorkbenchDocumentStateParams {
  artifacts: Artifact[];
  canvasState: CanvasStateUnion | null;
  taskFiles: TaskFile[];
  selectedFileId?: string;
  workspaceRoot?: string | null;
  workspaceUnavailable: boolean;
  defaultPreview: CanvasWorkbenchDefaultPreview | null;
  loadFilePreview: (path: string) => Promise<HarnessFilePreviewResult>;
  workbenchCopy: CanvasWorkbenchCopy;
  translateWorkbench: CanvasWorkbenchTranslation;
  hasDefaultPreviewContent: boolean;
  hasCustomSessionView: boolean;
  hasCustomOutputView: boolean;
  isCodingWorkbench: boolean;
  changeView?: CanvasWorkbenchChangeView | null;
  previewRequestIdentity?: string | null;
}

interface UseCanvasWorkbenchDocumentStateResult {
  activeTab: CanvasWorkbenchTab;
  applyActiveTab: Dispatch<SetStateAction<CanvasWorkbenchTab>>;
  activePreviewContext: CanvasWorkbenchResolvedSelection | null;
  documentContext: CanvasWorkbenchResolvedSelection | null;
  documentSelectionKey: string | null;
  documentTransitionPending: boolean;
  previewModeState: CanvasWorkbenchPreviewModeState;
  projectFilesPreviewMode: CanvasWorkbenchPreviewMode;
  applyProjectFilesPreviewMode: Dispatch<
    SetStateAction<CanvasWorkbenchPreviewMode>
  >;
  sessionContext: CanvasWorkbenchResolvedSelection | null;
  workspacePanelRootPath: string | null;
  workspacePanelDisplayPath?: string;
  directoryCache: ReturnType<
    typeof useCanvasWorkbenchFileTreeState
  >["directoryCache"];
  expandedDirectories: ReturnType<
    typeof useCanvasWorkbenchFileTreeState
  >["expandedDirectories"];
  loadingDirectories: ReturnType<
    typeof useCanvasWorkbenchFileTreeState
  >["loadingDirectories"];
  toggleDirectory: ReturnType<
    typeof useCanvasWorkbenchFileTreeState
  >["toggleDirectory"];
  refreshDirectorySubtree: ReturnType<
    typeof useCanvasWorkbenchFileTreeState
  >["refreshDirectorySubtree"];
  fileAction: ReturnType<typeof usePublicFileAction>;
  publicFilePath: string | null;
  resolveDocumentSelection: (
    selectionKey: string,
  ) => CanvasWorkbenchResolvedSelection | null;
  applyDocumentSelection: (
    selectionKey: string,
  ) => CanvasWorkbenchResolvedSelection | null;
  handleSelectWorkspaceFile: (path: string) => Promise<void>;
}

function resolvePublicFilePath(
  context: CanvasWorkbenchResolvedSelection | null,
  workspaceRoot?: string | null,
): string | null {
  const target = context?.target;
  const path = resolveAbsoluteWorkspacePath(
    workspaceRoot,
    target && target.kind !== "empty"
      ? target.absolutePath || target.filePath || context?.selectionPath
      : context?.selectionPath,
  );
  return path && isAbsoluteLocalFilePath(path) ? path : null;
}

function selectionIdentity(
  context: CanvasWorkbenchResolvedSelection | null,
  workspaceRoot?: string | null,
): string {
  return JSON.stringify([
    context?.selectionKey,
    resolvePublicFilePath(context, workspaceRoot),
  ]);
}

export function useCanvasWorkbenchDocumentState({
  artifacts,
  canvasState,
  taskFiles,
  selectedFileId,
  workspaceRoot,
  workspaceUnavailable,
  defaultPreview,
  loadFilePreview,
  workbenchCopy,
  translateWorkbench,
  hasDefaultPreviewContent,
  hasCustomSessionView,
  hasCustomOutputView,
  isCodingWorkbench,
  changeView,
  previewRequestIdentity = null,
}: UseCanvasWorkbenchDocumentStateParams): UseCanvasWorkbenchDocumentStateResult {
  const {
    directoryCache,
    expandedDirectories,
    loadingDirectories,
    workspaceFileSelections,
    loadDirectory,
    refreshDirectorySubtree,
    toggleDirectory,
    selectWorkspaceFile,
  } = useCanvasWorkbenchFileTreeState({
    workspaceRoot,
    loadFilePreview,
    translateWorkbench,
  });

  const entries = useMemo(
    () =>
      buildEntries(
        artifacts,
        canvasState,
        taskFiles,
        workbenchCopy,
        workspaceRoot,
      ),
    [artifacts, canvasState, taskFiles, workbenchCopy, workspaceRoot],
  );

  const entryMap = useMemo(
    () => new Map(entries.map((entry) => [entry.key, entry])),
    [entries],
  );

  const fallbackSelectionKey = useMemo(() => {
    if (
      defaultPreview?.selectionKey &&
      entryMap.has(defaultPreview.selectionKey)
    ) {
      return defaultPreview.selectionKey;
    }

    if (selectedFileId) {
      const selectedTaskKey = `task:${selectedFileId}`;
      if (entryMap.has(selectedTaskKey)) {
        return selectedTaskKey;
      }
    }

    return entries[0]?.key || null;
  }, [defaultPreview?.selectionKey, entries, entryMap, selectedFileId]);

  const initialDocumentSelectionKey =
    defaultPreview?.selectionKey || fallbackSelectionKey;
  const initialDocumentPath =
    defaultPreview?.filePath ||
    defaultPreview?.absolutePath ||
    defaultPreview?.title ||
    (initialDocumentSelectionKey
      ? entryMap.get(initialDocumentSelectionKey)?.filePath ||
        entryMap.get(initialDocumentSelectionKey)?.absolutePath ||
        entryMap.get(initialDocumentSelectionKey)?.title
      : null);
  const shouldPreferSessionTabOnMount = Boolean(
    !isCodingWorkbench &&
    (hasCustomSessionView || hasDefaultPreviewContent) &&
    !initialDocumentSelectionKey,
  );

  const workspaceKey = workspaceRoot?.trim() || "";
  const [selection, setSelection] = useState({
    workspaceKey,
    key: initialDocumentSelectionKey,
  });
  const selectedKey =
    selection.workspaceKey === workspaceKey
      ? selection.key
      : initialDocumentSelectionKey;
  const [activeTab, setActiveTab] = useState<CanvasWorkbenchTab>(() => {
    return resolveInitialCanvasWorkbenchTab(
      defaultPreview,
      changeView,
      initialDocumentPath || initialDocumentSelectionKey,
      shouldPreferSessionTabOnMount,
      isCodingWorkbench,
    );
  });
  const [projectFilesPreviewMode, setProjectFilesPreviewMode] =
    useState<CanvasWorkbenchPreviewMode>("code");

  const isKnownSelectionKey = useCallback(
    (selectionKey: string | null) => {
      if (!selectionKey) {
        return false;
      }
      if (selectionKey.startsWith("workspace-file:")) {
        return true;
      }
      return (
        entryMap.has(selectionKey) ||
        selectionKey === defaultPreview?.selectionKey
      );
    },
    [defaultPreview?.selectionKey, entryMap],
  );

  useEffect(() => {
    if (!workspaceRoot?.trim() || workspaceUnavailable) {
      return;
    }
    if (directoryCache[workspaceRoot]) {
      return;
    }
    void loadDirectory(workspaceRoot);
  }, [directoryCache, loadDirectory, workspaceRoot, workspaceUnavailable]);

  const documentSelectionKey = useMemo(() => {
    return selectedKey || fallbackSelectionKey;
  }, [fallbackSelectionKey, selectedKey]);

  const resolveDocumentSelection = useCallback(
    (selectionKey: string | null) =>
      resolveSelectionContext({
        selectionKey,
        defaultPreview,
        entryMap,
        workspaceFileSelections,
        canvasState,
        artifacts,
        copy: workbenchCopy,
        workspaceRoot,
      }),
    [
      artifacts,
      canvasState,
      defaultPreview,
      entryMap,
      workspaceFileSelections,
      workbenchCopy,
      workspaceRoot,
    ],
  );
  const projectedContext = useMemo(
    () => resolveDocumentSelection(documentSelectionKey),
    [documentSelectionKey, resolveDocumentSelection],
  );
  const selectionResolverRef = useRef(resolveDocumentSelection);
  useLayoutEffect(() => {
    selectionResolverRef.current = resolveDocumentSelection;
  }, [resolveDocumentSelection]);
  // 只保留已显示的 canonical context 身份快照，编辑稿仍归文件 controller。
  const [acceptedSelection, setAcceptedSelection] = useState({
    workspaceKey,
    context: projectedContext,
  });
  const projectedIdentity = selectionIdentity(projectedContext, workspaceRoot);
  const acceptedIdentity = selectionIdentity(
    acceptedSelection.context,
    workspaceRoot,
  );
  const sameWorkspace = acceptedSelection.workspaceKey === workspaceKey;
  const documentContext =
    !sameWorkspace ||
    (projectedIdentity === acceptedIdentity &&
      projectedContext?.target.kind !== "loading")
      ? projectedContext
      : acceptedSelection.context;

  useLayoutEffect(() => {
    if (
      !sameWorkspace ||
      (projectedIdentity === acceptedIdentity &&
        projectedContext?.target.kind !== "loading" &&
        acceptedSelection.context !== projectedContext)
    ) {
      setAcceptedSelection({ workspaceKey, context: projectedContext });
    }
  }, [
    acceptedIdentity,
    acceptedSelection.context,
    projectedContext,
    projectedIdentity,
    sameWorkspace,
    workspaceKey,
  ]);

  const sessionContext = useMemo(() => {
    if (documentContext) {
      return documentContext;
    }
    if (defaultPreview?.content.trim()) {
      return buildDefaultPreviewSelection(defaultPreview, workbenchCopy);
    }
    return null;
  }, [defaultPreview, documentContext, workbenchCopy]);

  const workspacePanelRootPath = useMemo(
    () =>
      resolveSavedContentBundleRoot(
        workspaceRoot,
        documentContext?.selectionPath || sessionContext?.selectionPath,
      ) ||
      workspaceRoot ||
      null,
    [
      documentContext?.selectionPath,
      sessionContext?.selectionPath,
      workspaceRoot,
    ],
  );

  const workspacePanelDisplayPath = useMemo(
    () =>
      resolveWorkspacePanelDisplayPath(workspaceRoot, workspacePanelRootPath),
    [workspacePanelRootPath, workspaceRoot],
  );

  const previewModeState = useMemo(
    () => resolveCanvasWorkbenchPreviewModeState(documentContext),
    [documentContext],
  );

  useEffect(() => {
    if (!workspacePanelRootPath?.trim() || workspaceUnavailable) {
      return;
    }
    if (directoryCache[workspacePanelRootPath]) {
      return;
    }
    void loadDirectory(workspacePanelRootPath);
  }, [
    directoryCache,
    loadDirectory,
    workspacePanelRootPath,
    workspaceUnavailable,
  ]);

  const canShowOutputsTab = Boolean(
    sessionContext || hasCustomSessionView || hasCustomOutputView,
  );
  const activeToolTabKind = resolveCanvasWorkbenchToolTabKind(activeTab);
  const activePreviewContext = isCanvasWorkbenchPreviewMode(activeTab)
    ? documentContext
    : activeToolTabKind === "project-files" &&
        documentSelectionKey?.startsWith("workspace-file:")
      ? documentContext
      : activeTab === "outputs" || activeTab === "logs"
        ? hasCustomSessionView
          ? null
          : sessionContext
        : null;
  const publicFilePath = resolvePublicFilePath(
    activePreviewContext,
    workspaceRoot,
  );
  const navigationScope = JSON.stringify([
    workspaceKey,
    workspaceUnavailable,
    activeTab,
    projectFilesPreviewMode,
    documentSelectionKey,
    publicFilePath,
    projectedIdentity,
    previewRequestIdentity,
  ]);
  const fileAction = usePublicFileAction(navigationScope);
  const { run: runFileAction, busy: fileActionBusy } = fileAction;

  // 原始状态事务只供已通过同一个 fileAction 的调用方使用。
  const applyDocumentSelection = useCallback(
    (selectionKey: string) => {
      const context = selectionResolverRef.current(selectionKey);
      if (context?.selectionKey !== selectionKey) return null;
      setSelection({ workspaceKey, key: selectionKey });
      setAcceptedSelection({ workspaceKey, context });
      const mode = selectionKey.startsWith("workspace-file:")
        ? resolveCanvasWorkbenchPreferredPreviewModeFromPath(
            selectionKey.slice("workspace-file:".length),
          )
        : resolveCanvasWorkbenchPreviewModeState(context).defaultMode;
      if (resolveCanvasWorkbenchToolTabKind(activeTab) === "project-files") {
        setProjectFilesPreviewMode(mode);
      } else {
        setActiveTab(mode);
      }
      return context;
    },
    [activeTab, workspaceKey],
  );
  const handleSelectWorkspaceFile = useCallback(
    async (path: string) => {
      await runFileAction(publicFilePath, async (isCurrent) => {
        await selectWorkspaceFile(path);
        if (isCurrent()) applyDocumentSelection(`workspace-file:${path}`);
      });
    },
    [
      applyDocumentSelection,
      publicFilePath,
      runFileAction,
      selectWorkspaceFile,
    ],
  );

  const attemptedFallbackRef = useRef<string | null>(null);
  useEffect(() => {
    // 显式打开请求优先；保存失败不由 busy 的变化触发无限重试。
    if (!sameWorkspace || previewRequestIdentity || fileActionBusy) return;
    const unknownSelection =
      selectedKey &&
      !isKnownSelectionKey(selectedKey) &&
      !/^(artifact|task|version):/.test(selectedKey);
    const nextSelectionKey = unknownSelection
      ? fallbackSelectionKey
      : documentSelectionKey;
    const canAcceptProjection =
      projectedIdentity !== acceptedIdentity &&
      projectedContext?.selectionKey === nextSelectionKey;
    const nextTab =
      activeTab === "outputs" && !canShowOutputsTab
        ? documentContext
          ? previewModeState.defaultMode
          : "workspace"
        : isCanvasWorkbenchPreviewMode(activeTab) &&
            !previewModeState.modes[activeTab].enabled
          ? previewModeState.defaultMode
          : activeTab;
    if (!unknownSelection && !canAcceptProjection && nextTab === activeTab) {
      attemptedFallbackRef.current = null;
      return;
    }
    const attempt = JSON.stringify([
      navigationScope,
      nextSelectionKey,
      nextTab,
    ]);
    if (attemptedFallbackRef.current === attempt) return;
    attemptedFallbackRef.current = attempt;
    void runFileAction(publicFilePath, () => {
      if (unknownSelection) {
        setSelection({ workspaceKey, key: nextSelectionKey });
      }
      if (canAcceptProjection) {
        setAcceptedSelection({ workspaceKey, context: projectedContext });
      }
      setActiveTab(nextTab);
    });
  }, [
    acceptedIdentity,
    activeTab,
    canShowOutputsTab,
    documentContext,
    documentSelectionKey,
    fallbackSelectionKey,
    fileActionBusy,
    isKnownSelectionKey,
    navigationScope,
    previewModeState,
    previewRequestIdentity,
    projectedContext,
    projectedIdentity,
    publicFilePath,
    runFileAction,
    sameWorkspace,
    selectedKey,
    workspaceKey,
  ]);

  return {
    activeTab,
    applyActiveTab: setActiveTab,
    activePreviewContext,
    documentContext,
    documentSelectionKey,
    documentTransitionPending:
      sameWorkspace && projectedIdentity !== acceptedIdentity,
    previewModeState,
    projectFilesPreviewMode,
    applyProjectFilesPreviewMode: setProjectFilesPreviewMode,
    sessionContext,
    workspacePanelRootPath,
    workspacePanelDisplayPath,
    directoryCache,
    expandedDirectories,
    loadingDirectories,
    toggleDirectory,
    refreshDirectorySubtree,
    fileAction,
    publicFilePath,
    resolveDocumentSelection,
    applyDocumentSelection,
    handleSelectWorkspaceFile,
  };
}
