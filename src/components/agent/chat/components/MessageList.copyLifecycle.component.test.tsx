import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  MessageList,
  mountedRoots,
  render,
  type Message,
} from "./MessageList.testHarness";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const messages: Message[] = ["first", "second"].map((id) => ({
  id,
  role: "user",
  content: `${id} 完整原文 😀`,
  timestamp: new Date("2026-10-14T00:00:00.000Z"),
}));
const writeText = vi.fn<(text: string) => Promise<void>>();
let originalClipboard: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  writeText.mockReset().mockResolvedValue(undefined);
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

function copyButton(container: HTMLElement, id = "first") {
  const button = container
    .querySelector(`[data-message-id="${id}"]`)
    ?.parentElement?.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy message"]',
    );
  expect(button).toBeTruthy();
  return button!;
}

function copied(container: HTMLElement, id = "first") {
  return Boolean(copyButton(container, id).querySelector(".lucide-check"));
}

async function copy(container: HTMLElement, id = "first") {
  await act(async () => copyButton(container, id).click());
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

function unmount() {
  const mounted = mountedRoots.pop()!;
  act(() => mounted.root.unmount());
  mounted.container.remove();
  // 清空 jsdom Storage 的零延时事件，保留仍待执行的复制反馈计时器。
  advance(0);
}

function switchSession(sessionId: string) {
  act(() => {
    mountedRoots
      .at(-1)!
      .root.render(<MessageList messages={messages} sessionId={sessionId} />);
  });
}

describe("MessageList 复制反馈生命周期", () => {
  it("复制完整正文后保留两秒成功反馈", async () => {
    const container = render(messages, { sessionId: "a" });
    await copy(container);
    expect(writeText).toHaveBeenCalledWith(messages[0].content);
    expect(copied(container)).toBe(true);
    advance(1999);
    expect(copied(container)).toBe(true);
    advance(1);
    expect(copied(container)).toBe(false);
  });

  it.each(["first", "second"])(
    "连续复制 %s 从最新成功开始计时，旧反馈不会提前清除",
    async (id) => {
      const container = render(messages);
      await copy(container);
      advance(1000);
      await copy(container, id);
      advance(1000);
      expect(copied(container, id)).toBe(true);
      advance(999);
      expect(copied(container, id)).toBe(true);
      advance(1);
      expect(copied(container, id)).toBe(false);
    },
  );

  it("卸载立即取消复制反馈，不留下环境销毁后的更新", async () => {
    const container = render(messages);
    await copy(container);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["resolve", "reject"])(
    "卸载后的 clipboard %s 不再产生反馈、提示或定时器",
    async (outcome) => {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      writeText.mockImplementationOnce(
        () =>
          new Promise<void>((accept, decline) => {
            resolve = accept;
            reject = decline;
          }),
      );
      const container = render(messages);
      await copy(container);
      unmount();
      await act(async () => {
        if (outcome === "resolve") resolve();
        else reject(new Error("clipboard unavailable"));
      });
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("切换会话清除反馈，目标会话仍可正常复制", async () => {
    const container = render(messages, { sessionId: "a" });
    await copy(container);
    switchSession("b");
    expect(copied(container)).toBe(false);
    await copy(container, "second");
    advance(1999);
    expect(copied(container, "second")).toBe(true);
    advance(1);
    expect(copied(container, "second")).toBe(false);
  });

  it.each(["switch", "newer-copy"])(
    "%s 后迟到的复制结果不能覆盖当前反馈",
    async (action) => {
      let resolve!: () => void;
      writeText.mockImplementationOnce(
        () => new Promise<void>((accept) => (resolve = accept)),
      );
      const container = render(messages, { sessionId: "a" });
      await copy(container);
      if (action === "switch") switchSession("b");
      await copy(container, "second");
      await act(async () => resolve());
      expect(copied(container, "second")).toBe(true);
      expect(copied(container, "first")).toBe(false);
      expect(toast.success).toHaveBeenCalledTimes(1);
    },
  );

  it("当前会话的复制失败保留失败提示", async () => {
    writeText.mockRejectedValueOnce(new Error("clipboard unavailable"));
    const container = render(messages);
    await copy(container);
    expect(copied(container)).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
