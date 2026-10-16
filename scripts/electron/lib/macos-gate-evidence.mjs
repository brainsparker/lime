import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export async function runMacOSGateWithEvidence(options, runGate) {
  try {
    return await runGate(options);
  } catch (error) {
    mkdirSync(options.evidenceDir, { recursive: true });
    writeFileSync(
      path.join(options.evidenceDir, "failure.json"),
      `${JSON.stringify(
        {
          result: "failed",
          candidateSha: options.candidateSha,
          candidateRunId: options.runId,
          arch: options.arch,
          failure: {
            message: error.message,
            status: error.status ?? null,
            signal: error.signal ?? null,
            stdout: String(error.stdout || ""),
            stderr: String(error.stderr || ""),
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    throw error;
  }
}
