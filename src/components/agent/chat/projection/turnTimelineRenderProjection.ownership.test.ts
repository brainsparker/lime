import { describe, expect, it } from "vitest";
import type {
  AgentThreadItem,
  AgentThreadTurn,
  Message,
  MessageMediaReference,
} from "../types";
import type { MessageRenderGroupProjection } from "./messageTimelineRenderProjection";
import { buildTurnTimelineRenderProjection } from "./turnTimelineRenderProjection";

const timestamp = "2026-10-14T00:00:00.000Z";
const imageUri = "https://example.com/input.png";

function fixture() {
  const turn: AgentThreadTurn = {
    id: "turn-owned",
    thread_id: "thread-owned",
    status: "completed",
    prompt_text: "问题",
    started_at: timestamp,
    completed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const user: Message = {
    id: "client-user",
    role: "user",
    content: "问题",
    timestamp: new Date(timestamp),
  };
  const assistant: Message = {
    id: "legacy-assistant",
    role: "assistant",
    content: "好",
    timestamp: new Date(timestamp),
  };
  const base = {
    thread_id: turn.thread_id,
    turn_id: turn.id,
    status: "completed" as const,
    started_at: timestamp,
    completed_at: timestamp,
    updated_at: timestamp,
  };
  const items: AgentThreadItem[] = [
    {
      ...base,
      id: "canonical-user",
      sequence: 1,
      type: "user_message",
      client_id: user.id,
      content: user.content,
    },
    {
      ...base,
      id: "canonical-reasoning",
      sequence: 2,
      type: "reasoning",
      text: "持久化的思考",
      summary: ["持久化的思考"],
    },
    {
      ...base,
      id: "canonical-agent",
      sequence: 3,
      type: "agent_message",
      text: assistant.content,
    },
  ];
  const group: MessageRenderGroupProjection = {
    id: "group-owned",
    messages: [user, assistant],
    userMessage: user,
    assistantMessages: [assistant],
    startedAt: user.timestamp,
    endedAt: assistant.timestamp,
    lastAssistantId: assistant.id,
    timelineMessageId: assistant.id,
    timeline: { messageId: assistant.id, turn, items },
    isActiveGroup: false,
  };
  return {
    turn,
    user,
    assistant,
    group,
    items,
    input: {
      messageGroups: [group],
      renderedTurns: [turn],
      renderedThreadItems: items,
    },
  };
}

function imageReferenceFixture(
  reference: MessageMediaReference,
  role: "user" | "assistant" = "user",
) {
  const value = fixture();
  const canonicalUser: AgentThreadItem = {
    ...value.items[0],
    type: "user_message",
    client_id: value.user.id,
    content: value.user.content,
    content_parts: [
      { type: "image", data: "", mime_type: "image/png", uri: imageUri },
    ],
  };
  value.input.renderedThreadItems = [canonicalUser, ...value.items.slice(1)];
  const message = role === "user" ? value.user : value.assistant;
  message.contentParts = [{ type: "media_reference", reference }];
  return { ...value, canonicalUser, message };
}

describe("canonical assistant ownership within an anchored group", () => {
  it("canonical Turn order wins over stale message group order after Queue reorder", () => {
    const { input, turn, items, group, user } = fixture();
    const otherTurn = { ...turn, id: "turn-other", prompt_text: "other" };
    const otherUser = {
      ...user,
      id: "client-other",
      content: "other",
      runtimeTurnId: otherTurn.id,
    };
    const otherItem: AgentThreadItem = {
      ...items[0],
      id: "user-other",
      turn_id: otherTurn.id,
      type: "user_message",
      client_id: otherUser.id,
      content: "other",
    };
    const otherGroup: MessageRenderGroupProjection = {
      ...group,
      id: "other-group",
      messages: [otherUser],
      userMessage: otherUser,
      assistantMessages: [],
      timeline: null,
    };
    const entries = buildTurnTimelineRenderProjection({
      ...input,
      messageGroups: [group, otherGroup],
      renderedTurns: [otherTurn, turn],
      renderedThreadItems: [...items, otherItem],
    });
    expect(
      entries
        .filter((entry) => entry.kind === "canonical_turn")
        .map((entry) => entry.turn.id),
    ).toEqual([otherTurn.id, turn.id]);
  });
  it("接管唯一同正文的未绑定 Message，仍保留 canonical reasoning Item", () => {
    const { input } = fixture();
    expect(buildTurnTimelineRenderProjection(input)).toMatchObject([
      {
        kind: "canonical_turn",
        segments: [
          { kind: "message", item: { id: "canonical-user" } },
          { kind: "process", items: [{ id: "canonical-reasoning" }] },
          { kind: "message", item: { id: "canonical-agent", text: "好" } },
        ],
      },
    ]);
  });

  it.each(["multiple-items", "multiple-messages", "conflicting-turn"])(
    "%s 不满足唯一归属时保留未绑定 Message",
    (boundary) => {
      const { input, group, assistant, items, turn } = fixture();
      if (boundary === "multiple-items") {
        input.renderedThreadItems.push({
          ...items[2],
          id: "second-canonical-agent",
          sequence: 4,
        });
      } else if (boundary === "multiple-messages") {
        const repeated = { ...assistant, id: "repeated-assistant" };
        group.messages.push(repeated);
        group.assistantMessages.push(repeated);
      } else {
        group.timeline = {
          ...group.timeline!,
          turn: { ...turn, id: "another-turn" },
        };
      }
      const projection = buildTurnTimelineRenderProjection(input);
      const residual = projection.flatMap((entry) =>
        entry.kind === "message_group" ? entry.group.messages : [],
      );
      expect(residual.map((message) => message.id)).toContain(assistant.id);
      if (boundary === "multiple-items") {
        const canonical = projection.find(
          (entry) => entry.kind === "canonical_turn",
        );
        expect(canonical?.segments).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "canonical-agent" }),
            expect.objectContaining({ id: "second-canonical-agent" }),
          ]),
        );
      }
    },
  );

  it("其他回合的同文本 Message 不被当前回合接管", () => {
    const { input, group, assistant, turn } = fixture();
    const otherAssistant: Message = {
      ...assistant,
      id: "assistant-another-turn",
      runtimeTurnId: "another-turn",
    };
    group.messages = group.messages.filter((entry) => entry.role === "user");
    group.assistantMessages = [];
    input.messageGroups.push({
      ...group,
      id: "group-another-turn",
      messages: [otherAssistant],
      userMessage: null,
      assistantMessages: [otherAssistant],
      timeline: null,
    });
    input.renderedTurns.push({ ...turn, id: "another-turn" });
    const projection = buildTurnTimelineRenderProjection(input);
    expect(
      projection.flatMap((entry) =>
        entry.kind === "message_group" ? entry.group.messages : [],
      ),
    ).toContainEqual(otherAssistant);
  });

  it("正文接管后仍保留 Message 专属媒体 surface", () => {
    const { input, assistant } = fixture();
    assistant.contentParts = [
      {
        type: "media_reference",
        reference: { uri: "https://example.com/owned.png", kind: "image" },
      },
    ];
    const projection = buildTurnTimelineRenderProjection(input);
    expect(projection).toMatchObject([
      { kind: "canonical_turn" },
      {
        kind: "message_group",
        group: {
          messages: [
            {
              id: assistant.id,
              content: "",
              contentParts: assistant.contentParts,
            },
          ],
        },
      },
    ]);
  });

  it.each([false, true])(
    "canonical 用户正文、标签与图片接管后 route 不产生空壳（legacy image=%s）",
    (hasLegacyImage) => {
      const { input, user, items } = fixture();
      user.inputCapabilityRoute = {
        kind: "installed_skill",
        skillKey: "user:inspect",
        skillName: "Inspect",
      };
      if (hasLegacyImage) {
        user.images = [{ data: "aW1hZ2U=", mediaType: "image/png" }];
      }
      const canonicalUser: AgentThreadItem = {
        ...items[0],
        type: "user_message",
        content: user.content,
        content_parts: [
          { type: "text", text: user.content },
          { type: "skill", name: "Inspect", path: "/skills/inspect/SKILL.md" },
          { type: "mention", name: "reference.md", path: "/tmp/reference.md" },
          { type: "image", data: "aW1hZ2U=", mime_type: "image/png" },
        ],
      };
      input.renderedThreadItems = [canonicalUser, ...items.slice(1)];

      const projection = buildTurnTimelineRenderProjection(input);
      expect(projection).toHaveLength(1);
      expect(projection[0]).toMatchObject({ kind: "canonical_turn" });
      if (projection[0].kind !== "canonical_turn")
        throw new Error("missing owner");
      expect(projection[0].segments[0]).toEqual({
        kind: "message",
        id: canonicalUser.id,
        item: canonicalUser,
      });
    },
  );

  it("没有 canonical 用户 owner 的本地 route 与正文仍保留", () => {
    const { input, user, group } = fixture();
    const localUser: Message = {
      ...user,
      id: "local-routed-user",
      content: "尚未被 canonical 接管的输入",
      inputCapabilityRoute: {
        kind: "installed_skill",
        skillKey: "user:local",
        skillName: "Local",
      },
    };
    input.messageGroups.unshift({
      ...group,
      id: "local-routed-group",
      messages: [localUser],
      userMessage: localUser,
      assistantMessages: [],
      timeline: null,
    });

    const projection = buildTurnTimelineRenderProjection(input);
    expect(
      projection.flatMap((entry) =>
        entry.kind === "message_group" ? entry.group.messages : [],
      ),
    ).toEqual([localUser]);
  });

  it.each(["client_id", "item_id"])(
    "同一 canonical 用户图片接管 %s 对应的裸直接图片引用",
    (identity) => {
      const { input, user, canonicalUser } = imageReferenceFixture({
        uri: imageUri,
        kind: "image",
        mimeType: "image/png",
        sourceUri: imageUri,
        previewUrl: imageUri,
      });
      if (identity === "item_id") user.id = canonicalUser.id;
      const projection = buildTurnTimelineRenderProjection(input);
      expect(projection).toHaveLength(1);
      expect(projection[0]).toMatchObject({ kind: "canonical_turn" });
      if (projection[0].kind !== "canonical_turn")
        throw new Error("missing image owner");
      expect(projection[0].segments[0]).toEqual({
        kind: "message",
        id: canonicalUser.id,
        item: canonicalUser,
      });
    },
  );

  const retainedReferences: Array<{
    name: string;
    patch: Partial<MessageMediaReference> & Record<string, unknown>;
    canonicalUri?: string;
  }> = [
    { name: "caption", patch: { caption: "独立说明" } },
    { name: "title", patch: { title: "独立标题" } },
    { name: "read owner", patch: { refId: "read-owner" } },
    { name: "sidecar owner", patch: { sidecarRef: { id: "read-owner" } } },
    { name: "digest", patch: { sha256: "a".repeat(64) } },
    { name: "size", patch: { byteSize: 123 } },
    {
      name: "different preview",
      patch: { previewUrl: "https://example.com/preview.png" },
    },
    { name: "different MIME", patch: { mimeType: "image/jpeg" } },
    { name: "unknown MIME", patch: { mimeType: "" } },
    {
      name: "source URI conflict",
      patch: { sourceUri: "https://example.com/other.png" },
    },
    { name: "source path conflict", patch: { sourcePath: "/tmp/other.png" } },
    {
      name: "different resource",
      patch: { uri: "https://example.com/other.png" },
    },
    { name: "audio", patch: { kind: "audio" } },
    { name: "video", patch: { kind: "video" } },
    { name: "file", patch: { kind: "file" } },
    { name: "unknown kind", patch: { kind: "unknown" } },
    { name: "missing kind", patch: { kind: undefined } },
    { name: "unknown responsibility", patch: { description: "未接管语义" } },
    {
      name: "same sidecar resource",
      patch: { uri: "sidecar://media/input.png" },
      canonicalUri: "sidecar://media/input.png",
    },
  ];

  it.each(retainedReferences)(
    "$name 未被 canonical 用户图片接管时保留完整 media reference",
    ({ patch, canonicalUri }) => {
      const reference = {
        uri: imageUri,
        kind: "image",
        mimeType: "image/png",
        ...patch,
      };
      const { input, message, canonicalUser } =
        imageReferenceFixture(reference);
      if (canonicalUri && canonicalUser.type === "user_message") {
        const image = canonicalUser.content_parts?.[0];
        if (image?.type === "image") image.uri = canonicalUri;
      }
      const residualMessages = buildTurnTimelineRenderProjection(input).flatMap(
        (entry) => (entry.kind === "message_group" ? entry.group.messages : []),
      );
      expect(residualMessages).toHaveLength(1);
      expect(residualMessages[0]).toMatchObject({
        id: message.id,
        contentParts: [{ type: "media_reference", reference }],
      });
    },
  );

  it.each(["other-user", "assistant"])(
    "%s 的同图引用不由另一条 canonical 用户图片接管",
    (boundary) => {
      const role = boundary === "assistant" ? "assistant" : "user";
      const reference = { uri: imageUri, kind: "image", mimeType: "image/png" };
      const { input, message } = imageReferenceFixture(reference, role);
      if (boundary === "other-user") message.id = "another-user";
      const residualMessages = buildTurnTimelineRenderProjection(input).flatMap(
        (entry) => (entry.kind === "message_group" ? entry.group.messages : []),
      );
      expect(residualMessages).toHaveLength(1);
      expect(residualMessages[0]).toMatchObject({
        id: message.id,
        role,
        contentParts: [{ type: "media_reference", reference }],
      });
    },
  );
});
