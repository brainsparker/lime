export interface ConversationVisibleMessageLike {
  role: string;
  content: string;
  images?: readonly unknown[];
}

export function filterVisibleConversationMessages<
  T extends ConversationVisibleMessageLike,
>(messages: readonly T[]): T[] {
  return messages.filter((message) => {
    if (message.role !== "user") {
      return true;
    }
    if (message.content.trim().length > 0) {
      return true;
    }
    return Array.isArray(message.images) && message.images.length > 0;
  });
}
