import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { McpServer, McpServerConfig } from "@/lib/api/mcp";
import { useSettingsDraft } from "@/components/settings-v2/_layout/useSettingsDraft";
import { DEFAULT_MCP_SERVER_CONFIG, MCP_PAGE_PRESETS } from "./mcpPageModel";

interface UseMcpPageEditorStateOptions {
  addServer: (server: Omit<McpServer, "id" | "created_at">) => Promise<void>;
  updateServer: (server: McpServer) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
}

interface McpEditorDraft {
  editName: string;
  editDescription: string;
  editConfig: string;
  enabledLime: boolean;
  enabledClaude: boolean;
  enabledCodex: boolean;
  enabledGemini: boolean;
}

interface McpEditorState {
  selectedServer: McpServer | null;
  isCreating: boolean;
  draft: McpEditorDraft;
  baseline: McpEditorDraft;
  configError: string | null;
  selectedPreset: string | null;
}

type EditorAction =
  | { kind: "select"; server: McpServer }
  | { kind: "create" }
  | { kind: "cancel" };

function createEditor(
  server: McpServer | null = null,
  isCreating = false,
): McpEditorState {
  const draft: McpEditorDraft = {
    editName: server?.name ?? "",
    editDescription: server?.description ?? "",
    editConfig: server
      ? JSON.stringify(server.server_config, null, 2)
      : DEFAULT_MCP_SERVER_CONFIG,
    enabledLime: server?.enabled_lime ?? true,
    enabledClaude: server?.enabled_claude ?? true,
    enabledCodex: server?.enabled_codex ?? true,
    enabledGemini: server?.enabled_gemini ?? true,
  };
  return {
    selectedServer: server,
    isCreating,
    draft,
    baseline: draft,
    configError: null,
    selectedPreset: isCreating ? "custom" : null,
  };
}

function isDirty(editor: McpEditorState) {
  return JSON.stringify(editor.draft) !== JSON.stringify(editor.baseline);
}

export function useMcpPageEditorState({
  addServer,
  updateServer,
  deleteServer,
}: UseMcpPageEditorStateOptions) {
  const { t } = useTranslation("settings");
  const [editor, setEditor] = useState(createEditor);
  const editorRef = useRef(editor);
  const [saving, setSaving] = useState(false);
  const operation = useRef<symbol | null>(null);
  const lifetime = useRef<object | null>(null);
  const [pendingAction, setPendingAction] = useState<EditorAction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const deleteConfirmRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    lifetime.current = {};
    return () => {
      lifetime.current = null;
    };
  }, []);
  useSettingsDraft({ dirty: isDirty(editor), saving });

  const replaceEditor = (next: McpEditorState) => {
    editorRef.current = next;
    setEditor(next);
  };
  const editField = <K extends keyof McpEditorDraft>(
    key: K,
    value: McpEditorDraft[K],
  ) => {
    if (operation.current) return;
    const current = editorRef.current;
    replaceEditor({ ...current, draft: { ...current.draft, [key]: value } });
  };
  const applyAction = (action: EditorAction) => {
    replaceEditor(
      action.kind === "select"
        ? createEditor(action.server)
        : createEditor(null, action.kind === "create"),
    );
    setPendingAction(null);
  };
  const requestAction = (action: EditorAction) => {
    const current = editorRef.current;
    if (
      action.kind === "select" &&
      action.server.id === current.selectedServer?.id
    )
      return;
    if (action.kind === "create" && current.isCreating) return;
    if (operation.current || isDirty(current)) setPendingAction(action);
    else applyAction(action);
  };

  const handlePresetSelect = (presetId: string) => {
    if (operation.current) return;
    const preset = MCP_PAGE_PRESETS.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    const current = editorRef.current;
    replaceEditor({
      ...current,
      selectedPreset: presetId,
      configError: null,
      draft: {
        ...current.draft,
        ...(presetId !== "custom"
          ? {
              editName: t(preset.nameKey, preset.defaultName),
              editDescription: t(
                preset.descriptionKey,
                preset.defaultDescription,
              ),
            }
          : {}),
        editConfig: JSON.stringify(preset.server_config, null, 2),
      },
    });
  };

  const handleConfigChange = (value: string) => {
    if (operation.current) return;
    let configError: string | null = null;
    try {
      JSON.parse(value);
    } catch {
      configError = t("settings.mcpPage.error.invalidJson", "JSON 格式错误");
    }
    const current = editorRef.current;
    replaceEditor({
      ...current,
      draft: { ...current.draft, editConfig: value },
      configError,
    });
  };

  const handleSave = async () => {
    if (operation.current) return;
    const owner = editorRef.current;
    if (!owner.isCreating && !owner.selectedServer) return;
    const draft = owner.draft;
    if (!draft.editName.trim()) {
      alert(t("settings.mcpPage.toast.nameRequired", "请输入服务器名称"));
      return;
    }
    let serverConfig: McpServerConfig;
    try {
      serverConfig = JSON.parse(draft.editConfig) as McpServerConfig;
    } catch {
      replaceEditor({
        ...owner,
        configError: t(
          "settings.mcpPage.error.invalidJsonCannotSave",
          "JSON 格式错误，无法保存",
        ),
      });
      return;
    }
    const saved = {
      name: draft.editName.trim(),
      description: draft.editDescription.trim() || undefined,
      server_config: serverConfig,
      enabled_lime: draft.enabledLime,
      enabled_claude: draft.enabledClaude,
      enabled_codex: draft.enabledCodex,
      enabled_gemini: draft.enabledGemini,
    };
    const request = Symbol();
    const scope = lifetime.current;
    operation.current = request;
    setSaving(true);
    const isCurrent = () =>
      lifetime.current === scope &&
      scope !== null &&
      editorRef.current === owner;
    try {
      if (owner.isCreating) await addServer(saved);
      else await updateServer({ ...owner.selectedServer!, ...saved });
      if (isCurrent())
        replaceEditor(
          owner.isCreating
            ? createEditor()
            : createEditor({ ...owner.selectedServer!, ...saved }),
        );
    } catch (error) {
      if (isCurrent())
        alert(
          t("settings.mcpPage.toast.saveFailed", {
            message: error instanceof Error ? error.message : String(error),
            defaultValue: "保存失败：{{message}}",
          }),
        );
    } finally {
      if (operation.current === request) {
        operation.current = null;
        if (lifetime.current === scope && scope !== null) setSaving(false);
      }
    }
  };

  const handleDeleteClick = (id: string) => {
    if (operation.current) return;
    deleteConfirmRef.current = id;
    setDeleteConfirm(id);
  };
  const handleDeleteConfirm = async () => {
    const id = deleteConfirmRef.current;
    if (!id || operation.current) return;
    const owner = editorRef.current;
    const scope = lifetime.current;
    const request = Symbol();
    operation.current = request;
    deleteConfirmRef.current = null;
    setDeleteConfirm(null);
    setSaving(true);
    try {
      await deleteServer(id);
      if (
        lifetime.current === scope &&
        scope !== null &&
        editorRef.current === owner &&
        owner.selectedServer?.id === id
      )
        replaceEditor(createEditor());
    } catch {
      if (
        lifetime.current === scope &&
        scope !== null &&
        editorRef.current === owner
      )
        alert(t("settings.mcpPage.toast.deleteFailed"));
    } finally {
      if (operation.current === request) {
        operation.current = null;
        if (lifetime.current === scope && scope !== null) setSaving(false);
      }
    }
  };
  const handleDeleteCancel = () => {
    deleteConfirmRef.current = null;
    setDeleteConfirm(null);
  };

  return {
    ...editor.draft,
    selectedServer: editor.selectedServer,
    isCreating: editor.isCreating,
    configError: editor.configError,
    selectedPreset: editor.selectedPreset,
    saving,
    deleteConfirm,
    pendingNavigation: pendingAction !== null,
    clearPendingNavigation: () => setPendingAction(null),
    discardPendingNavigation: () => {
      if (!operation.current && pendingAction) applyAction(pendingAction);
    },
    setEditName: (value: string) => editField("editName", value),
    setEditDescription: (value: string) => editField("editDescription", value),
    setEnabledLime: (value: boolean) => editField("enabledLime", value),
    setEnabledClaude: (value: boolean) => editField("enabledClaude", value),
    setEnabledCodex: (value: boolean) => editField("enabledCodex", value),
    setEnabledGemini: (value: boolean) => editField("enabledGemini", value),
    handleSelectServer: (server: McpServer) =>
      requestAction({ kind: "select", server }),
    handleCreateNew: () => requestAction({ kind: "create" }),
    handleCancelEdit: () => requestAction({ kind: "cancel" }),
    handlePresetSelect,
    handleConfigChange,
    handleSave,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  };
}
