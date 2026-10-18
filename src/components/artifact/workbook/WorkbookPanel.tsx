import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { isAbsoluteLocalFilePath } from "@/lib/api/fileSystem";
import { loadWorkbookDocument } from "./loadWorkbookDocument";
import { WorkbookImportError, type WorkbookSnapshot } from "./workbookSnapshot";
import { WorkbookGrid } from "./WorkbookGrid";
import { useArtifactAnnotations } from "../annotations/useArtifactAnnotations";
import {
  ArtifactAnnotationControls,
  ArtifactAnnotationAccessory,
} from "../annotations/ArtifactAnnotations";
import { parseCellRange, rangeAddress, type CellRange } from "./workbookRange";
import { resolveWorkbookSourceFormat } from "./workbookSnapshot";
import { useWorkbookController } from "./useWorkbookController";
import { WorkbookEditingControls } from "./WorkbookEditingControls";

type State =
  | { status: "loading" }
  | { status: "error"; tooLarge: boolean }
  | { status: "ready"; snapshot: WorkbookSnapshot };

export function WorkbookPanel({
  path,
  title,
  previewRequestKey,
}: {
  path: string;
  title: string;
  previewRequestKey?: string;
}) {
  const { t } = useTranslation("workspace");
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const selection = useRef<CellRange>({
    start: { row: 1, column: 1 },
    end: { row: 1, column: 1 },
  });
  const [navigationCommand, setNavigationCommand] = useState<{
    sheetId: string;
    request: string;
    range: CellRange;
  }>();
  const [targetMissing, setTargetMissing] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const identity = JSON.stringify([path, previewRequestKey]);
  const [loadedIdentity, setLoadedIdentity] = useState(identity);
  const visible: State =
    identity === loadedIdentity ? state : { status: "loading" };
  useEffect(() => {
    let current = true;
    setLoadedIdentity(identity);
    setState({ status: "loading" });
    setNavigationCommand(undefined);
    setTargetMissing(false);
    if (!isAbsoluteLocalFilePath(path)) {
      setState({ status: "error", tooLarge: false });
      return;
    }
    const task = loadWorkbookDocument(path);
    void task.promise.then(
      (snapshot) => {
        if (current) setState({ status: "ready", snapshot });
      },
      (error: unknown) => {
        if (current)
          setState({
            status: "error",
            tooLarge:
              error instanceof WorkbookImportError &&
              error.reason === "tooLarge",
          });
      },
    );
    return () => {
      current = false;
      task.destroy();
    };
  }, [identity, path, attempt]);
  const { controller, state: editingState } = useWorkbookController(
    path,
    visible.status === "ready" ? visible.snapshot : undefined,
  );
  const document =
    visible.status === "ready"
      ? (editingState?.document ?? visible.snapshot)
      : undefined;
  const sheetIndex = Math.max(
    0,
    document?.sheets.findIndex(
      (sheet) => sheet.id === editingState?.activeSheetId,
    ) ?? 0,
  );
  const sheet =
    visible.status === "ready" ? document?.sheets[sheetIndex] : undefined;
  const annotations = useArtifactAnnotations({
    path,
    format: "workbook",
    previewRequestKey,
    sourceSha256: document?.sourceSha256,
    reload: () => setAttempt((value) => value + 1),
    navigateToComment: (comment) => {
      if (comment.format !== "workbook" || !document) return;
      const index = document.sheets.findIndex(
        (item) =>
          item.id === comment.sheetId && item.name === comment.sheetName,
      );
      const range = parseCellRange(comment.address);
      const target = document.sheets[index];
      if (
        !range ||
        !target ||
        range.end.row > target.rowCount ||
        range.end.column > target.columnCount ||
        target.rowHeights[range.start.row] === 0 ||
        target.columnWidths[range.start.column] === 0
      ) {
        setTargetMissing(true);
        return;
      }
      setTargetMissing(false);
      controller?.setActiveSheetName(target.name);
      setNavigationCommand({
        sheetId: target.id,
        request: crypto.randomUUID(),
        range,
      });
    },
  });
  return (
    <section
      aria-label={title}
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          void controller?.flushPublicFile();
        }
      }}
      data-testid="workbook-preview-panel"
      data-status={visible.status}
      data-source-sha256={document?.sourceSha256}
      data-preview-request={previewRequestKey}
      className="relative flex h-full min-h-[240px] min-w-0 flex-col bg-background text-foreground"
    >
      {visible.status === "loading" ? (
        <div
          role="status"
          className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          {t("workspace.workbookPreview.loading")}
        </div>
      ) : visible.status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-sm">
          <p role="alert">
            {t(
              `workspace.workbookPreview.${visible.tooLarge ? "tooLarge" : "failed"}`,
            )}
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw className="h-4 w-4" />
            {t("workspace.pdfPreview.retry")}
          </button>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 shrink-0 flex-col gap-1 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate" title={title}>
                {title}
              </span>
              <ArtifactAnnotationControls
                annotations={annotations}
                onAdd={() => {
                  const sourceFormat = resolveWorkbookSourceFormat(path);
                  if (
                    !document ||
                    !sheet ||
                    !sourceFormat ||
                    !controller?.flushEdits()
                  )
                    return;
                  annotations.annotate({
                    format: "workbook",
                    sourceFormat,
                    path,
                    id: crypto.randomUUID(),
                    sourceSha256: document.sourceSha256,
                    sheetId: sheet.id,
                    sheetName: sheet.name,
                    address: rangeAddress(selection.current),
                  });
                }}
              />
            </div>
            {controller && editingState && (
              <WorkbookEditingControls
                controller={controller}
                state={editingState}
                onDiscard={() => setAttempt((value) => value + 1)}
              />
            )}
          </div>
          {targetMissing && (
            <p role="alert" className="px-3 text-xs text-destructive">
              {t("workspace.workbookPreview.targetMissing")}
            </p>
          )}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {sheet && (
              <WorkbookGrid
                key={sheet.id}
                sheet={sheet}
                controller={controller}
                editor={editingState?.editor}
                onSelectionChange={(range) => {
                  selection.current = range;
                  if (sheet) controller?.setSelectionRect(sheet.id, range);
                }}
                navigationCommand={
                  navigationCommand?.sheetId === sheet.id
                    ? navigationCommand
                    : undefined
                }
              />
            )}
            <ArtifactAnnotationAccessory annotations={annotations} />
          </div>
          <div
            ref={tabsRef}
            role="tablist"
            aria-label={t("workspace.workbookPreview.sheets")}
            className="flex shrink-0 overflow-x-auto border-t border-border p-1"
          >
            {document?.sheets.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === sheetIndex}
                tabIndex={index === sheetIndex ? 0 : -1}
                className={`shrink-0 rounded px-3 py-1.5 text-xs ${index === sheetIndex ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => {
                  controller?.setActiveSheetName(item.name);
                }}
                onKeyDown={(event) => {
                  const total = document.sheets.length;
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % total
                      : event.key === "ArrowLeft"
                        ? (index + total - 1) % total
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? total - 1
                            : null;
                  if (next === null) return;
                  event.preventDefault();
                  if (!controller?.flushEdits()) return;
                  controller?.setActiveSheetName(document.sheets[next].name);
                  const tabs =
                    tabsRef.current?.querySelectorAll<HTMLButtonElement>(
                      "button",
                    );
                  tabs?.item(next).focus();
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
