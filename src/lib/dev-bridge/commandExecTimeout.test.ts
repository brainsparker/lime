import { describe, expect, it } from "vitest";
import { commandExecBridgeTimeout } from "./commandExecTimeout";
import { resolveBridgeRequestTimeoutMs } from "./http-client";
import { resolveAppServerRequestTimeoutMs } from "../../../electron/appServerRequestTimeout";

const args = (params: unknown, method = "command/exec") => ({
  request: { lines: [JSON.stringify({ id: 1, method, params })] },
});
describe("command/exec transport lifetime", () => {
  it("keeps unbounded interactive requests pending in Renderer and Host", () => {
    const params = { disableTimeout: true, tty: true, streamStdin: true };
    expect(
      resolveBridgeRequestTimeoutMs(
        "app_server_handle_json_lines",
        args(params),
      ),
    ).toBe(0);
    expect(
      resolveAppServerRequestTimeoutMs("command/exec", undefined, params),
    ).toBeUndefined();
  });
  it("waits for finite process expiry plus response grace without the old ten minute ceiling", () => {
    for (const timeoutMs of [0, 60_000, 900_000]) {
      const params = { timeoutMs };
      expect(
        resolveBridgeRequestTimeoutMs(
          "app_server_handle_json_lines",
          args(params),
        ),
      ).toBe(timeoutMs + 30_000);
      expect(
        resolveAppServerRequestTimeoutMs("command/exec", undefined, params),
      ).toBe(timeoutMs + 30_000);
    }
  });
  it("keeps unrelated requests bounded and leaves invalid requests to the server", () => {
    expect(
      commandExecBridgeTimeout({ request: { lines: ["bad json", "null"] } }),
    ).toBeNull();
    expect(
      resolveBridgeRequestTimeoutMs(
        "app_server_handle_json_lines",
        args({ disableTimeout: true }, "thread/read"),
      ),
    ).toBe(30_000);
    expect(
      resolveAppServerRequestTimeoutMs("thread/read", undefined, {
        disableTimeout: true,
      }),
    ).toBe(30_000);
    expect(commandExecBridgeTimeout(args({ timeoutMs: -1 }))).toBe(40_000);
    expect(
      commandExecBridgeTimeout({
        request: {
          lines: [
            JSON.stringify({
              method: "command/exec",
              params: { disableTimeout: true },
            }),
          ],
        },
      }),
    ).toBeNull();
  });
});
