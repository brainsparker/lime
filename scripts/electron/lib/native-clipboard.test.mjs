import assert from "node:assert/strict";
import { test } from "node:test";
import { withNativeClipboard } from "./native-clipboard.mjs";

function fixture({ unsupported = false, restoreFails = false } = {}) {
  const original = [
    [
      { type: "public.html", data: "PGI+Zml4dHVyZTwvYj4=" },
      { type: "public.utf8-plain-text", data: "Zml4dHVyZQ==" },
    ],
    [{ type: "public.rtf", data: "e1xydGYxIGZpeHR1cmV9" }],
  ];
  let data = structuredClone(original);
  const calls = [];
  return {
    original,
    app: {
      evaluate: (callback) =>
        callback({
          clipboard: {
            availableFormats: () =>
              unsupported ? ["application/x-unknown"] : ["text/html"],
          },
        }),
    },
    native: async (operation, backup) => {
      calls.push(operation);
      if (operation === "read") return structuredClone(data);
      if (restoreFails) return false;
      data = structuredClone(backup);
      return true;
    },
    mutate: () => {
      data = [[{ type: "public.utf8-plain-text", data: "Y29udHJvbGxlZA==" }]];
    },
    snapshot: () => structuredClone(data),
    calls,
  };
}

test("native owner restores every raw item and type without HTML normalization", async () => {
  const f = fixture();
  const value = await withNativeClipboard(
    f.app,
    async () => {
      f.mutate();
      return "completed";
    },
    { platform: "darwin", native: f.native },
  );
  assert.equal(value, "completed");
  assert.deepEqual(f.snapshot(), f.original);
  assert.deepEqual(f.calls, ["read", "restore"]);
});

test("unsupported format and failed snapshot both refuse mutation", async () => {
  for (const unavailable of [false, true]) {
    const f = fixture({ unsupported: !unavailable });
    let performed = false;
    const native = unavailable
      ? async () => {
          throw new Error("snapshot unavailable");
        }
      : f.native;
    await assert.rejects(
      withNativeClipboard(
        f.app,
        () => {
          performed = true;
        },
        { platform: "darwin", native },
      ),
      unavailable ? /snapshot unavailable/ : /unsupported formats/,
    );
    assert.equal(performed, false);
    assert.deepEqual(f.snapshot(), f.original);
    assert.deepEqual(f.calls, []);
  }
});

test("scenario rejection is preserved after successful raw restoration", async () => {
  const f = fixture(),
    failure = new Error("scenario failed");
  await assert.rejects(
    withNativeClipboard(
      f.app,
      () => {
        f.mutate();
        throw failure;
      },
      { platform: "darwin", native: f.native },
    ),
    (error) => error === failure,
  );
  assert.deepEqual(f.snapshot(), f.original);
});

test("a false restore result cannot pass a successful scenario", async () => {
  const f = fixture({ restoreFails: true });
  await assert.rejects(
    withNativeClipboard(f.app, () => f.mutate(), {
      platform: "darwin",
      native: f.native,
    }),
    /native clipboard restoration failed/,
  );
});

test("restore failure retains the primary error, including falsy rejection", async () => {
  for (const failure of [new Error("scenario failed"), null]) {
    const f = fixture({ restoreFails: true });
    await assert.rejects(
      withNativeClipboard(
        f.app,
        () => {
          throw failure;
        },
        { platform: "darwin", native: f.native },
      ),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors[0], failure);
        assert.match(
          error.errors[1].message,
          /native clipboard restoration failed/,
        );
        return true;
      },
    );
  }
});

test("non-macOS restoration also retains both failures", async () => {
  let reads = 0;
  const failure = new Error("scenario failed");
  const app = {
    evaluate: async () => (++reads === 1 ? { formats: [], data: {} } : false),
  };
  await assert.rejects(
    withNativeClipboard(
      app,
      () => {
        throw failure;
      },
      { platform: "win32" },
    ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors[0], failure);
      assert.match(
        error.errors[1].message,
        /native clipboard restoration failed/,
      );
      return true;
    },
  );
});
