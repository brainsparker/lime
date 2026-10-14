import type { UserInput } from "@limecloud/app-server-client";
import type { MessageImage } from "../types";
import { normalizeImageMimeType } from "../utils/imageAttachments";

export function getQueuedMessageImage(
  input: readonly UserInput[],
): MessageImage | null {
  const image = input.find(
    (part) => part.type === "image" || part.type === "localImage",
  );
  if (!image || (image.type !== "image" && image.type !== "localImage"))
    return null;
  const source = image.type === "image" ? image.url : image.path;
  return {
    data: "",
    mediaType:
      normalizeImageMimeType(/^data:([^;,]+)/i.exec(source)?.[1], source) ||
      "image/png",
    ...(image.type === "image"
      ? { sourceUri: source }
      : { sourcePath: source }),
  };
}

export function getQueuedMessageText(input: readonly UserInput[]): string {
  return input
    .filter(
      (item): item is Extract<UserInput, { type: "text" }> =>
        item.type === "text",
    )
    .map((item) => item.text)
    .join("\n");
}

export function replaceQueuedMessageText(
  input: readonly UserInput[],
  text: string,
): UserInput[] {
  if (text === getQueuedMessageText(input)) {
    return [...input];
  }

  // 编辑器将文本段合并为一个草稿；修改后不沿用原文本的字节范围。
  const next: UserInput[] = [];
  let replaced = false;
  for (const item of input) {
    if (item.type !== "text") {
      next.push(item);
    } else if (!replaced) {
      next.push({ type: "text", text });
      replaced = true;
    }
  }
  if (!replaced) {
    next.unshift({ type: "text", text });
  }
  return next;
}
