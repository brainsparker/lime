import { expect, it } from "vitest";
import { filterVisibleConversationMessages } from "./conversationMessages";

it("filters empty user messages while preserving images and assistant ownership", () => {
  const messages = [
    { role: "user", content: " " },
    { role: "user", content: " ", images: [{}] },
    { role: "assistant", content: "" },
  ];
  expect(filterVisibleConversationMessages(messages)).toEqual(
    messages.slice(1),
  );
});
