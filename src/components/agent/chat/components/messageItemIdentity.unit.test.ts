import { describe, expect, it } from "vitest";
import type { AgentRuntimeThreadReadModel } from "@/lib/api/agentRuntime/sessionTypes";
import type { AgentThreadItem, Message } from "../types";
import type { MessageListRenderGroup } from "./MessageList.types";
import { resolveCanonicalMessageItemId } from "./messageItemIdentity";

const message = {
  id: "client-target",
  role: "user",
  content: "正文",
  runtimeTurnId: "turn-target",
} as Message;
function userItem(
  id: string,
  clientId?: string,
  turnId = "turn-target",
): AgentThreadItem {
  return {
    id,
    type: "user_message",
    turn_id: turnId,
    client_id: clientId,
  } as AgentThreadItem;
}

function resolve(
  items: AgentThreadItem[],
  groupItems: AgentThreadItem[] = [],
  target = message,
) {
  return resolveCanonicalMessageItemId(
    target,
    {
      messages: [target],
      timeline: { turn: { id: "turn-target" }, items: groupItems },
    } as MessageListRenderGroup,
    { thread_items: items } as AgentRuntimeThreadReadModel,
  );
}

describe("canonical 用户消息身份", () => {
  it("同一 Turn 多条 User Item 按 client identity 匹配，不取第一条", () => {
    expect(
      resolve([
        userItem("first", "other-client"),
        userItem("target", "client-target"),
      ]),
    ).toBe("target");
  });

  it("用户消息已有准确 Item ID 时直接关联", () => {
    expect(
      resolve([userItem("first"), userItem("target")], [], {
        ...message,
        id: "target",
      }),
    ).toBe("target");
  });

  it("同一 Item 的 group/read 重复记录不造成伪歧义", () => {
    const item = userItem("sole-user");
    expect(resolve([item], [item])).toBe("sole-user");
  });

  it("缺少准确匹配且存在多个用户 Item 时 fail closed", () => {
    expect(resolve([userItem("first"), userItem("second")])).toBeNull();
  });

  it("两个 Item 复用同一 client identity 时 fail closed", () => {
    expect(
      resolve([
        userItem("first", "client-target"),
        userItem("second", "client-target"),
      ]),
    ).toBeNull();
  });

  it("另一 Turn 的相同 client identity 不能关联当前消息", () => {
    expect(
      resolve([userItem("wrong-turn", "client-target", "another-turn")]),
    ).toBeNull();
  });
});
