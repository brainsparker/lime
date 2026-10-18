import { expect, it } from "vitest";
import { invokeArgsPreview } from "./invokeDiagnostics";

it("keeps account import credentials out of JSONL diagnostic persistence", () => {
  const secret = 'short-"credential';
  const request = {
    jsonrpc: "2.0",
    id: 7,
    method: "account/login/start",
    params: {
      type: "cloudAuthTokens",
      accessToken: secret,
      unknownSecret: secret,
    },
  };
  const preview = invokeArgsPreview("app_server_handle_json_lines", {
    request: { lines: [JSON.stringify(request)] },
  });
  expect(preview).toEqual({
    request: {
      lines: [
        JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "account/login/start",
          params: { type: "cloudAuthTokens" },
        }),
      ],
    },
  });
  expect(JSON.stringify(preview)).not.toContain("credential");
  expect(
    invokeArgsPreview("app_server_handle_json_lines", {
      request: { lines: ['{"accessToken":"broken-secret"'] },
    }),
  ).toEqual({ request: { lines: ["[invalid JSON-RPC]"] } });
});
