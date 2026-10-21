import type {
  DesktopConfig,
  ExternalBrowserLinkShortcut,
  LinkOpenTarget,
} from "./api/appConfigTypes";
import { effectiveDesktopPreferences } from "./api/desktopPreferences";

export type LinkDisposition = "new-tab" | "new-background-tab";
export interface LinkClick {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

const localHosts = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "::1",
]);

export function isLocalLinkHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return localHosts.has(host) || host.endsWith(".localhost");
}

export function isLocalLink(url: URL): boolean {
  if (url.protocol === "http:" || url.protocol === "https:")
    return isLocalLinkHostname(url.hostname);
  if (
    url.protocol !== "file:" ||
    (url.hostname && url.hostname.toLowerCase() !== "localhost")
  )
    return false;
  let path = url.pathname.replace(/\\/g, "/").replace(/^\/{3,}/, "//");
  if (/^\/[A-Za-z]:[\\/]/.test(path)) path = path.slice(1);
  return /^[A-Za-z]:[\\/]/.test(path) || !/^\/\/[^/]+\/[^/]+/.test(path);
}

export function readLinkClickIntent(event: LinkClick = {}, platform = "") {
  const primary = /Mac|iPhone|iPad|iPod/.test(platform)
    ? event.metaKey
    : event.ctrlKey;
  let clickModifiers:
    | Exclude<ExternalBrowserLinkShortcut, "unassigned">
    | undefined;
  if (event.button == null || event.button === 0) {
    if (primary && !event.altKey && !(event.ctrlKey && event.metaKey))
      clickModifiers = event.shiftKey ? "primary-shift" : "primary";
    else if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    )
      clickModifiers = "alt";
  }
  const disposition: LinkDisposition | undefined =
    primary || event.button === 1
      ? event.shiftKey
        ? "new-tab"
        : "new-background-tab"
      : undefined;
  return { clickModifiers, disposition };
}

export function resolveLinkOpening({
  url,
  preferences,
  browserAvailable,
  click,
  platform,
  openTarget,
  disposition,
  useExternalBrowser = false,
  isDefaultBrowser = false,
}: {
  url: string;
  preferences?: DesktopConfig;
  browserAvailable: boolean;
  click?: LinkClick;
  platform?: string;
  openTarget?: LinkOpenTarget;
  disposition?: LinkDisposition;
  useExternalBrowser?: boolean;
  isDefaultBrowser?: boolean;
}): { target: LinkOpenTarget; disposition?: LinkDisposition } | null {
  if (click?.button != null && click.button !== 0 && click.button !== 1)
    return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const web = parsed.protocol === "http:" || parsed.protocol === "https:";
  if (!web && parsed.protocol !== "file:") return null;
  const settings = effectiveDesktopPreferences(preferences);
  const intent = readLinkClickIntent(click, platform);
  const shortcut =
    openTarget == null &&
    !useExternalBrowser &&
    !isDefaultBrowser &&
    web &&
    intent.clickModifiers != null &&
    intent.clickModifiers === settings["external-browser-link-shortcut"];
  const nextDisposition = intent.disposition ?? disposition;
  const explicit =
    openTarget ??
    (shortcut ? "external-browser" : undefined) ??
    (nextDisposition || (isDefaultBrowser && web)
      ? "in-app-browser"
      : undefined);
  const preference =
    explicit ??
    settings[
      isLocalLink(parsed)
        ? "open-local-url-in-target-preference"
        : "open-link-in-target-preference"
    ];
  return {
    target:
      !useExternalBrowser &&
      browserAvailable &&
      preference === "in-app-browser" &&
      (web || isLocalLink(parsed))
        ? "in-app-browser"
        : "external-browser",
    ...(nextDisposition ? { disposition: nextDisposition } : {}),
  };
}

export function externalBrowserUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol === "https:" && parsed.hostname === "chatgpt.com") {
    parsed.searchParams.set("no_universal_links", "1");
    return parsed.href;
  }
  return url;
}
