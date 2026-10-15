import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import {
  a,
  b,
  deferred,
  harness,
} from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import { useWorkspaceTopicSwitch } from "./useWorkspaceTopicSwitch";

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));
vi.mock("@/lib/api/appServer", () => ({ AppServerClient: vi.fn() }));
vi.mock("@/lib/agentDebug", () => ({ logAgentDebug: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const projectApi = vi.hoisted(() => ({ getProject: vi.fn() }));
vi.mock("@/lib/api/project", () => projectApi);

type HookProps = Parameters<typeof useWorkspaceTopicSwitch>[0];
type HookResult = ReturnType<typeof useWorkspaceTopicSwitch>;
let fixture: Awaited<ReturnType<typeof harness>> | null = null;
const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

function mount(props: HookProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let current!: HookResult;
  function Probe(next: HookProps) {
    current = useWorkspaceTopicSwitch(next);
    return null;
  }
  mounted.push({ root, container });
  const render = (next: HookProps) => {
    act(() => root.render(<Probe {...next} />));
  };
  render(props);
  return { get: () => current, render };
}

async function setup(overrides: Partial<HookProps> = {}) {
  fixture = await harness({ safeInvoke, safeListen });
  await fixture.coordinator.bindCommitted(a);
  fixture.controller.setText("source draft");
  let epoch = 7;
  const props: HookProps = {
    projectId: "w",
    originalSwitchTopic: vi.fn(async () => undefined),
    onBeforeTopicSwitch: vi.fn(),
    onAfterTopicSwitch: vi.fn(),
    composerDraftCoordinator: fixture.coordinator,
    getComposerDraftNavigationEpoch: () => epoch,
    startTopicProjectResolution: () => true,
    finishTopicProjectResolution: vi.fn(),
    deferTopicSwitch: vi.fn(),
    consumePendingTopicSwitch: () => null,
    rememberProjectId: vi.fn(),
    getRememberedProjectId: () => null,
    loadTopicBoundProjectId: () => "w",
    resetTopicLocalState: vi.fn(),
    ...overrides,
  };
  return {
    fixture,
    props,
    hook: mount(props),
    advanceEpoch: () => {
      epoch += 1;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  vi.useFakeTimers();
});
afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  await fixture?.close();
  fixture = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("topic navigation preserves the original editing source", () => {
  it("passes the start epoch after a successful original switch", async () => {
    const { hook, props } = await setup();
    await act(async () => {
      expect(await hook.get().switchTopic("next")).toBe("success");
    });
    expect(props.onAfterTopicSwitch).toHaveBeenCalledExactlyOnceWith(
      "next",
      "w",
      7,
    );
  });

  it.each(["switchTopic", "runTopicSwitch"] as const)(
    "%s cannot commit a late void result after an intended target changes",
    async (entry) => {
      const pending = deferred<undefined>();
      const {
        hook,
        props,
        advanceEpoch,
        fixture: h,
      } = await setup({
        originalSwitchTopic: () => pending.promise,
      });
      let completion!: Promise<unknown>;
      act(() => {
        completion = hook.get()[entry]("old");
      });
      advanceEpoch();
      h.controller.setText("new target remains editable");
      await act(async () => {
        pending.resolve(undefined);
        expect(await completion).toBe("superseded");
      });
      expect(props.onAfterTopicSwitch).not.toHaveBeenCalled();
      expect(props.resetTopicLocalState).not.toHaveBeenCalled();
      expect(h.controller.getDocument().text).toBe(
        "new target remains editable",
      );
    },
  );

  it("a committed new binding generation cancels an in-flight switch", async () => {
    const pending = deferred<undefined>();
    const {
      hook,
      props,
      fixture: h,
    } = await setup({
      originalSwitchTopic: () => pending.promise,
    });
    let completion!: Promise<unknown>;
    act(() => {
      completion = hook.get().switchTopic("old");
    });
    await h.coordinator.bindCommitted(b);
    h.controller.setText("B remains editable");
    await act(async () => {
      pending.resolve(undefined);
      expect(await completion).toBe("superseded");
    });
    expect(props.onAfterTopicSwitch).not.toHaveBeenCalled();
    expect(h.coordinator.getSnapshot().scope).toEqual(b);
    expect(h.controller.getDocument().text).toBe("B remains editable");
  });

  it("promotion changing scope within the same generation cancels completion", async () => {
    const pending = deferred<undefined>();
    const {
      hook,
      props,
      fixture: h,
    } = await setup({
      originalSwitchTopic: () => pending.promise,
    });
    const token = h.coordinator.captureBinding()!;
    let completion!: Promise<unknown>;
    act(() => {
      completion = hook.get().runTopicSwitch("old");
    });
    await h.coordinator.promote(
      token,
      { workspaceId: null, kind: "local", id: "actual" },
      { expectedTarget: null, sessionId: "actual" },
    );
    expect(h.coordinator.getSnapshot().generation).toBe(token.generation);
    await act(async () => {
      pending.resolve(undefined);
      expect(await completion).toBe("superseded");
    });
    expect(props.onAfterTopicSwitch).not.toHaveBeenCalled();
    expect(props.resetTopicLocalState).not.toHaveBeenCalled();
  });

  it("project resolution cannot capture a new source after the old one changes", async () => {
    const project = deferred<{ id: string; isArchived: boolean }>();
    projectApi.getProject.mockReturnValue(project.promise);
    const { hook, props, advanceEpoch } = await setup({
      loadTopicBoundProjectId: () => "other",
    });
    let completion!: Promise<unknown>;
    act(() => {
      completion = hook.get().switchTopic("old");
    });
    advanceEpoch();
    await act(async () => {
      project.resolve({ id: "other", isArchived: false });
      expect(await completion).toBe("superseded");
    });
    expect(props.deferTopicSwitch).not.toHaveBeenCalled();
    expect(props.originalSwitchTopic).not.toHaveBeenCalled();
    expect(props.onAfterTopicSwitch).not.toHaveBeenCalled();
  });

  it("deferred resume retains the original start epoch through completion", async () => {
    projectApi.getProject.mockResolvedValue({ id: "other", isArchived: false });
    const pending = deferred<undefined>();
    const { hook, props, advanceEpoch } = await setup({
      originalSwitchTopic: () => pending.promise,
      loadTopicBoundProjectId: () => "other",
    });
    await act(async () => {
      expect(await hook.get().switchTopic("old")).toBe("deferred");
    });
    const consume = vi.fn<HookProps["consumePendingTopicSwitch"]>();
    consume
      .mockReturnValueOnce({ topicId: "old", targetProjectId: "other" })
      .mockReturnValue(null);
    act(() => {
      hook.render({
        ...props,
        projectId: "other",
        consumePendingTopicSwitch: consume,
      });
    });
    advanceEpoch();
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    expect(props.onAfterTopicSwitch).not.toHaveBeenCalled();
    expect(props.resetTopicLocalState).not.toHaveBeenCalled();
  });

  it("a detached null binding becoming committed invalidates an older source", async () => {
    const pending = deferred<undefined>();
    const { hook, props } = await setup({
      composerDraftCoordinator: undefined,
      originalSwitchTopic: () => pending.promise,
    });
    let completion!: Promise<unknown>;
    act(() => {
      completion = hook.get().runTopicSwitch("old");
    });
    hook.render({ ...props, composerDraftCoordinator: fixture!.coordinator });
    await act(async () => {
      pending.resolve(undefined);
      expect(await completion).toBe("superseded");
    });
    expect(props.onAfterTopicSwitch).not.toHaveBeenCalled();
  });
});
