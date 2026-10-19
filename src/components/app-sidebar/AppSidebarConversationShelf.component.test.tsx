import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentSessionInfo } from "@/lib/api/agentRuntime/sessionTypes";
import { PINNED_THREAD_SECTION } from "@/lib/api/threadSections";
import { AppSidebarConversationShelf } from "./AppSidebarConversationShelf";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === "string" ? fallback : (fallback?.defaultValue ?? key),
  }),
}));
vi.mock("./useAppSidebarThreadSections", () => ({
  useAppSidebarThreadSections: () => ({
    sections: [{ id: "01984de2-8f74-7c91-a3b2-5c5e937cf318", name: "Pinned" }],
    pendingSectionId: null,
    createSection: vi.fn(),
    renameSection: vi.fn(),
    removeSection: vi.fn(),
  }),
}));

let root: Root | undefined;
function session(
  id: string,
  extra: Partial<AgentSessionInfo> = {},
): AgentSessionInfo {
  return { id, name: id, created_at: 1, updated_at: 1, ...extra };
}

function mount(
  overrides: Partial<
    React.ComponentProps<typeof AppSidebarConversationShelf>
  > = {},
) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const onShowMoreRecent = vi.fn();
  act(() =>
    root!.render(
      <AppSidebarConversationShelf
        recentSessions={[]}
        recentLoading={false}
        hasMoreRecent={false}
        actionSessionId={null}
        onCreateConversation={vi.fn()}
        onNavigateToConversation={vi.fn()}
        onToggleArchive={vi.fn()}
        onTogglePinned={vi.fn()}
        onMoveToSection={vi.fn()}
        onShowMoreRecent={onShowMoreRecent}
        {...overrides}
      />,
    ),
  );
  return { container, onShowMoreRecent };
}

function click(container: HTMLElement, selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button, selector).not.toBeNull();
  act(() => button!.click());
}

describe("sidebar section projection", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    localStorage.clear();
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("Projects limits project count to five while Pinned and Recents keep independent budgets", () => {
    localStorage.setItem(
      "sidebar-section-preferences",
      JSON.stringify({ order: ["threads", "chats", "pinned"], collapsed: [] }),
    );
    const projects = Array.from({ length: 7 }, (_, index) => ({
      id: `project-${index}`,
      name: `project-${index}`,
      rootPath: `/repo/${index}`,
    }));
    const sessions = [
      ...projects.flatMap((project) =>
        Array.from({ length: 3 }, (_, index) =>
          session(`${project.id}-thread-${index}`, {
            workspace_id: project.id,
          }),
        ),
      ),
      session("pinned-thread", { section: PINNED_THREAD_SECTION }),
      ...Array.from({ length: 15 }, (_, index) => session(`recent-${index}`)),
    ];
    const { container, onShowMoreRecent } = mount({
      openedProjects: projects,
      recentSessions: sessions,
    });
    const recent = () =>
      container.querySelector(
        '[data-testid="app-sidebar-recent-conversations"]',
      )!;
    expect(
      container.querySelectorAll(
        '[data-testid="app-sidebar-project-conversation-group"]',
      ),
    ).toHaveLength(5);
    expect(recent().querySelectorAll("[data-session-id]")).toHaveLength(10);
    expect(
      container.querySelector('[data-session-id="pinned-thread"]'),
    ).not.toBeNull();

    click(container, '[data-testid="app-sidebar-projects-show-more"]');
    expect(
      container.querySelectorAll(
        '[data-testid="app-sidebar-project-conversation-group"]',
      ),
    ).toHaveLength(7);
    expect(recent().querySelectorAll("[data-session-id]")).toHaveLength(10);

    click(container, '[data-testid="app-sidebar-load-more"]');
    expect(recent().querySelectorAll("[data-session-id]")).toHaveLength(15);
    expect(onShowMoreRecent).toHaveBeenCalledOnce();
  });

  it("uses an observed sentinel only when Recents is the final section", () => {
    type ObserverCallback = ConstructorParameters<
      typeof IntersectionObserver
    >[0];
    let notify: ObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: ObserverCallback) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { container, onShowMoreRecent } = mount({
      recentSessions: Array.from({ length: 15 }, (_, index) =>
        session(`r${index}`),
      ),
    });
    expect(container.querySelectorAll("[data-session-id]")).toHaveLength(10);
    expect(
      container.querySelector('[data-testid="app-sidebar-load-more"]'),
    ).toBeNull();
    const sentinel = container.querySelector(
      '[data-testid="app-sidebar-pagination-sentinel"]',
    );
    expect(sentinel).not.toBeNull();
    act(() =>
      notify?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(onShowMoreRecent).not.toHaveBeenCalled();
    act(() =>
      notify?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(container.querySelectorAll("[data-session-id]")).toHaveLength(15);
    expect(onShowMoreRecent).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalled();
    expect(
      container.querySelector(
        '[data-testid="app-sidebar-pagination-sentinel"]',
      ),
    ).toBeNull();
  });

  it("keeps the active project visible beyond the first five and active Recents beyond the first ten", () => {
    const projects = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index}`,
      name: `p${index}`,
    }));
    const { container } = mount({
      openedProjects: projects,
      recentSessions: [
        session("active-project-thread", { workspace_id: "p6" }),
      ],
      currentSessionId: "active-project-thread",
    });
    expect(
      container.querySelectorAll(
        '[data-testid="app-sidebar-project-conversation-group"]',
      ),
    ).toHaveLength(6);
    expect(
      container.querySelector('[data-session-id="active-project-thread"]'),
    ).not.toBeNull();
    act(() => root!.unmount());
    const next = mount({
      recentSessions: Array.from({ length: 15 }, (_, index) =>
        session(`r${index}`),
      ),
      currentSessionId: "r14",
    }).container;
    expect(next.querySelectorAll("[data-session-id]")).toHaveLength(11);
    expect(next.querySelector('[data-session-id="r14"]')).not.toBeNull();
  });

  it("persists collapse and keyboard section order without changing canonical membership", () => {
    const props = {
      recentSessions: [
        session("recent"),
        session("pin", { section: PINNED_THREAD_SECTION }),
      ],
    };
    const { container } = mount(props);
    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-sidebar-section="chats"] button[aria-expanded]',
    )!;
    act(() => {
      toggle.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowUp",
          altKey: true,
          bubbles: true,
        }),
      );
      toggle.click();
    });
    const sectionKeys = (element: HTMLElement) =>
      Array.from(element.querySelectorAll("[data-sidebar-section]")).map(
        (section) => section.getAttribute("data-sidebar-section"),
      );
    expect(sectionKeys(container)).toEqual(["threads", "chats", "pinned"]);
    expect(container.querySelector('[data-session-id="recent"]')).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-session-id="pin"]')).not.toBeNull();

    act(() => root!.unmount());
    const restored = mount(props).container;
    expect(sectionKeys(restored)).toEqual(["threads", "chats", "pinned"]);
    expect(restored.querySelector('[data-session-id="recent"]')).toBeNull();
    click(restored, '[data-sidebar-section="chats"] button[aria-expanded]');
    expect(restored.querySelector('[data-session-id="recent"]')).not.toBeNull();
  });

  it("accepts an internal section drop and ignores unknown section drag data", () => {
    const { container } = mount({ recentSessions: [session("recent")] });
    const target = container.querySelector(
      '[data-sidebar-section="chats"] button',
    )!.parentElement!.parentElement!;
    const transfer = {
      getData: vi.fn(() => "unknown-section"),
      types: ["application/x-sidebar-section"],
    };
    const drop = () => {
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        dataTransfer: { value: transfer },
        clientY: { value: 1 },
      });
      act(() => target.dispatchEvent(event));
    };
    drop();
    expect(
      Array.from(container.querySelectorAll("[data-sidebar-section]")).map(
        (section) => section.getAttribute("data-sidebar-section"),
      ),
    ).toEqual(["threads", "chats"]);
    transfer.getData.mockReturnValue("threads");
    drop();
    expect(
      Array.from(container.querySelectorAll("[data-sidebar-section]")).map(
        (section) => section.getAttribute("data-sidebar-section"),
      ),
    ).toEqual(["chats", "threads"]);
    expect(
      container.querySelector('[data-session-id="recent"]'),
    ).not.toBeNull();
  });
});
