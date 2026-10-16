import { execFile } from "node:child_process";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { notarize } from "@electron/notarize";

const run = promisify(execFile);
const retryDelays = [15_000, 30_000, 60_000, 120_000, 120_000];

function isTransientStapleError(error) {
  const output = `${error.message}\n${error.stdout || ""}\n${error.stderr || ""}`;
  return (
    /Failed to staple your application with code: 68|staple and validate action failed! Error 68/u.test(
      output,
    ) &&
    /NSURLErrorDomain|CloudKit's response is inconsistent|HTTPError\(statusCode: nil/u.test(
      output,
    )
  );
}

export async function notarizeMacApp(
  appPath,
  credentials,
  {
    notarizeImpl = notarize,
    runImpl = run,
    sleep = setTimeout,
    log = console.log,
  } = {},
) {
  try {
    await notarizeImpl({ appPath, ...credentials });
  } catch (error) {
    // A staple failure occurs after Apple's Accepted response. Keep that signed
    // bundle and ticket instead of rebuilding, re-signing and submitting again.
    if (!isTransientStapleError(error)) throw error;
    for (const [index, delay] of retryDelays.entries()) {
      log(
        `Apple ticket delivery unavailable; retrying staple ${index + 1}/${retryDelays.length} in ${delay / 1000}s`,
      );
      await sleep(delay);
      try {
        await runImpl("xcrun", ["stapler", "staple", "-v", appPath], {
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        });
        break;
      } catch (stapleError) {
        if (
          !isTransientStapleError(stapleError) ||
          index === retryDelays.length - 1
        ) {
          throw stapleError;
        }
      }
    }
  }
  await runImpl("xcrun", ["stapler", "validate", appPath], {
    timeout: 60_000,
  });
}

export async function notarizeMacPackages(
  { platform, outputPaths },
  credentials,
  { notarizeImpl = notarizeMacApp } = {},
) {
  if (platform !== "darwin" || !credentials) return;
  if (outputPaths.length === 0)
    throw new Error("No signed macOS package to notarize");
  for (const outputPath of outputPaths) {
    await notarizeImpl(path.join(outputPath, "Lime.app"), credentials);
  }
}
