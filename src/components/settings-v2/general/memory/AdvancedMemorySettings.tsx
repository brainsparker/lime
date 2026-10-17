import { ChevronDown, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MemoryEmbeddingProvider } from "@/lib/api/memoryConfigTypes";
import type {
  SoulImportResult,
  SoulImportWarningCode,
} from "@/lib/soul/soulConfig";

export type EmbeddingProviderChoice =
  | "auto"
  | "local_onnx"
  | "ollama"
  | "openai_api"
  | "disabled";
export interface ProviderChoiceDefinition {
  value: EmbeddingProviderChoice;
  labelKey: string;
  descriptionKey: string;
  runtimeProvider: MemoryEmbeddingProvider;
  providerId?: string;
  model: string;
}

const SOUL_WARNING_KEYS: Record<SoulImportWarningCode, string> = {
  empty: "settings.memory.soul.import.warning.empty",
  local_path: "settings.memory.soul.import.warning.localPath",
  project_rules: "settings.memory.soul.import.warning.projectRules",
  secret_like: "settings.memory.soul.import.warning.secretLike",
  too_long: "settings.memory.soul.import.warning.tooLong",
};

interface AdvancedMemorySettingsProps {
  providerChoice: EmbeddingProviderChoice;
  activeProvider: ProviderChoiceDefinition;
  providers: readonly ProviderChoiceDefinition[];
  handleProviderChange: (choice: EmbeddingProviderChoice) => void;
  soulExportMarkdown: string;
  handleSoulExportCopy: () => Promise<void>;
  soulImportText: string;
  soulImportPreview: SoulImportResult | null;
  onSoulImportTextChange: (value: string) => void;
  handleSoulImportPreview: () => void;
  handleSoulImportApply: () => void;
}

export function AdvancedMemorySettings({
  providerChoice,
  activeProvider,
  providers,
  handleProviderChange,
  soulExportMarkdown,
  handleSoulExportCopy,
  soulImportText,
  soulImportPreview,
  onSoulImportTextChange,
  handleSoulImportPreview,
  handleSoulImportApply,
}: AdvancedMemorySettingsProps) {
  const { t } = useTranslation("settings");
  return (
    <section
      className="rounded-md border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-950/5"
      data-testid="settings-memory-advanced-panel"
    >
      <div data-settings-search-target="memory-embedding" tabIndex={-1}>
        <label
          className="text-sm font-semibold text-slate-950"
          htmlFor="memory-embedding-provider"
        >
          {t("settings.memory.embedding.providerSelect.title")}
        </label>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {t("settings.memory.embedding.providerSelect.description")}
        </p>

        <div className="relative mt-4">
          <select
            id="memory-embedding-provider"
            value={providerChoice}
            onChange={(event) =>
              handleProviderChange(
                event.target.value as EmbeddingProviderChoice,
              )
            }
            className="w-full appearance-none rounded-md border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
            aria-label={t("settings.memory.embedding.providerSelect.aria")}
          >
            {providers.map((item) => (
              <option key={item.value} value={item.value}>
                {t(item.labelKey)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {t(activeProvider.labelKey)}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {t(activeProvider.descriptionKey)}
          </p>
        </div>
      </div>
      <div
        data-settings-search-target="memory-export"
        tabIndex={-1}
        className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {t("settings.memory.soul.export.title")}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {t("settings.memory.soul.export.description")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSoulExportCopy}
            disabled={!soulExportMarkdown}
            data-testid="settings-memory-soul-copy-export"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-60"
          >
            {t("settings.memory.soul.action.copyExport")}
          </button>
        </div>
        <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
          {soulExportMarkdown || t("settings.memory.soul.export.empty")}
        </pre>
      </div>

      <div
        data-settings-search-target="memory-import"
        tabIndex={-1}
        className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4"
      >
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {t("settings.memory.soul.import.title")}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {t("settings.memory.soul.import.description")}
            </p>
          </div>
        </div>
        <textarea
          value={soulImportText}
          onChange={(event) => onSoulImportTextChange(event.target.value)}
          rows={5}
          data-testid="settings-memory-soul-import-textarea"
          placeholder={t("settings.memory.soul.import.placeholder")}
          className="mt-3 min-h-[128px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
        />
        {soulImportPreview ? (
          <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">
              {t("settings.memory.soul.import.preview")}
            </p>
            {soulImportPreview.warnings.length > 0 ? (
              <ul className="space-y-1 text-xs leading-5 text-amber-700">
                {soulImportPreview.warnings.map((warning) => (
                  <li key={warning}>{t(SOUL_WARNING_KEYS[warning])}</li>
                ))}
              </ul>
            ) : null}
            <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-50">
              {soulImportPreview.preview ||
                t("settings.memory.soul.import.emptyPreview")}
            </pre>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSoulImportPreview}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            {t("settings.memory.soul.action.previewImport")}
          </button>
          <button
            type="button"
            onClick={handleSoulImportApply}
            disabled={!soulImportPreview?.canImport}
            className="rounded-md border border-slate-950 bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {t("settings.memory.soul.action.applyImport")}
          </button>
        </div>
      </div>
    </section>
  );
}
