import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import type { OpenInTarget, OpenInTargets } from "../src/lib/api/openInTypes";

export type NativeFileQuery = (
  args: Record<string, unknown>,
) => Promise<unknown>;
export type FileTargetPlatform = typeof process.platform;

/** Catalog entries describe supported shell operations, never installed apps. */
export async function discoverFileTargets(
  targetPath: string | null,
  platform: FileTargetPlatform,
  nativeQuery?: NativeFileQuery,
): Promise<Pick<OpenInTargets, "targets" | "discovery">> {
  const targets: OpenInTarget[] = [
    builtin("systemDefault", "Default application"),
    builtin(
      "fileManager",
      platform === "darwin"
        ? "Finder"
        : platform === "win32"
          ? "Explorer"
          : "File Manager",
    ),
  ];
  if (platform !== "darwin") return { targets, discovery: "unsupported" };
  if (!targetPath || !nativeQuery) return { targets, discovery: "unavailable" };
  try {
    const [handlers, defaultApp] = await Promise.all([
      nativeQuery({
        method: "launchServices.urlHandlers",
        params: { url: pathToFileURL(targetPath).href },
      }),
      nativeQuery({
        method: "launchServices.bundleIdentifier",
        params: { path: targetPath },
      }).catch(() => null),
    ]);
    if (!isRecord(handlers) || !Array.isArray(handlers.applications))
      throw new Error("Invalid native file handlers response");
    const seen = new Set<string>();
    const apps: OpenInTarget[] = [];
    for (const raw of handlers.applications) {
      if (
        !isRecord(raw) ||
        typeof raw.path !== "string" ||
        !path.isAbsolute(raw.path) ||
        !raw.path.endsWith(".app") ||
        typeof raw.bundleIdentifier !== "string"
      )
        throw new Error("Invalid native file handler");
      if (seen.has(raw.path)) continue;
      seen.add(raw.path);
      if (!(await stat(raw.path).catch(() => null))?.isDirectory()) continue;
      apps.push({
        id: `app:${raw.path}`,
        target: "systemDefault",
        kind: "native",
        label: path.basename(raw.path, ".app"),
        appPath: raw.path,
        bundleId: raw.bundleIdentifier,
        available: true,
        icon: null,
      });
    }
    const defaultPath = isRecord(defaultApp) ? defaultApp.path : null;
    const defaultIndex = apps.findIndex((app) => app.appPath === defaultPath);
    if (defaultIndex > 0) apps.unshift(...apps.splice(defaultIndex, 1));
    return { targets: [...apps, ...targets], discovery: "ready" };
  } catch {
    // The system-default marker remains valid; discovery readiness is separate.
    return { targets, discovery: "unavailable" };
  }
}

export function openMacFile(
  targetPath: string,
  appPath?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "/usr/bin/open",
      appPath ? ["-a", appPath, targetPath] : [targetPath],
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

function builtin(
  target: "systemDefault" | "fileManager",
  label: string,
): OpenInTarget {
  return {
    id: target,
    target,
    kind: "builtin",
    label,
    available: true,
    icon: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
