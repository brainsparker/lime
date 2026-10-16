import type {
  MemoryAutoConfig,
  MemoryConfig,
  MemoryEmbeddingConfig,
  MemoryProfileConfig,
  MemoryResolveConfig,
  MemorySourcesConfig,
} from "@/lib/api/memoryConfigTypes";
import { normalizeSoulConfig } from "@/lib/soul/soulConfig";

function normalizeProfile(profile?: MemoryProfileConfig): MemoryProfileConfig {
  return {
    current_status: profile?.current_status || undefined,
    strengths: profile?.strengths || [],
    explanation_style: profile?.explanation_style || [],
    challenge_preference: profile?.challenge_preference || [],
  };
}

function normalizeSources(sources?: MemorySourcesConfig): MemorySourcesConfig {
  return {
    managed_policy_path: sources?.managed_policy_path ?? undefined,
    project_memory_paths: sources?.project_memory_paths?.filter(
      (item) => item.trim().length > 0,
    ).length
      ? sources.project_memory_paths
      : [".lime/AGENTS.md"],
    project_rule_dirs: sources?.project_rule_dirs?.filter(
      (item) => item.trim().length > 0,
    ).length
      ? sources.project_rule_dirs
      : [".agents/rules"],
    user_memory_path: sources?.user_memory_path ?? undefined,
  };
}

function normalizeAuto(auto?: MemoryAutoConfig): MemoryAutoConfig {
  return {
    enabled: auto?.enabled ?? true,
    entrypoint: auto?.entrypoint || "MEMORY.md",
    max_loaded_lines: auto?.max_loaded_lines ?? 200,
    root_dir: auto?.root_dir ?? undefined,
  };
}

function normalizeResolve(resolve?: MemoryResolveConfig): MemoryResolveConfig {
  return {
    additional_dirs: resolve?.additional_dirs || [],
    follow_imports: resolve?.follow_imports ?? true,
    import_max_depth: resolve?.import_max_depth ?? 5,
    load_additional_dirs_memory: resolve?.load_additional_dirs_memory ?? false,
  };
}

export function normalizeEmbedding(
  embedding?: MemoryEmbeddingConfig,
): MemoryEmbeddingConfig {
  const provider = embedding?.provider ?? "auto";
  const defaultModel =
    provider === "local_onnx" || provider === "auto"
      ? "all-MiniLM-L6-v2"
      : provider === "provider" && embedding?.provider_id === "ollama"
        ? "nomic-embed-text"
        : "text-embedding-3-small";

  return {
    provider,
    provider_id: embedding?.provider_id ?? undefined,
    model: embedding?.model?.trim() || defaultModel,
  };
}

export function normalizeMemoryConfig(memory?: MemoryConfig): MemoryConfig {
  return {
    enabled: memory?.enabled ?? true,
    max_entries: memory?.max_entries ?? 1000,
    retention_days: memory?.retention_days ?? 30,
    auto_cleanup: memory?.auto_cleanup ?? true,
    profile: normalizeProfile(memory?.profile),
    soul: normalizeSoulConfig(memory?.soul),
    sources: normalizeSources(memory?.sources),
    auto: normalizeAuto(memory?.auto),
    resolve: normalizeResolve(memory?.resolve),
    embedding: normalizeEmbedding(memory?.embedding),
  };
}
