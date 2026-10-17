import { useCallback, useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  MemoryEmbeddingConfig,
  MemorySoulConfig,
} from "@/lib/api/memoryConfigTypes";
import {
  buildSoulMarkdown,
  normalizeSoulConfig,
  parseSoulMarkdown,
  type SoulImportResult,
} from "@/lib/soul/soulConfig";
import type { SoulStyleProfileId } from "@/lib/soul/style-profiles";
import { MemoryStoreStatusPanel } from "./MemoryStoreStatusPanel";
import { normalizeEmbedding } from "./memoryConfig";
import { useMemorySettingsDraft } from "./useMemorySettingsDraft";
import { useSettingsDraft } from "../../_layout/useSettingsDraft";
import {
  SoulSettingsPanel,
  type SoulTemplateDefinition,
} from "./soul/SoulSettingsPanel";
import {
  AdvancedMemorySettings,
  type EmbeddingProviderChoice,
  type ProviderChoiceDefinition,
} from "./AdvancedMemorySettings";

type MemorySettingsTab = "memory" | "soul" | "advanced";
const PROVIDER_CHOICES: ProviderChoiceDefinition[] = [
  {
    value: "auto",
    labelKey: "settings.memory.embedding.provider.auto.label",
    descriptionKey: "settings.memory.embedding.provider.auto.description",
    runtimeProvider: "auto",
    model: "all-MiniLM-L6-v2",
  },
  {
    value: "local_onnx",
    labelKey: "settings.memory.embedding.provider.localOnnx.label",
    descriptionKey: "settings.memory.embedding.provider.localOnnx.description",
    runtimeProvider: "local_onnx",
    model: "all-MiniLM-L6-v2",
  },
  {
    value: "ollama",
    labelKey: "settings.memory.embedding.provider.ollama.label",
    descriptionKey: "settings.memory.embedding.provider.ollama.description",
    runtimeProvider: "provider",
    providerId: "ollama",
    model: "nomic-embed-text",
  },
  {
    value: "openai_api",
    labelKey: "settings.memory.embedding.provider.openaiApi.label",
    descriptionKey: "settings.memory.embedding.provider.openaiApi.description",
    runtimeProvider: "openai_api",
    model: "text-embedding-3-small",
  },
  {
    value: "disabled",
    labelKey: "settings.memory.embedding.provider.disabled.label",
    descriptionKey: "settings.memory.embedding.provider.disabled.description",
    runtimeProvider: "disabled",
    model: "all-MiniLM-L6-v2",
  },
];
const SOUL_TEMPLATE_DEFINITIONS: SoulTemplateDefinition[] = [
  {
    id: "balanced",
    titleKey: "settings.memory.soul.template.balanced.title",
    descriptionKey: "settings.memory.soul.template.balanced.description",
    summaryKey: "settings.memory.soul.template.balanced.summary",
    communicationKeys: [
      "settings.memory.soul.template.balanced.communication.1",
      "settings.memory.soul.template.balanced.communication.2",
      "settings.memory.soul.template.balanced.communication.3",
    ],
    avoidKeys: [
      "settings.memory.soul.template.balanced.avoid.1",
      "settings.memory.soul.template.balanced.avoid.2",
    ],
  },
  {
    id: "direct",
    titleKey: "settings.memory.soul.template.direct.title",
    descriptionKey: "settings.memory.soul.template.direct.description",
    summaryKey: "settings.memory.soul.template.direct.summary",
    communicationKeys: [
      "settings.memory.soul.template.direct.communication.1",
      "settings.memory.soul.template.direct.communication.2",
      "settings.memory.soul.template.direct.communication.3",
    ],
    avoidKeys: [
      "settings.memory.soul.template.direct.avoid.1",
      "settings.memory.soul.template.direct.avoid.2",
    ],
  },
  {
    id: "creator",
    titleKey: "settings.memory.soul.template.creator.title",
    descriptionKey: "settings.memory.soul.template.creator.description",
    summaryKey: "settings.memory.soul.template.creator.summary",
    communicationKeys: [
      "settings.memory.soul.template.creator.communication.1",
      "settings.memory.soul.template.creator.communication.2",
      "settings.memory.soul.template.creator.communication.3",
    ],
    avoidKeys: [
      "settings.memory.soul.template.creator.avoid.1",
      "settings.memory.soul.template.creator.avoid.2",
    ],
  },
];

function memoryT(
  t: TFunction<"settings">,
  key: string,
  values: Record<string, string | number | boolean> = {},
): string {
  const translate = t as unknown as (
    key: string,
    values?: Record<string, string | number | boolean>,
  ) => string;
  return String(translate(key, values));
}

function resolveProviderChoice(
  embedding?: MemoryEmbeddingConfig,
): EmbeddingProviderChoice {
  const normalized = normalizeEmbedding(embedding);
  if (
    normalized.provider === "provider" &&
    normalized.provider_id === "ollama"
  ) {
    return "ollama";
  }
  if (
    normalized.provider === "auto" ||
    normalized.provider === "local_onnx" ||
    normalized.provider === "openai_api" ||
    normalized.provider === "disabled"
  ) {
    return normalized.provider;
  }
  return "auto";
}

function buildEmbeddingConfig(
  choice: EmbeddingProviderChoice,
): MemoryEmbeddingConfig {
  const definition =
    PROVIDER_CHOICES.find((item) => item.value === choice) ??
    PROVIDER_CHOICES[0];

  return {
    provider: definition.runtimeProvider,
    provider_id: definition.providerId,
    model: definition.model,
  };
}

function buildSoulDraftPatch(
  current: MemorySoulConfig | undefined,
  patch: Partial<MemorySoulConfig>,
): MemorySoulConfig {
  return normalizeSoulConfig({
    ...normalizeSoulConfig(current),
    ...patch,
    imported_from: patch.imported_from ?? "manual",
    updated_at: new Date().toISOString(),
  });
}

function readSoulTemplateList(
  t: TFunction<"settings">,
  keys: string[],
): string[] {
  return keys
    .map((key) => memoryT(t, key))
    .filter((item) => item.trim().length > 0);
}

function buildSoulTemplatePatch(
  t: TFunction<"settings">,
  template: SoulTemplateDefinition,
): Partial<MemorySoulConfig> {
  return {
    enabled: true,
    name: memoryT(t, template.titleKey),
    summary: memoryT(t, template.summaryKey),
    communication_style: readSoulTemplateList(t, template.communicationKeys),
    avoid: readSoulTemplateList(t, template.avoidKeys),
    imported_from: "manual",
  };
}

function LoadingSkeleton() {
  return (
    <div
      className="mx-auto max-w-[820px] space-y-5 pb-8"
      data-testid="settings-memory-page"
    >
      <div className="h-[88px] animate-pulse rounded-md border border-slate-200 bg-white" />
      <div className="h-[160px] animate-pulse rounded-md border border-slate-200 bg-white" />
      <div className="h-[220px] animate-pulse rounded-md border border-slate-200 bg-white" />
    </div>
  );
}

export function MemorySettings({ initialTab }: { initialTab?: string } = {}) {
  const { t } = useTranslation("settings");
  const [message, setMessage] = useState<string | null>(null);
  const messageTimeoutRef = useRef<number | null>(null);
  const [soulImportText, setSoulImportText] = useState("");
  const [soulImportPreview, setSoulImportPreview] =
    useState<SoulImportResult | null>(null);
  const [activeTab, setActiveTab] = useState<MemorySettingsTab>(
    initialTab === "soul" || initialTab === "advanced" ? initialTab : "memory",
  );

  const showMessage = useCallback((nextMessage: string) => {
    if (messageTimeoutRef.current !== null) {
      window.clearTimeout(messageTimeoutRef.current);
    }
    setMessage(nextMessage);
    messageTimeoutRef.current = window.setTimeout(() => {
      messageTimeoutRef.current = null;
      setMessage(null);
    }, 2500);
  }, []);

  useEffect(
    () => () => {
      if (messageTimeoutRef.current !== null) {
        window.clearTimeout(messageTimeoutRef.current);
      }
    },
    [],
  );

  const { draft, setDraft, dirty, loading, saving, save, reset } =
    useMemorySettingsDraft(showMessage);
  const hasUnsavedInput = dirty || soulImportText.length > 0;
  useSettingsDraft({ dirty: hasUnsavedInput, saving });
  const providerChoice = resolveProviderChoice(draft.embedding);
  const activeProvider =
    PROVIDER_CHOICES.find((item) => item.value === providerChoice) ??
    PROVIDER_CHOICES[0];
  const embeddingConfig = normalizeEmbedding(draft.embedding);
  const vectorSearchEnabled =
    draft.enabled && embeddingConfig.provider !== "disabled";
  const memoryStatusDescriptionKey = vectorSearchEnabled
    ? "settings.memory.embedding.status.configuredDescription"
    : "settings.memory.embedding.status.fullTextDescription";
  const soul = normalizeSoulConfig(draft.soul);
  const soulExportMarkdown = buildSoulMarkdown(soul);
  const tabs: Array<{
    id: MemorySettingsTab;
    labelKey: string;
    descriptionKey: string;
  }> = [
    {
      id: "memory",
      labelKey: "settings.memory.tabs.memory",
      descriptionKey: "settings.memory.tabs.memory.description",
    },
    {
      id: "soul",
      labelKey: "settings.memory.tabs.soul",
      descriptionKey: "settings.memory.tabs.soul.description",
    },
    {
      id: "advanced",
      labelKey: "settings.memory.tabs.advanced",
      descriptionKey: "settings.memory.tabs.advanced.description",
    },
  ];
  const handleProviderChange = (choice: EmbeddingProviderChoice) => {
    setDraft((previous) => ({
      ...previous,
      embedding: buildEmbeddingConfig(choice),
    }));
  };

  const handleSoulTemplateApply = (template: SoulTemplateDefinition) => {
    setDraft((previous) => ({
      ...previous,
      soul: buildSoulDraftPatch(
        previous.soul,
        buildSoulTemplatePatch(t, template),
      ),
    }));
    showMessage(memoryT(t, "settings.memory.soul.message.templateApplied"));
  };

  const handleSoulStyleProfileChange = (styleProfileId: SoulStyleProfileId) => {
    setDraft((previous) => ({
      ...previous,
      soul: buildSoulDraftPatch(previous.soul, {
        enabled: true,
        style_profile_id: styleProfileId,
      }),
    }));
    showMessage(memoryT(t, "settings.memory.soul.message.styleProfileUpdated"));
  };

  const handleSoulReset = () => {
    setDraft((previous) => {
      const previousSoul = normalizeSoulConfig(previous.soul);
      return {
        ...previous,
        soul: normalizeSoulConfig({
          enabled: false,
          name: undefined,
          summary: undefined,
          style_profile_id: undefined,
          tone: [],
          communication_style: [],
          explanation_depth: undefined,
          challenge_style: undefined,
          avoid: [],
          artifact_voice: previousSoul.artifact_voice,
          imported_from: "manual",
          updated_at: new Date().toISOString(),
        }),
      };
    });
    setSoulImportPreview(null);
    setSoulImportText("");
    showMessage(memoryT(t, "settings.memory.soul.message.reset"));
  };

  const handleSoulImportPreview = () => {
    const result = parseSoulMarkdown(soulImportText);
    setSoulImportPreview(result);
    showMessage(
      memoryT(
        t,
        result.canImport
          ? "settings.memory.soul.message.importPreviewReady"
          : "settings.memory.soul.message.importEmpty",
      ),
    );
  };

  const handleSoulImportApply = () => {
    if (!soulImportPreview?.canImport) {
      return;
    }
    setDraft((previous) => {
      const previousSoul = normalizeSoulConfig(previous.soul);
      return {
        ...previous,
        soul: normalizeSoulConfig({
          ...soulImportPreview.draft,
          artifact_voice: previousSoul.artifact_voice,
          style_profile_id: previousSoul.style_profile_id,
        }),
      };
    });
    setSoulImportText("");
    setSoulImportPreview(null);
    showMessage(memoryT(t, "settings.memory.soul.message.importApplied"));
  };

  const handleSoulExportCopy = async () => {
    if (!soulExportMarkdown) {
      showMessage(memoryT(t, "settings.memory.soul.message.exportEmpty"));
      return;
    }

    try {
      await navigator.clipboard.writeText(soulExportMarkdown);
      showMessage(memoryT(t, "settings.memory.soul.message.exportCopied"));
    } catch (error) {
      console.error("复制 SOUL.md 失败:", error);
      showMessage(memoryT(t, "settings.memory.soul.message.exportCopyFailed"));
    }
  };

  const handleCancel = () => {
    reset();
    setSoulImportText("");
    setSoulImportPreview(null);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  const messageIsError = Boolean(
    message &&
    /失败|失敗|실패|failed|error|cannot|can't/u.test(message.toLowerCase()),
  );

  return (
    <div
      className="mx-auto max-w-[820px] space-y-5 pb-8"
      data-testid="settings-memory-page"
    >
      {message ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-sm shadow-slate-950/5",
            messageIsError
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {messageIsError ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{message}</span>
        </div>
      ) : null}

      <section
        data-settings-search-target="memory-enabled"
        tabIndex={-1}
        className="rounded-md border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-950/5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-[24px] font-semibold text-slate-950">
              {memoryT(t, "settings.memory.title")}
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              {memoryT(t, "settings.memory.hero.description")}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-medium text-slate-600">
              {draft.enabled
                ? memoryT(t, "settings.memory.status.enabled")
                : memoryT(t, "settings.memory.status.disabled")}
            </span>
            <Switch
              aria-label={memoryT(t, "settings.memory.toggle.aria")}
              data-testid="settings-memory-toggle"
              checked={draft.enabled}
              onCheckedChange={(checked) =>
                setDraft((previous) => ({
                  ...previous,
                  enabled: checked,
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-md border border-slate-200/90 bg-white p-2 shadow-sm shadow-slate-950/5">
        <div
          className="grid gap-2 md:grid-cols-3"
          role="tablist"
          aria-label={memoryT(t, "settings.memory.tabs.aria")}
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`settings-memory-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-md px-3 py-3 text-left transition",
                  selected
                    ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <span className="block text-sm font-semibold">
                  {memoryT(t, tab.labelKey)}
                </span>
                <span className="mt-1 block text-xs leading-5">
                  {memoryT(t, tab.descriptionKey)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "soul" ? (
        <SoulSettingsPanel
          soul={soul}
          templates={SOUL_TEMPLATE_DEFINITIONS}
          handleSoulTemplateApply={handleSoulTemplateApply}
          handleSoulStyleProfileChange={handleSoulStyleProfileChange}
          handleSoulReset={handleSoulReset}
          showMessage={showMessage}
        />
      ) : null}

      {activeTab === "advanced" ? (
        <AdvancedMemorySettings
          providerChoice={providerChoice}
          activeProvider={activeProvider}
          providers={PROVIDER_CHOICES}
          handleProviderChange={handleProviderChange}
          soulExportMarkdown={soulExportMarkdown}
          handleSoulExportCopy={handleSoulExportCopy}
          soulImportText={soulImportText}
          soulImportPreview={soulImportPreview}
          onSoulImportTextChange={(value) => {
            setSoulImportText(value);
            setSoulImportPreview(null);
          }}
          handleSoulImportPreview={handleSoulImportPreview}
          handleSoulImportApply={handleSoulImportApply}
        />
      ) : null}

      <div
        hidden={activeTab !== "memory"}
        data-settings-search-target="memory-store"
        tabIndex={-1}
      >
        <MemoryStoreStatusPanel
          vectorSearchEnabled={vectorSearchEnabled}
          memoryStatusDescriptionKey={memoryStatusDescriptionKey}
          showMessage={showMessage}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-950/5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">
          {hasUnsavedInput
            ? memoryT(t, "settings.memory.toggle.unsavedHint")
            : memoryT(t, "settings.memory.toggle.syncedHint")}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={handleCancel}
            disabled={!hasUnsavedInput || saving}
            data-testid="settings-memory-cancel"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
          >
            {memoryT(t, "settings.memory.action.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            data-testid="settings-memory-save"
            className="rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving
              ? memoryT(t, "settings.memory.action.saving")
              : memoryT(t, "settings.memory.action.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
