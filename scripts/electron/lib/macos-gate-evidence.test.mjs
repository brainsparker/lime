import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runMacOSGateWithEvidence } from "./macos-gate-evidence.mjs";

describe("macOS packaged failure evidence", () => {
  it("retains preflight diagnostics and candidate identity while propagating failure", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "macos-gate-evidence-"));
    const options = {
      evidenceDir: path.join(root, "gate"),
      candidateSha: "a".repeat(40),
      runId: "release-1-2-darwin-x64",
      arch: "x64",
    };
    const error = Object.assign(new Error("stapler failed"), {
      status: 68,
      stdout: Buffer.from("CloudKit unavailable"),
      stderr: Buffer.from("native diagnostics"),
    });
    try {
      await expect(
        runMacOSGateWithEvidence(options, async () => {
          throw error;
        }),
      ).rejects.toBe(error);
      expect(
        JSON.parse(
          readFileSync(path.join(options.evidenceDir, "failure.json"), "utf8"),
        ),
      ).toMatchObject({
        result: "failed",
        candidateSha: options.candidateSha,
        candidateRunId: options.runId,
        arch: "x64",
        failure: {
          status: 68,
          stdout: "CloudKit unavailable",
          stderr: "native diagnostics",
        },
      });
      expect(existsSync(path.join(options.evidenceDir, "summary.json"))).toBe(
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves successful Gate B evidence unchanged", async () => {
    const result = {
      summary: { result: "passed" },
      summaryPath: "/summary.json",
    };
    await expect(
      runMacOSGateWithEvidence({}, async () => result),
    ).resolves.toBe(result);
  });
});
