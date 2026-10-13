import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProtocolSkillEnabled } from "./useProtocolSkillEnabled";

const hoisted = vi.hoisted(() => ({
  listProtocolSkillEnabledStates: vi.fn(),
  subscribeAppServerNotifications: vi.fn(() => () => undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/skillConfig", () => ({
  listProtocolSkillEnabledStates: () =>
    hoisted.listProtocolSkillEnabledStates(),
  matchProtocolSkillEnabledState: () => null,
  writeProtocolSkillEnabled: vi.fn(),
}));

vi.mock("@/lib/api/appServerEventBus", () => ({
  subscribeAppServerNotifications: (
    ...args: Parameters<typeof hoisted.subscribeAppServerNotifications>
  ) => hoisted.subscribeAppServerNotifications(...args),
}));

function Probe() {
  const { protocolSkillEnabledStates } = useProtocolSkillEnabled();
  return (
    <div data-testid="protocol-skill-enabled-states">
      {protocolSkillEnabledStates.map((item) => item.path).join(",")}
    </div>
  );
}

describe("useProtocolSkillEnabled", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    hoisted.listProtocolSkillEnabledStates.mockReset();
    hoisted.subscribeAppServerNotifications.mockClear();
  });

  function renderProbe() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });
  }

  it("skills/changed 会重读启停状态，畸形通知不触发", async () => {
    hoisted.listProtocolSkillEnabledStates
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { path: "/skills/writer/SKILL.md", enabled: false },
      ]);
    renderProbe();
    await act(async () => {
      await Promise.resolve();
    });

    expect(hoisted.subscribeAppServerNotifications).toHaveBeenCalledTimes(1);
    const subscription = hoisted.subscribeAppServerNotifications.mock
      .calls[0]?.[0] as {
      onNotifications?: (notifications: unknown[]) => void;
    };

    act(() => {
      subscription.onNotifications?.([
        { method: "skills/changed", params: { path: "/skills/writer" } },
      ]);
    });
    expect(hoisted.listProtocolSkillEnabledStates).toHaveBeenCalledTimes(1);

    await act(async () => {
      subscription.onNotifications?.([
        { method: "skills/changed", params: {} },
      ]);
      await Promise.resolve();
    });

    expect(hoisted.listProtocolSkillEnabledStates).toHaveBeenCalledTimes(2);
    expect(
      container.querySelector('[data-testid="protocol-skill-enabled-states"]')
        ?.textContent,
    ).toBe("/skills/writer/SKILL.md");
  });
});
