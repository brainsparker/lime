import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import type { Message } from "../types";

type UserMessage = Extract<AgentThreadItem, { type: "user_message" }>;
type ImagePart = Extract<
  NonNullable<UserMessage["content_parts"]>[number],
  { type: "image" }
>;

export function normalizeUserMessageText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<image\b[^>]*>/giu, " ")
    .replace(/<\/image>/giu, " ")
    .replace(/\[\s*image(?:\s*#\s*\d+)?\s*\]/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeImageDataIdentity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase().startsWith("data:")) {
    const commaIndex = normalized.indexOf(",");
    const payload = commaIndex >= 0 ? normalized.slice(commaIndex + 1) : "";
    const compactPayload = payload.replace(/\s+/g, "");
    return compactPayload ? `data:${compactPayload}` : null;
  }
  return `data:${normalized.replace(/\s+/g, "")}`;
}

function normalizeImageReferenceIdentity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase().startsWith("data:")) {
    return normalizeImageDataIdentity(normalized);
  }
  return `ref:${normalized.replace(/\\/g, "/").toLowerCase()}`;
}

function imageIdentities(part: ImagePart): Set<string> {
  const identities = new Set<string>();
  const dataIdentity = normalizeImageDataIdentity(part.data);
  if (dataIdentity) identities.add(dataIdentity);
  for (const value of [part.uri, part.source_path]) {
    const identity = normalizeImageReferenceIdentity(value);
    if (identity) identities.add(identity);
  }
  return identities;
}

function canonicalImageIdentities(
  item: Extract<AgentThreadItem, { type: "user_message" }>,
): Set<string> {
  const identities = new Set<string>();
  for (const part of item.content_parts || []) {
    if (part.type !== "image") continue;
    for (const identity of imageIdentities(part)) {
      identities.add(identity);
    }
  }
  return identities;
}

function messageImageIdentities(message: Message): Set<string> {
  const identities = new Set<string>();
  for (const image of message.images || []) {
    const dataIdentity = normalizeImageDataIdentity(image.data);
    if (dataIdentity) identities.add(dataIdentity);
    for (const value of [image.sourceUri, image.sourcePath, image.previewUrl]) {
      const identity = normalizeImageReferenceIdentity(value);
      if (identity) {
        identities.add(identity);
      }
    }
  }
  return identities;
}

/** 判断 Message 是否对应同一条 canonical user_message，避免重复气泡。 */
export function messageMatchesCanonicalUserMessage(
  message: Message,
  item: Extract<AgentThreadItem, { type: "user_message" }>,
): boolean {
  if (message.role !== "user") return false;
  if (message.id === item.id || item.client_id === message.id) return true;

  // A persisted runtime turn is authoritative. Only pending turns are still
  // provisional and may fall back to content/image identity.
  const runtimeTurnId = message.runtimeTurnId?.trim();
  if (
    runtimeTurnId &&
    !runtimeTurnId.startsWith("pending-turn:") &&
    runtimeTurnId !== item.turn_id
  ) {
    return false;
  }

  const messageText = normalizeUserMessageText(message.content);
  const itemText = normalizeUserMessageText(
    item.content ||
      (item.content_parts || [])
        .flatMap((part) => (part.type === "text" ? [part.text] : []))
        .join("\n"),
  );
  if (messageText && itemText && messageText === itemText) return true;

  const messageImages = messageImageIdentities(message);
  if (messageImages.size === 0) return false;
  for (const identity of canonicalImageIdentities(item)) {
    if (messageImages.has(identity)) return true;
  }
  return false;
}
