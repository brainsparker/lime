import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { BackgroundTerminalsAppServerClient } from "@/lib/api/backgroundTerminals";
import { ShellBackgroundTerminalList } from "./ShellBackgroundTerminalList";

function appServerResult<T>(result: T) {
  return {
    id: 1,
    result,
    response: { jsonrpc: "2.0" as const, id: 1, result },
    notifications: [],
    messages: [],
    configWarnings: [],
  };
}

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

beforeEach(async () => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await changeLimeLocale("zh-CN");
});

function renderList(client: BackgroundTerminalsAppServerClient) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ShellBackgroundTerminalList threadId="thread-1" client={client} />,
    );
  });
  mountedRoots.push({ root, container });
  return container;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) {
      break;
    }
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  await changeLimeLocale("en-US");
});

describe("ShellBackgroundTerminalList", () => {
  it("列出同一线程的后台终端，并按 item 停止", async () => {
    const client: BackgroundTerminalsAppServerClient = {
      listThreadBackgroundTerminals: vi
        .fn()
        .mockResolvedValueOnce(
          appServerResult({
            data: [
              {
                itemId: "item-1",
                processId: "7",
                command: "npm test",
                cwd: "/workspace",
              },
            ],
            nextCursor: null,
          }),
        )
        .mockResolvedValueOnce(
          appServerResult({
            data: [
              {
                itemId: "item-1",
                processId: "7",
                command: "npm test",
                cwd: "/workspace",
              },
            ],
            nextCursor: null,
          }),
        )
        .mockResolvedValueOnce(appServerResult({ data: [], nextCursor: null })),
      terminateThreadBackgroundTerminal: vi
        .fn()
        .mockResolvedValue(appServerResult({ terminated: true })),
      cleanThreadBackgroundTerminals: vi.fn(),
    };
    const container = renderList(client);
    await flush();

    expect(
      container.querySelector('[data-testid="shell-background-terminal"]')
        ?.textContent,
    ).toContain("npm test");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="shell-background-terminal-stop"]',
        )
        ?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.terminateThreadBackgroundTerminal).toHaveBeenCalledWith({
      threadId: "thread-1",
      processId: "7",
    });
    expect(
      container.querySelector(
        '[data-testid="shell-background-terminals-empty"]',
      ),
    ).not.toBeNull();
  });

  it("读取失败时显示错误", async () => {
    const client: BackgroundTerminalsAppServerClient = {
      listThreadBackgroundTerminals: vi
        .fn()
        .mockRejectedValue(new Error("down")),
      terminateThreadBackgroundTerminal: vi.fn(),
      cleanThreadBackgroundTerminals: vi.fn(),
    };
    const container = renderList(client);
    await flush();

    expect(
      container.querySelector(
        '[data-testid="shell-background-terminals-error"]',
      )?.textContent,
    ).toContain("无法读取后台终端");
    expect(
      container.querySelector(
        '[data-testid="shell-background-terminals-stop-all"]',
      ),
    ).toBeNull();
  });

  it("停止全部走 clean，不逐个 terminate", async () => {
    const client: BackgroundTerminalsAppServerClient = {
      listThreadBackgroundTerminals: vi
        .fn()
        .mockResolvedValueOnce(
          appServerResult({
            data: [
              {
                itemId: "item-1",
                processId: "7",
                command: "npm test",
                cwd: "/workspace",
              },
              {
                itemId: "item-2",
                processId: "8",
                command: "vite",
                cwd: "/workspace",
              },
            ],
            nextCursor: null,
          }),
        )
        .mockResolvedValueOnce(appServerResult({ data: [], nextCursor: null })),
      terminateThreadBackgroundTerminal: vi.fn(),
      cleanThreadBackgroundTerminals: vi
        .fn()
        .mockResolvedValue(appServerResult({})),
    };
    const container = renderList(client);
    await flush();

    expect(
      container.querySelector(
        '[data-testid="shell-background-terminals-stop-all"]',
      )?.textContent,
    ).toBe("停止全部");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="shell-background-terminals-stop-all"]',
        )
        ?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.cleanThreadBackgroundTerminals).toHaveBeenCalledWith({
      threadId: "thread-1",
    });
    expect(client.terminateThreadBackgroundTerminal).not.toHaveBeenCalled();
    expect(
      container.querySelector(
        '[data-testid="shell-background-terminals-empty"]',
      ),
    ).not.toBeNull();
  });
});
