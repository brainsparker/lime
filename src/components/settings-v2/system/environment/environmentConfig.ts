import type {
  Config,
  EnvironmentConfig,
  EnvironmentVariableOverride,
} from "@/lib/api/appConfig";

export interface EnvironmentDraft {
  shellImportEnabled: boolean;
  shellImportTimeout: string;
  variables: EnvironmentVariableOverride[];
}

export type EnvironmentDraftField = keyof EnvironmentDraft;

export function normalizeEnvironmentConfig(
  config?: Config | null,
): EnvironmentConfig {
  return {
    shell_import: {
      enabled: config?.environment?.shell_import?.enabled ?? false,
      timeout_ms: config?.environment?.shell_import?.timeout_ms ?? 1500,
    },
    variables: [...(config?.environment?.variables ?? [])].map((entry) => ({
      key: entry.key,
      value: entry.value,
      enabled: entry.enabled,
    })),
  };
}

export function createEmptyVariable(): EnvironmentVariableOverride {
  return {
    key: "",
    value: "",
    enabled: true,
  };
}

export function readEnvironmentDraft(config?: Config | null): EnvironmentDraft {
  const environment = normalizeEnvironmentConfig(config);
  return {
    shellImportEnabled: environment.shell_import.enabled,
    shellImportTimeout: String(environment.shell_import.timeout_ms),
    variables: environment.variables,
  };
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeEnvironmentDraft(
  current: Config,
  draft: EnvironmentDraft,
  snapshot: EnvironmentDraft,
): Config {
  const currentEnvironment = normalizeEnvironmentConfig(current);
  const nextEnvironment: EnvironmentConfig = {
    shell_import: currentEnvironment.shell_import,
    variables: currentEnvironment.variables,
  };

  if (draft.shellImportEnabled !== snapshot.shellImportEnabled) {
    nextEnvironment.shell_import = {
      ...nextEnvironment.shell_import,
      enabled: draft.shellImportEnabled,
    };
  }
  if (draft.shellImportTimeout !== snapshot.shellImportTimeout) {
    nextEnvironment.shell_import = {
      ...nextEnvironment.shell_import,
      timeout_ms: Math.min(
        30000,
        Math.max(100, Number.parseInt(draft.shellImportTimeout, 10) || 1500),
      ),
    };
  }
  if (!equal(draft.variables, snapshot.variables)) {
    nextEnvironment.variables = draft.variables.map((entry) => ({
      ...entry,
    }));
  }

  return {
    ...current,
    environment: nextEnvironment,
  };
}
