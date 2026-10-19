import type { CloudAccountView } from "@/lib/cloudAccount";
import type { OemCloudBootstrapResponse } from "@/lib/api/oemCloudControlPlane";

export function resolveAccountDisplayName(
  sessionState: CloudAccountView | null,
  fallbackDisplayName: string,
): string {
  const user = sessionState?.session.user;
  const fallbackEmailName = user?.email?.split("@")[0]?.trim();
  return (
    user?.displayName?.trim() ||
    user?.username?.trim() ||
    fallbackEmailName ||
    fallbackDisplayName
  );
}

export function resolveAccountInitial(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    return "L";
  }

  return normalized.slice(0, 1).toUpperCase();
}

export function resolveCloudBrandLabel(
  bootstrap: OemCloudBootstrapResponse | null,
  fallbackBrandLabel: string,
  cloudSuffixLabel: string,
): string {
  const appName = bootstrap?.app?.name?.trim();
  if (!appName) {
    return fallbackBrandLabel;
  }

  return /云|Cloud|Hub/i.test(appName)
    ? appName
    : `${appName} ${cloudSuffixLabel}`;
}
