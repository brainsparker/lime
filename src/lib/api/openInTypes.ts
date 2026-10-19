/** Electron owns application discovery, readiness, launch and persisted preference. */
export interface OpenInTarget {
  id: string;
  target: "systemDefault" | "fileManager";
  kind: "native" | "builtin";
  label: string;
  appPath?: string;
  bundleId?: string;
  available: boolean;
  icon: string | null;
}

export interface OpenInParams {
  cwd?: string | null;
  hostId?: string | null;
  path?: string | null;
  deferEnrichment?: boolean;
}

export interface OpenInTargetParams extends OpenInParams {
  target: OpenInTarget["target"];
  appPath?: string;
}

export interface OpenInTargets {
  targets: OpenInTarget[];
  availableTargets: string[];
  preferredTarget: string | null;
  mode: "native";
  discovery: "ready" | "unavailable" | "unsupported";
}

export interface OpenInRequest extends OpenInTargetParams {
  path: string;
  openMode?: "file" | "workspace";
  persistPreferredTargetPath?: string;
}

export interface OpenInTargetPreferences {
  global?: string;
  perPath?: Record<string, string>;
}
