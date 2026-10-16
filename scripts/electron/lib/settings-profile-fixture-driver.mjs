import assert from "node:assert/strict";
import { invokeAppServerFromPage } from "../../agent-runtime/claw-chat-current-fixture-rpc.mjs";

/** Isolated fixture baseline, initialized through the public config boundary. */
export async function seedProfileFixture(page) {
  const initial = await invokeAppServerFromPage(page, "config/read", {
    includeLayers: true,
  });
  assert.ok(initial.result?.config);
  const profile = initial.result.config.user_profile ?? {};
  const response = await invokeAppServerFromPage(page, "config/batchWrite", {
    edits: [
      {
        keyPath: "user_profile",
        value: {
          ...profile,
          nickname: "Fixture baseline",
          bio: "Fixture baseline bio",
        },
        mergeStrategy: "replace",
      },
    ],
    expectedVersion: initial.result.layers[0].version,
    reloadUserConfig: true,
  });
  assert.equal(response.error, undefined);
  assert.ok(response.result?.version);
}
