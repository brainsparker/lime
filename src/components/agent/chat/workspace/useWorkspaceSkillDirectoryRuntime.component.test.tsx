import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceSkillDirectoryRuntime } from "./useWorkspaceSkillDirectoryRuntime";

const mocks = vi.hoisted(() => ({
  loadSkills: vi.fn(),
  loadServices: vi.fn(),
  serviceOptions: vi.fn(),
}));
vi.mock("../hooks/useLimeSkills", () => ({
  useLimeSkills: () => ({
    skills: [],
    skillsLoading: false,
    refreshSkills: mocks.loadSkills,
  }),
}));
vi.mock("../service-skills/useServiceSkills", () => ({
  useServiceSkills: (options: unknown) => {
    mocks.serviceOptions(options);
    return {
      skills: [],
      groups: [],
      isLoading: false,
      error: null,
      refresh: mocks.loadServices,
      recordUsage: vi.fn(),
    };
  },
}));
vi.mock("./useWorkspaceEntrySideEffectsRuntime", () => ({
  useWorkspaceServiceSkillDirectoryToastRuntime: vi.fn(),
}));

const mounted: { root: Root; host: HTMLElement }[] = [];

function mountHook(
  initialParams: Parameters<typeof useWorkspaceSkillDirectoryRuntime>[0],
) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  let value: ReturnType<typeof useWorkspaceSkillDirectoryRuntime>;
  function Harness({
    params,
  }: {
    params: Parameters<typeof useWorkspaceSkillDirectoryRuntime>[0];
  }) {
    value = useWorkspaceSkillDirectoryRuntime(params);
    return null;
  }
  const rerender = (params = initialParams) =>
    act(() => root.render(<Harness params={params} />));
  rerender();
  return { getValue: () => value, rerender };
}

afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

describe("workspace canonical skill suggestions", () => {
  const params = {
    activeTheme: "general",
    autoLoadServiceSkills: false,
    shouldDeferWorkspaceAuxiliaryLoads: false,
  };
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
  });

  it("loads canonical skills once when suggestions open and keeps service launch independent", () => {
    const { getValue, rerender } = mountHook(params);
    act(() => {
      getValue().handleSkillSuggestionsNeeded();
      getValue().handleSkillSuggestionsNeeded();
    });
    expect(mocks.loadSkills).toHaveBeenCalledExactlyOnceWith(false);
    expect(mocks.loadServices).not.toHaveBeenCalled();
    rerender({ ...params, activeTheme: "other" });
    rerender(params);
    act(() => getValue().handleSkillSuggestionsNeeded());
    expect(mocks.loadSkills).toHaveBeenCalledTimes(1);
    expect(mocks.loadServices).not.toHaveBeenCalled();
  });

  it("explicit refresh loads once and prevents another automatic suggestion request", async () => {
    const { getValue } = mountHook(params);
    await act(async () => getValue().handleRefreshSkills());
    act(() => getValue().handleSkillSuggestionsNeeded());
    expect(mocks.loadSkills).toHaveBeenCalledExactlyOnceWith(true);
    expect(mocks.loadServices).not.toHaveBeenCalled();
    expect(mocks.serviceOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, autoLoad: false }),
    );
  });
});
