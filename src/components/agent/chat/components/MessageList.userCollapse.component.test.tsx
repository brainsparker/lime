import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { render } from "./MessageList.testHarness";
import type {
  AgentThreadItem,
  AgentThreadTurn,
  Message,
} from "./MessageList.testHarness";

const timestamp = "2026-10-14T00:00:00.000Z";
const content = `${"完整长消息 👩🏽‍💻\n".repeat(40)}尾部 **Markdown**`;
const writeText = vi.fn(async (_text: string) => undefined);
let originalClipboard: PropertyDescriptor | undefined;

beforeEach(() => {
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  writeText.mockClear();
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function () {
      if (
        this.dataset.testid === "user-message-content-full" ||
        this.dataset.testid === "user-message-content-viewport"
      ) {
        const height =
          this.dataset.testid === "user-message-content-full"
            ? 600
            : Number.parseFloat(this.style.maxHeight) || 600;
        return {
          x: 0,
          y: 0,
          top: 0,
          bottom: height,
          left: 0,
          right: 600,
          height,
          width: 600,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return originalRect.call(this);
    },
  );
  const originalStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    if (
      (element as HTMLElement).dataset.testid === "user-message-content-full"
    ) {
      return { lineHeight: "22px" } as CSSStyleDeclaration;
    }
    return originalStyle(element);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalClipboard)
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

function user(id: string, extra: Partial<Message> = {}): Message {
  return {
    id,
    role: "user",
    content,
    timestamp: new Date(timestamp),
    ...extra,
  } as Message;
}

function turn(id: string): AgentThreadTurn {
  return {
    id,
    thread_id: "thread-collapse",
    prompt_text: content,
    status: "completed",
    started_at: timestamp,
    completed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function item(
  id: string,
  turnId: string,
  extra: Partial<AgentThreadItem> = {},
): AgentThreadItem {
  return {
    id,
    type: "user_message",
    thread_id: "thread-collapse",
    turn_id: turnId,
    sequence: 1,
    status: "completed",
    started_at: timestamp,
    completed_at: timestamp,
    updated_at: timestamp,
    ...extra,
  } as AgentThreadItem;
}

function collapseRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector<HTMLElement>(
    '[data-testid="collapsible-user-message-content"]',
  );
  expect(root).not.toBeNull();
  return root!;
}

function toggle(root: HTMLElement) {
  const button = root.querySelector<HTMLButtonElement>(
    '[data-testid="user-message-content-toggle"]',
  );
  expect(button).not.toBeNull();
  act(() => button!.click());
}

describe("MessageList 用户正文折叠接线", () => {
  it("message_group 的收起/展开复制与编辑均使用完整原文", async () => {
    const onEditMessage = vi.fn();
    const container = render([user("local-user")], { onEditMessage });
    const root = collapseRoot(container);
    expect(
      root
        .closest("[data-render-entry-kind]")
        ?.getAttribute("data-render-entry-kind"),
    ).toBe("message_group");
    expect(root.dataset.userMessageContentState).toBe("collapsed");
    expect(root.textContent).toContain("尾部 **Markdown**");
    const copy = container.querySelector<HTMLButtonElement>(
      '[aria-label="Copy message"]',
    );
    expect(copy).not.toBeNull();
    await act(async () => copy!.click());
    toggle(root);
    expect(root.dataset.userMessageContentState).toBe("expanded");
    await act(async () => copy!.click());
    expect(writeText.mock.calls.map(([text]) => text)).toEqual([
      content,
      content,
    ]);
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Edit message"]')!
        .click(),
    );
    expect(onEditMessage).toHaveBeenCalledWith("local-user", content);
  });

  it.each([
    {
      kind: "installed_skill",
      tag: "message-user-skill-tag",
      route: {
        kind: "installed_skill",
        skillKey: "inspect",
        skillName: "Inspect",
      },
    },
    {
      kind: "builtin_command",
      tag: "message-user-command-tag",
      route: {
        kind: "builtin_command",
        commandKey: "image_generate",
        commandPrefix: "@配图",
      },
    },
  ])("$kind 标签与图片留在折叠正文之外", ({ tag, route }) => {
    const container = render([
      user("tagged-user", {
        inputCapabilityRoute: route as Message["inputCapabilityRoute"],
        images: [{ data: "AA==", mediaType: "image/png" }],
      }),
    ]);
    const root = collapseRoot(container);
    expect(root.dataset.userMessageContentState).toBe("collapsed");
    const label = container.querySelector(`[data-testid="${tag}"]`);
    expect(label).not.toBeNull();
    expect(root.contains(label)).toBe(false);
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(root.contains(image)).toBe(false);
  });

  it("canonical_turn 复用同一正文折叠并保留精确 Item、标签与全文复制", async () => {
    const currentTurn = turn("canonical-turn");
    const userItem = item("canonical-user", currentTurn.id, {
      content,
      content_parts: [
        { type: "skill", name: "inspect", path: "/tmp/inspect/SKILL.md" },
      ],
    } as Partial<AgentThreadItem>);
    const container = render([], {
      turns: [currentTurn],
      threadItems: [userItem],
      threadRead: { thread_id: "thread-collapse" },
    });
    const root = collapseRoot(container);
    const bubble = root.closest<HTMLElement>('[data-message-role="user"]');
    expect(
      root
        .closest("[data-render-entry-kind]")
        ?.getAttribute("data-render-entry-kind"),
    ).toBe("canonical_turn");
    expect(bubble?.dataset.threadItemId).toBe("canonical-user");
    expect(bubble?.dataset.runtimeTurnId).toBe("canonical-turn");
    expect(bubble?.dataset.directSegmentKind).toBe("message");
    expect(
      root.contains(
        container.querySelector('[data-testid="message-user-skill-tag"]'),
      ),
    ).toBe(false);
    expect(root.dataset.userMessageContentState).toBe("collapsed");
    const copy = container.querySelector<HTMLButtonElement>(
      '[aria-label="Copy message"]',
    );
    await act(async () => copy!.click());
    toggle(root);
    await act(async () => copy!.click());
    expect(writeText.mock.calls.map(([text]) => text)).toEqual([
      content,
      content,
    ]);
  });

  it("指定 canonical User Item 的 reveal 只展开匹配正文", () => {
    const currentTurn = turn("two-users-turn");
    const container = render([], {
      turns: [currentTurn],
      threadItems: [
        item("first-user", currentTurn.id, { content }),
        item("second-user", currentTurn.id, {
          content: `${content} 第二条`,
          sequence: 2,
        }),
      ],
      focusedTimelineItemId: "second-user",
      timelineFocusRequestKey: 1,
    });
    const roots = [
      ...container.querySelectorAll<HTMLElement>(
        '[data-testid="collapsible-user-message-content"]',
      ),
    ];
    expect(roots).toHaveLength(2);
    expect(
      roots.map((root) => [
        root.closest<HTMLElement>('[data-message-role="user"]')?.dataset
          .threadItemId,
        root.dataset.userMessageContentState,
      ]),
    ).toEqual([
      ["first-user", "collapsed"],
      ["second-user", "expanded"],
    ]);
  });

  it.each(["inline-bytes", "direct-reference"])(
    "%s rich 输入共用一个气泡、正文、图片和标签 owner",
    async (source) => {
      const currentTurn = turn("rich-canonical-turn");
      const uri = "https://example.com/input.png";
      const data = source === "inline-bytes" ? "aW1hZ2U=" : "";
      const image = {
        data,
        mediaType: "image/png",
        ...(source === "direct-reference" ? { sourceUri: uri } : {}),
      };
      const legacyUser = user("rich-client-user", {
        runtimeTurnId: currentTurn.id,
        inputCapabilityRoute: {
          kind: "installed_skill",
          skillKey: "user:inspect",
          skillName: "Inspect",
        },
        images: [image],
        contentParts:
          source === "direct-reference"
            ? [
                {
                  type: "media_reference",
                  reference: { uri, kind: "image", mimeType: "image/png" },
                },
              ]
            : undefined,
      });
      const userItem = item("rich-canonical-user", currentTurn.id, {
        type: "user_message",
        client_id: legacyUser.id,
        content,
        content_parts: [
          { type: "text", text: content },
          { type: "skill", name: "Inspect", path: "/skills/inspect/SKILL.md" },
          { type: "mention", name: "reference.md", path: "/tmp/reference.md" },
          {
            type: "image",
            data,
            mime_type: "image/png",
            ...(source === "direct-reference" ? { uri } : {}),
          },
        ],
      } as Partial<AgentThreadItem>);
      const onOpenMessagePreview = vi.fn();
      const container = render([legacyUser], {
        turns: [currentTurn],
        threadItems: [userItem],
        threadRead: { thread_id: "thread-collapse" },
        onOpenMessagePreview,
      });
      const bubbles = container.querySelectorAll<HTMLElement>(
        '[data-message-role="user"]',
      );
      expect(bubbles).toHaveLength(1);
      const bubble = bubbles[0];
      expect(bubble.dataset.messageId).toBe(legacyUser.id);
      expect(bubble.dataset.threadItemId).toBe(userItem.id);
      expect(bubble.dataset.runtimeTurnId).toBe(currentTurn.id);
      expect(
        bubble.closest<HTMLElement>("[data-render-entry-kind]")?.dataset
          .renderEntryKind,
      ).toBe("canonical_turn");
      expect(
        container.querySelectorAll('[data-render-entry-kind="message_group"]'),
      ).toHaveLength(0);
      const roots = bubble.querySelectorAll<HTMLElement>(
        '[data-testid="collapsible-user-message-content"]',
      );
      expect(roots).toHaveLength(1);
      const root = roots[0];
      expect(root.dataset.userMessageContentState).toBe("collapsed");
      expect(root.textContent).toContain(content);
      const labels = [
        ...bubble.querySelectorAll('[data-testid="message-user-skill-tag"]'),
      ];
      expect(labels.map((label) => label.textContent?.trim())).toEqual([
        "@Inspect",
        "@reference.md",
      ]);
      expect(labels.every((label) => !root.contains(label))).toBe(true);
      const images = bubble.querySelectorAll<HTMLImageElement>("img");
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe(
        source === "inline-bytes" ? "data:image/png;base64,aW1hZ2U=" : uri,
      );
      expect(root.contains(images[0])).toBe(false);
      act(() =>
        bubble
          .querySelector<HTMLButtonElement>(
            '[data-testid="message-image-attachment-open-0"]',
          )!
          .click(),
      );
      expect(onOpenMessagePreview).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "message_attachment",
          attachment: expect.objectContaining({
            ...image,
          }),
        }),
        expect.objectContaining({
          id: userItem.id,
          role: "user",
          runtimeTurnId: currentTurn.id,
          content,
        }),
      );
      const copies = container.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Copy message"]',
      );
      expect(copies).toHaveLength(1);
      await act(async () => copies[0].click());
      toggle(root);
      expect(root.dataset.userMessageContentState).toBe("expanded");
      await act(async () => copies[0].click());
      expect(writeText.mock.calls.map(([text]) => text)).toEqual([
        content,
        content,
      ]);
    },
  );

  it("指定本地 message_group 正文的 reveal 使用现有消息 identity", () => {
    const container = render([user("local-target")], {
      focusedTimelineItemId: "local-target",
      timelineFocusRequestKey: 1,
    });
    const root = collapseRoot(container);
    expect(
      root
        .closest("[data-render-entry-kind]")
        ?.getAttribute("data-render-entry-kind"),
    ).toBe("message_group");
    expect(root.dataset.userMessageContentState).toBe("expanded");
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
    "%s 的展开/收起使用已加载文案",
    async (locale) => {
      await changeLimeLocale(locale as Parameters<typeof changeLimeLocale>[0]);
      const root = collapseRoot(render([user(`user-${locale}`)]));
      const button = root.querySelector<HTMLButtonElement>(
        '[data-testid="user-message-content-toggle"]',
      )!;
      const showMore = button.textContent;
      expect(showMore?.trim()).toBeTruthy();
      expect(showMore).not.toContain("agentChat.");
      toggle(root);
      expect(button.textContent?.trim()).toBeTruthy();
      expect(button.textContent).not.toContain("agentChat.");
      expect(button.textContent).not.toBe(showMore);
    },
  );
});
