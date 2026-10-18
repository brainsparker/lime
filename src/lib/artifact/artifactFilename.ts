import { artifactRegistry, type ArtifactRegistry } from "./registry";
import type { Artifact } from "./types";

/**
 * 根据 Artifact 类型和元数据生成文件名
 * @param artifact - Artifact 对象
 * @param registry - 渲染器扩展名配置
 * @param sourcePath - 已解析的真实本地源文件路径
 * @returns 文件名
 */
export function generateFilename(
  artifact: Artifact,
  registry: Pick<ArtifactRegistry, "getFileExtension"> = artifactRegistry,
  sourcePath?: string | null,
): string {
  // 如果元数据中有文件名，优先使用
  if (artifact.meta.filename) {
    return artifact.meta.filename;
  }

  // 真实文件保留原扩展名，不使用预览投影的 Artifact 类型推断。
  const sourceFilename = sourcePath?.split(/[\\/]/).pop();
  if (sourceFilename) {
    return sourceFilename;
  }

  // 获取文件扩展名
  const ext = registry.getFileExtension(artifact.type);

  // 对于代码类型，根据语言选择扩展名
  if (artifact.type === "code" && artifact.meta.language) {
    const langExt = getLanguageExtension(artifact.meta.language);
    return `${sanitizeFilename(artifact.title)}.${langExt}`;
  }

  return `${sanitizeFilename(artifact.title)}.${ext}`;
}

/**
 * 根据语言获取文件扩展名
 * @param language - 编程语言
 * @returns 文件扩展名
 */
export function getLanguageExtension(language: string): string {
  const langExtMap: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    rust: "rs",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    csharp: "cs",
    ruby: "rb",
    php: "php",
    swift: "swift",
    kotlin: "kt",
    scala: "scala",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    yaml: "yaml",
    yml: "yml",
    xml: "xml",
    markdown: "md",
    sql: "sql",
    shell: "sh",
    bash: "sh",
    powershell: "ps1",
    dockerfile: "dockerfile",
    tsx: "tsx",
    jsx: "jsx",
    vue: "vue",
    svelte: "svelte",
  };

  const lower = language.toLowerCase();
  // 使用 hasOwnProperty 检查，避免原型链上的属性污染
  return Object.prototype.hasOwnProperty.call(langExtMap, lower)
    ? langExtMap[lower]
    : "txt";
}

/**
 * 清理文件名，移除非法字符
 * @param name - 原始文件名
 * @returns 清理后的文件名
 */
function sanitizeFilename(name: string): string {
  // 移除或替换非法字符
  const sanitized = name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .trim();

  // 如果为空，使用默认名称
  return sanitized || "artifact";
}
