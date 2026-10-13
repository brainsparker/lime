import { describe, expect, it } from "vitest";
import { frontendTestArgs } from "../local-ci.mjs";

function state(statuses) {
  return {
    schema_version: 1,
    runner: "vitest-smart",
    batches: statuses.map((status, index) => ({ index: index + 1, status })),
  };
}

describe("local CI frontend continuation", () => {
  it.each(["failed", "interrupted", "running", "pending"])(
    "resumes %s work without discarding passed batches",
    (status) => {
      const snapshot = state(["passed", status, "pending"]);
      const before = structuredClone(snapshot);
      expect(frontendTestArgs(snapshot)).toEqual(["test", "--", "--resume"]);
      expect(snapshot).toEqual(before);
    },
  );

  it("starts a fresh run when there is no unfinished batch", () => {
    expect(frontendTestArgs(null)).toEqual(["test"]);
    expect(frontendTestArgs(state(["passed", "skipped"]))).toEqual(["test"]);
  });

  it("rejects invalid state instead of silently replacing continuation evidence", () => {
    expect(() => frontendTestArgs({ batches: [] })).toThrow("续跑状态无效");
    expect(() =>
      frontendTestArgs({ ...state(["pending"]), schema_version: 2 }),
    ).toThrow("续跑状态无效");
  });
});
