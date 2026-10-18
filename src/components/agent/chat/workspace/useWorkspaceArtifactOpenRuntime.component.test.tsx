import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFilePreview } from "@/lib/api/fileBrowser";
import { readCanonicalThreadItem } from "@/lib/api/agentRuntime/appServerCanonicalItemReader";
import type { Artifact } from "@/lib/artifact/types";
import type { AgentThreadItem } from "../types";
import { resolveTimelineArtifactNavigation } from "../utils/artifactTimelineNavigation";
import {
  useWorkspaceArtifactOpenRuntime,
  type UseWorkspaceArtifactOpenRuntimeParams,
} from "./useWorkspaceArtifactOpenRuntime";

vi.mock("@/lib/api/fileBrowser", () => ({ readFilePreview: vi.fn() }));
vi.mock("../hooks/useArtifactAutoPreviewSync", () => ({
  useArtifactAutoPreviewSync: vi.fn(),
}));
vi.mock("./useWorkspaceArtifactDocumentSaveRuntime", () => ({
  useWorkspaceArtifactDocumentSaveRuntime: () => vi.fn(),
}));
vi.mock("./useWorkspaceArtifactWorkbenchActions", () => ({
  useWorkspaceArtifactWorkbenchActions: () => ({
    renderToolbarActions: vi.fn(),
  }),
}));

let root: Root;
let container: HTMLDivElement;
let runtime: ReturnType<typeof useWorkspaceArtifactOpenRuntime>;

function mount(overrides: Partial<UseWorkspaceArtifactOpenRuntimeParams> = {}) {
  const params: UseWorkspaceArtifactOpenRuntimeParams = {
    activeTheme: "general",
    artifacts: [],
    currentCanvasArtifact: null,
    effectiveThreadItems: [],
    generalCanvasState: { isOpen: false, contentType: "empty", content: "" },
    handleWriteFile: vi.fn(),
    isInitialContentLoading: false,
    isThemeWorkbench: false,
    layoutMode: "chat",
    mappedTheme: "general",
    messages: [],
    openArticleWorkspaceRightSurface: vi.fn(),
    projectRootPath: "/workspace",
    readSessionFile: vi.fn(async () => null),
    sessionFiles: [],
    setArtifactViewMode: vi.fn(),
    setCanvasState: vi.fn(),
    setCanvasWorkbenchLayoutMode: vi.fn(),
    setExpertInfoPanelCollapsed: vi.fn(),
    setGeneralCanvasState: vi.fn(),
    setHarnessPanelVisible: vi.fn(),
    setLayoutMode: vi.fn(),
    setSelectedArtifactId: vi.fn(),
    setSelectedFileId: vi.fn(),
    setTaskFiles: vi.fn(),
    syncGeneralArtifactToResource: vi.fn(),
    taskFiles: [],
    updateCurrentImageWorkbenchState: vi.fn(),
    upsertGeneralArtifact: vi.fn(),
    workbenchRequests: {
      clearFocusedArtifactBlock: vi.fn(),
      focusArtifactBlock: vi.fn(),
      requestCanvasWorkbenchPreviewOpen: vi.fn(),
    } as unknown as UseWorkspaceArtifactOpenRuntimeParams["workbenchRequests"],
    ...overrides,
  };
  function Probe() {
    runtime = useWorkspaceArtifactOpenRuntime(params);
    return null;
  }
  act(() => root.render(<Probe />));
  return params;
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(readFilePreview).mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Workspace 文件重新打开", () => {
  it.each(["pdf", "docx", "xlsx", "csv", "tsv", "pptx"])(
    "canonical 导入历史 %s 经时间线打开时保留原文件路径",
    async (extension) => {
      const fileName = `report.${extension}`;
      const path = `/imported/docs/${fileName}`;
      vi.mocked(readFilePreview).mockResolvedValue({
        path,
        content: null,
        isBinary: true,
        size: 2048,
        error: null,
      });
      const params = mount({
        projectRootPath: null,
        taskFiles: [
          {
            id: "imported-task-file",
            name: fileName,
            type: "document",
            content: "旧抽取文本",
            version: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        sessionFiles: [
          {
            name: fileName,
            fileType: extension,
            size: 100,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      });
      const projected = readCanonicalThreadItem(
        {
          id: "canonical-imported-item",
          type: "fileChange",
          status: "completed",
          metadata: { sourceEventType: "file.read" },
          changes: [
            { path, kind: { type: "update" }, diff: "历史中的抽取文本" },
          ],
        },
        {
          eventId: "imported-file-read",
          sequence: 7,
          sessionId: "session-1",
          threadId: "thread-1",
          turnId: "turn-1",
          type: "item.completed",
          timestamp: "2026-10-17T00:00:00Z",
          payload: {},
        },
      );
      const navigation = resolveTimelineArtifactNavigation(
        projected as unknown as AgentThreadItem,
      );
      expect(navigation).not.toBeNull();
      await act(async () => {
        runtime.handleOpenArtifactFromTimeline(navigation!.rootTarget);
        await Promise.resolve();
      });
      expect(readFilePreview).toHaveBeenCalledExactlyOnceWith(path, 64 * 1024);
      expect(params.readSessionFile).not.toHaveBeenCalled();
      expect(params.upsertGeneralArtifact).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          content: "",
          meta: expect.objectContaining({ filePath: path, sourcePath: path }),
        }),
      );
    },
  );

  it.each(["pdf", "docx", "xlsx", "csv", "tsv", "pptx"])(
    "时间线 %s 打开原文件，二进制不会提前拒绝或使用抽取文本",
    async (extension) => {
      const path = `/workspace/report.${extension}`;
      vi.mocked(readFilePreview).mockResolvedValue({
        path,
        content: null,
        isBinary: true,
        size: 2048,
        error: null,
      });
      const params = mount();
      await act(async () => {
        runtime.handleOpenArtifactFromTimeline({
          timelineItemId: "canonical-item-1",
          filePath: `report.${extension}`,
          content: "# Extracted text",
        });
        await Promise.resolve();
      });
      expect(readFilePreview).toHaveBeenCalledExactlyOnceWith(path, 64 * 1024);
      expect(params.upsertGeneralArtifact).toHaveBeenCalledOnce();
      expect(
        vi.mocked(params.upsertGeneralArtifact).mock.calls[0][0],
      ).toMatchObject({
        meta: {
          filePath: path,
          sourcePath: path,
          renderMode:
            extension === "pptx"
              ? "presentation"
              : ["pdf", "docx"].includes(extension)
                ? "document_pages"
                : "workbook",
        },
      });
      expect(
        params.workbenchRequests.requestCanvasWorkbenchPreviewOpen,
      ).toHaveBeenCalledWith({
        filePath: null,
        selectionKey: expect.stringMatching(/^artifact:/),
      });
      expect(
        params.workbenchRequests.focusArtifactBlock,
      ).not.toHaveBeenCalled();
    },
  );
  it.each(["pdf", "docx", "pptx"])(
    "主 Composer 打开 %s 保留版式预览和源路径",
    async (extension) => {
      const path = `/workspace/reports/report.${extension}`;
      vi.mocked(readFilePreview).mockResolvedValue({
        path,
        content: null,
        isBinary: true,
        size: 1728,
        error: null,
      });
      const params = mount();
      let opened = false;
      await act(async () => {
        opened = await runtime.openProjectFilePreviewInCanvas({
          relativePath: `reports/report.${extension}`,
          absolutePath: path,
          previewRequestKey: "reopen-2",
        });
      });
      expect(opened).toBe(true);
      expect(readFilePreview).toHaveBeenCalledExactlyOnceWith(path, 64 * 1024);
      const artifact = vi.mocked(params.upsertGeneralArtifact).mock
        .calls[0][0] as Artifact;
      expect(artifact.meta).toMatchObject({
        filePath: path,
        sourcePath: path,
        sourceRef: `reports/report.${extension}`,
        fileKind: extension,
        renderMode: extension === "pptx" ? "presentation" : "document_pages",
        previewArtifact: true,
        previewRequestKey: "reopen-2",
      });
      expect(artifact.content).toBe("");
      expect(params.setSelectedArtifactId).toHaveBeenCalledExactlyOnceWith(
        artifact.id,
      );
      expect(
        params.workbenchRequests.requestCanvasWorkbenchPreviewOpen,
      ).toHaveBeenCalledWith({
        filePath: null,
        selectionKey: `artifact:${artifact.id}`,
      });
      // 旧文本画布只允许被清空，不能成为当前选中的文件。
      expect(params.setGeneralCanvasState).toHaveBeenCalledExactlyOnceWith(
        expect.any(Function),
      );
      expect(params.setCanvasState).not.toHaveBeenCalled();
    },
  );

  it("空内容文件入口复用同一个专业预览 owner", async () => {
    const path = "/workspace/reports/report.docx";
    vi.mocked(readFilePreview).mockResolvedValue({
      path,
      content: "extracted text",
      isBinary: false,
      size: 1728,
      error: null,
    });
    const params = mount();
    await act(async () => {
      runtime.handleWorkspaceFileClick("reports/report.docx", "");
      await Promise.resolve();
    });
    expect(params.upsertGeneralArtifact).toHaveBeenCalledOnce();
    expect(
      vi.mocked(params.upsertGeneralArtifact).mock.calls[0][0],
    ).toMatchObject({
      meta: { filePath: path, sourcePath: path, renderMode: "document_pages" },
    });
    expect(readFilePreview).toHaveBeenCalledTimes(1);
  });

  it("取消的迟到读取不替换当前预览", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof readFilePreview>>) => void;
    vi.mocked(readFilePreview).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const params = mount();
    let canceled = false;
    const opening = runtime.openProjectFilePreviewInCanvas({
      absolutePath: "/workspace/old.pdf",
      isCancelled: () => canceled,
    });
    canceled = true;
    let opened = true;
    await act(async () => {
      resolve({
        path: "/workspace/old.pdf",
        content: null,
        isBinary: true,
        size: 10,
        error: null,
      });
      opened = await opening;
    });
    expect(opened).toBe(false);
    expect(params.upsertGeneralArtifact).not.toHaveBeenCalled();
    expect(
      params.workbenchRequests.requestCanvasWorkbenchPreviewOpen,
    ).not.toHaveBeenCalled();
  });
});
