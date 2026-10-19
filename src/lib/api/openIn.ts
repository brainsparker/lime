import { safeInvoke } from "@/lib/dev-bridge";
import { assertNotDiagnosticFacade } from "./diagnosticFacade";
import { assertEmptyElectronHostResult } from "./electronHostResult";
import type {
  OpenInParams,
  OpenInRequest,
  OpenInTarget,
  OpenInTargetParams,
  OpenInTargets,
} from "./openInTypes";

export const openIn = {
  async getTargets(params: OpenInParams): Promise<OpenInTargets> {
    const value = await invoke("open_in_get_targets", params);
    if (
      !record(value) ||
      !Array.isArray(value.targets) ||
      !value.targets.every(isTarget)
    )
      throw new Error("Invalid open-in targets response");
    const targets = value.targets;
    if (
      !Array.isArray(value.availableTargets) ||
      !value.availableTargets.every(
        (id) =>
          typeof id === "string" &&
          targets.some((target) => target.id === id && target.available),
      ) ||
      !(
        value.preferredTarget === null ||
        (typeof value.preferredTarget === "string" &&
          targets.some(
            (target) => target.id === value.preferredTarget && target.available,
          ))
      ) ||
      value.mode !== "native" ||
      (value.discovery !== "ready" &&
        value.discovery !== "unavailable" &&
        value.discovery !== "unsupported")
    )
      throw new Error("Invalid open-in targets response");
    return value as unknown as OpenInTargets;
  },
  async detectTarget(params: OpenInTargetParams): Promise<OpenInTarget | null> {
    const value = await invoke("open_in_detect_target", params);
    if (value !== null && !isTarget(value))
      throw new Error("Invalid open-in target response");
    return value;
  },
  async loadTargetIcon(params: OpenInTargetParams): Promise<string | null> {
    const value = await invoke("open_in_load_target_icon", params);
    if (
      value !== null &&
      (typeof value !== "string" || !value.startsWith("data:image/"))
    )
      throw new Error("Invalid open-in target icon");
    return value as string | null;
  },
  async open(params: OpenInRequest): Promise<void> {
    const command = "open_in_open";
    assertEmptyElectronHostResult(command, await invoke(command, params));
  },
  async setGlobalPreferredTarget(params: OpenInTargetParams): Promise<void> {
    const command = "open_in_set_global_preferred_target";
    assertEmptyElectronHostResult(command, await invoke(command, params));
  },
};

async function invoke(command: string, params: object): Promise<unknown> {
  const value = await safeInvoke(command, { ...params });
  assertNotDiagnosticFacade(command, value, "真实文件壳 current 通道");
  return value;
}

function record(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isTarget(value: unknown): value is OpenInTarget {
  return (
    record(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    (value.target === "systemDefault" || value.target === "fileManager") &&
    (value.kind === "native" || value.kind === "builtin") &&
    typeof value.label === "string" &&
    value.label.length > 0 &&
    typeof value.available === "boolean" &&
    (value.icon === null ||
      (typeof value.icon === "string" &&
        value.icon.startsWith("data:image/"))) &&
    (value.kind === "native"
      ? typeof value.appPath === "string" &&
        value.id === `app:${value.appPath}` &&
        value.target === "systemDefault"
      : value.appPath == null && value.id === value.target)
  );
}
