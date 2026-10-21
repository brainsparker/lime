import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  fingerprintBuildInputs,
  RENDERER_SOURCE_DIRS,
  RENDERER_SOURCE_FILES,
} from "./electron-build-inputs.mjs";

const inputs = {
  sourceDirs: RENDERER_SOURCE_DIRS,
  sourceFiles: RENDERER_SOURCE_FILES,
};
const receiptPath = (rootDir) =>
  path.join(rootDir, ".lime", "electron-renderer-build.json");
const entryDigest = (rootDir) =>
  createHash("sha256")
    .update(readFileSync(path.join(rootDir, "dist", "index.html")))
    .digest("hex");

function writeReceipt(rootDir, receipt) {
  const filePath = receiptPath(rootDir);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(receipt, null, 2)}\n`);
}

export function beginRendererBuild(rootDir) {
  const build = {
    rootDir,
    input: fingerprintBuildInputs(rootDir, inputs),
    startedAt: new Date().toISOString(),
  };
  writeReceipt(rootDir, {
    version: 1,
    status: "building",
    input: build.input,
    startedAt: build.startedAt,
  });
  return build;
}

export function invalidateRendererBuild(build) {
  writeReceipt(build.rootDir, {
    version: 1,
    status: "invalid",
    input: build.input,
    startedAt: build.startedAt,
  });
}

export function completeRendererBuild(build) {
  try {
    const input = fingerprintBuildInputs(build.rootDir, inputs);
    if (input.sha256 !== build.input.sha256)
      throw new Error("Renderer build inputs changed during compilation");
    const receipt = {
      version: 1,
      status: "ready",
      input,
      entrySha256: entryDigest(build.rootDir),
      startedAt: build.startedAt,
      completedAt: new Date().toISOString(),
    };
    writeReceipt(build.rootDir, receipt);
    return receipt;
  } catch (error) {
    invalidateRendererBuild(build);
    throw error;
  }
}

export function inspectRendererBuildReceipt(rootDir) {
  try {
    const receipt = JSON.parse(readFileSync(receiptPath(rootDir), "utf8"));
    if (receipt.version !== 1 || receipt.status !== "ready")
      return { ready: false, reason: "unfinished-renderer-build" };
    const input = fingerprintBuildInputs(rootDir, inputs);
    if (receipt.input?.sha256 !== input.sha256)
      return { ready: false, reason: "renderer-input-mismatch" };
    if (receipt.entrySha256 !== entryDigest(rootDir))
      return { ready: false, reason: "renderer-entry-mismatch" };
    return { ready: true, input, entrySha256: receipt.entrySha256 };
  } catch {
    return { ready: false, reason: "missing-or-invalid-renderer-receipt" };
  }
}
