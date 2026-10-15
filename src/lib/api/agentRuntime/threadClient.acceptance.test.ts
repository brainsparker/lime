import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AppServerRequestResult,
  TurnStartResponse,
} from "@limecloud/app-server-client";
import {
  createThreadClient,
  type AgentRuntimeAppServerClient,
  type AgentRuntimeLifecycleClient,
} from "./threadClient";
const { publishMock, rejectMock, logMock } = vi.hoisted(() => ({
  publishMock: vi.fn(),
  rejectMock: vi.fn(),
  logMock: vi.fn(),
}));
vi.mock("@/lib/agentDebug", () => ({ logAgentDebug: logMock }));
vi.mock("./appServerEventStream", () => ({
  AppServerAgentSessionEventDrainRouter: class {
    register() {
      return { publish: publishMock };
    }
  },
  publishAppServerAgentSessionNotifications: publishMock,
  publishAppServerRpcErrorNotifications: rejectMock,
  projectAppServerAgentEventPayload: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
function result(): AppServerRequestResult<TurnStartResponse> {
  const body: TurnStartResponse = {
    turn: { id: "turn-real", status: "inProgress" },
  };
  return {
    id: 1,
    result: body,
    response: { id: 1, result: body },
    notifications: [],
    messages: [],
  };
}
function setup() {
  const response = result();
  const startTurn = vi.fn().mockResolvedValue(response);
  const client = createThreadClient({
    appServerClient: {} as AgentRuntimeAppServerClient,
    standardRuntimeClient: {
      startTurn,
    } as unknown as AgentRuntimeLifecycleClient,
    isAppServerTurnLifecycleAvailable: () => true,
  });
  return { response, startTurn, client };
}
const request = {
  threadId: "thread-canonical",
  input: [{ type: "text" as const, text: "private draft" }],
};
describe("turn/start acceptance before notifications", () => {
  it("signals the real response before publish and returns the same result", async () => {
    const { client, response } = setup();
    const order: string[] = [];
    publishMock.mockImplementation(() => order.push("publish"));
    const accepted = vi.fn((actual) => {
      expect(actual).toBe(response);
      order.push("accepted");
    });
    await expect(
      client.submitAgentRuntimeTurn(request, accepted),
    ).resolves.toBe(response);
    expect(order).toEqual(["accepted", "publish"]);
    expect(accepted).toHaveBeenCalledTimes(1);
  });
  it("notification failure cannot withdraw accepted response", async () => {
    const { client, response } = setup();
    const accepted = vi.fn();
    publishMock.mockImplementation(() => {
      throw new Error("PRIVATE USER BODY");
    });
    await expect(
      client.submitAgentRuntimeTurn(request, accepted),
    ).resolves.toBe(response);
    expect(accepted).toHaveBeenCalledWith(response);
    expect(rejectMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledWith(
      "AgentRuntime",
      "acceptance.postProcessingFailed",
      { phase: "start_notifications", threadId: "thread-canonical" },
      { level: "error" },
    );
    expect(JSON.stringify(logMock.mock.calls)).not.toContain(
      "PRIVATE USER BODY",
    );
  });
  it("acceptance observer failure is diagnosed and notifications still publish", async () => {
    const { client, response } = setup();
    await expect(
      client.submitAgentRuntimeTurn(request, () => {
        throw new Error("private observer");
      }),
    ).resolves.toBe(response);
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(
      "AgentRuntime",
      "acceptance.postProcessingFailed",
      { phase: "start_callback", threadId: "thread-canonical" },
      { level: "error" },
    );
  });
  it.each([
    undefined,
    {},
    { result: {} },
    { result: { turn: { turnId: "legacy", status: "accepted" } } },
  ])("rejects unknown response %j without acceptance", async (unknown) => {
    const { client, startTurn } = setup();
    startTurn.mockResolvedValue(unknown);
    const accepted = vi.fn();
    await expect(
      client.submitAgentRuntimeTurn(request, accepted),
    ).rejects.toThrow();
    expect(accepted).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });
  it("preserves the original request rejection even when error notification throws", async () => {
    const { client, startTurn } = setup();
    const error = new Error("runtime rejected");
    const accepted = vi.fn();
    startTurn.mockRejectedValue(error);
    rejectMock.mockImplementation(() => {
      throw new Error("diagnostic failed");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await expect(client.submitAgentRuntimeTurn(request, accepted)).rejects.toBe(
      error,
    );
    expect(accepted).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "[AgentRuntime] turn/start rejection notification failed",
    );
    consoleError.mockRestore();
  });
});
