import type { AgentThreadItem, AgentThreadTurn } from "@/lib/api/agentProtocol";
import { readThreadOutputMessage } from "./threadOutputMessage";
import { readThreadOutputWebsite } from "./threadOutputWebsite";
import {
  isExcludedOutputPath,
  isOutputPathWithin,
  normalizeOutputPath,
  outputPathKey,
  resolveOutputPath,
} from "./threadOutputPaths";

interface ThreadOutputIdentity {
  threadId: string;
  turnId: string;
  itemId: string;
  producedAtMs?: number;
}

export type ThreadOutput = ThreadOutputIdentity &
  (
    | { type: "file" | "generated-image"; path: string }
    | { type: "website"; target: string }
  );

export interface ThreadOutputsInput {
  threadId: string | null;
  turns: readonly AgentThreadTurn[];
  items: readonly AgentThreadItem[];
  cwd: string | null;
  projectlessOutputDirectory?: string | null;
}

const outputExtensions = new Set([
  "avif",
  "csv",
  "doc",
  "docx",
  "gif",
  "jpeg",
  "jpg",
  "md",
  "mdx",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "tsv",
  "webp",
  "xls",
  "xlsm",
  "xlsx",
]);
const linkExtensions = new Set(["docx", "pdf", "tex", "pptx", "xlsx"]);

function localLinkPath(value: string): string | null {
  let path = value;
  try {
    path = decodeURI(value);
  } catch {
    /* 保留无法解码的原始路径。 */
  }
  if (/^(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:|tel:)/i.test(path)) return null;
  path = path.replace(
    /(?:#L\d+(?:C\d+)?(?:-L?\d+(?:C\d+)?)?|:\d+(?::\d+)?)$/,
    "",
  );
  return path && /\.[a-z0-9]+$/i.test(path) ? path : null;
}

function extension(path: string): string {
  return path.split(".").at(-1)?.toLowerCase() ?? "";
}

export function collectThreadOutputs({
  threadId,
  turns,
  items,
  cwd,
  projectlessOutputDirectory = null,
}: ThreadOutputsInput): ThreadOutput[] {
  if (!threadId) return [];
  const byTurn = new Map<string, AgentThreadItem[]>();
  for (const item of items) {
    if (item.thread_id !== threadId) continue;
    const group = byTurn.get(item.turn_id) ?? [];
    group.push(item);
    byTurn.set(item.turn_id, group);
  }
  const result: ThreadOutput[] = [];
  const positions = new Map<string, number>();
  // canonical Turn 顺序是 authority，不能按随机 ID、完成时间或显示日期重排。
  for (const turn of turns.slice().reverse()) {
    if (turn.thread_id !== threadId) continue;
    const group = (byTurn.get(turn.id) ?? [])
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    const outputMessages = group.flatMap((item) =>
      item.type === "agent_message"
        ? [{ item, message: readThreadOutputMessage(item.text) }]
        : [],
    );
    const visualizationPaths = new Set(
      outputMessages.flatMap(({ message }) => [...message.visualizations]),
    );
    let hasFileOutput = false;
    const add = (rawPath: string, item: AgentThreadItem, explicit: boolean) => {
      const path = resolveOutputPath(rawPath, cwd);
      if (
        !path ||
        !/^(?:\/|[a-z]:\/)/i.test(path) ||
        isExcludedOutputPath(path, cwd) ||
        visualizationPaths.has(normalizeOutputPath(rawPath)) ||
        (explicit && !outputExtensions.has(extension(path))) ||
        (projectlessOutputDirectory !== null &&
          !isOutputPathWithin(path, projectlessOutputDirectory, cwd))
      )
        return;
      const key = `path:${outputPathKey(path, cwd)}`;
      const producedAtMs = Date.parse(turn.started_at);
      const file: ThreadOutput = {
        type: item.type === "image_generation" ? "generated-image" : "file",
        path,
        threadId,
        turnId: turn.id,
        itemId: item.id,
        ...(Number.isFinite(producedAtMs) ? { producedAtMs } : {}),
      };
      if (file.type === "file") hasFileOutput = true;
      const position = positions.get(key);
      if (position !== undefined) {
        // 图片升级普通文件时保留首次位置，同时保留图片自己的 canonical 身份。
        if (result[position].type === "file" && file.type === "generated-image")
          result[position] = file;
        return;
      }
      positions.set(key, result.length);
      result.push(file);
    };
    // 生成图片即使回合尚未结束仍可输出；委托同一 Files 媒体预览 owner。
    for (const item of group) {
      if (
        item.type === "image_generation" &&
        item.saved_path &&
        item.generation_status === "completed"
      ) {
        add(item.saved_path, item, false);
      }
    }
    if (turn.status !== "completed" && turn.status !== "failed") continue;
    for (const item of group) {
      if (item.type === "file_artifact" && item.status === "completed")
        add(item.path, item, true);
    }
    for (const { item, message } of outputMessages)
      for (const path of message.outputs) add(path, item, true);
    const final = outputMessages.at(-1);
    if (final) {
      const references = new Set(
        outputMessages.flatMap(({ message }) =>
          message.references.map((path) => outputPathKey(path, cwd)),
        ),
      );
      for (const link of final.message.links) {
        const path = localLinkPath(link);
        if (
          path &&
          linkExtensions.has(extension(path)) &&
          !references.has(outputPathKey(path, cwd))
        )
          add(path, final.item, false);
      }
    }
    if (!hasFileOutput) {
      const website = readThreadOutputWebsite({
        items: group,
        finalMessage: final?.item,
        cwd,
        projectlessOutputDirectory,
      });
      if (website) {
        const key = /^https?:\/\//i.test(website.target)
          ? `url:${website.target}`
          : `path:${outputPathKey(website.target, cwd)}`;
        if (!positions.has(key)) {
          positions.set(key, result.length);
          const producedAtMs = Date.parse(turn.started_at);
          result.push({
            type: "website",
            ...website,
            threadId,
            turnId: turn.id,
            ...(Number.isFinite(producedAtMs) ? { producedAtMs } : {}),
          });
        }
      }
    }
  }
  return result;
}
