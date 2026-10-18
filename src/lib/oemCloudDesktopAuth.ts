import {
  getClientBootstrap,
  type OemCloudBootstrapResponse,
} from "@/lib/api/oemCloudControlPlane";
import {
  DEFAULT_OEM_CLOUD_DESKTOP_OAUTH_NEXT_PATH,
  resolveOemCloudRuntimeContext,
} from "@/lib/api/oemCloudRuntime";
import {
  setOemCloudBootstrapSnapshot,
  importCloudAccount,
  updateCloudSessionView,
} from "@/lib/cloudAccount";
import { syncSkillCatalogFromBootstrapPayload } from "@/lib/skillCatalogBootstrap";
import { syncServiceSkillCatalogFromBootstrapPayload } from "@/lib/serviceSkillCatalogBootstrap";

export const OEM_CLOUD_OAUTH_COMPLETED_EVENT = "lime:oem-cloud-oauth-completed";

export interface OemCloudDesktopOAuthCallbackPayload {
  tenantId: string | null;
  token: string | null;
  nextPath: string;
  error: string | null;
}

export interface OemCloudDesktopOAuthCompletedDetail {
  tenantId: string;
  nextPath: string;
  provider: "google";
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeAppPath(value: unknown, fallback: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return fallback;
  }

  if (normalized === "/") {
    return normalized;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function parseOemCloudDesktopOAuthCallbackUrl(
  value: string,
): OemCloudDesktopOAuthCallbackPayload | null {
  try {
    const parsed = new URL(value);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
    if (
      parsed.protocol !== "lime:" ||
      parsed.hostname !== "oauth" ||
      normalizedPath !== "/callback"
    ) {
      return null;
    }

    return {
      tenantId: normalizeText(parsed.searchParams.get("tenantId")),
      token: normalizeText(parsed.searchParams.get("token")),
      nextPath: normalizeAppPath(
        parsed.searchParams.get("next"),
        DEFAULT_OEM_CLOUD_DESKTOP_OAUTH_NEXT_PATH,
      ),
      error: normalizeText(parsed.searchParams.get("error")),
    };
  } catch {
    return null;
  }
}

export function dispatchOemCloudOAuthCompleted(
  detail: OemCloudDesktopOAuthCompletedDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OemCloudDesktopOAuthCompletedDetail>(
      OEM_CLOUD_OAUTH_COMPLETED_EVENT,
      {
        detail,
      },
    ),
  );
}

export async function completeOemCloudDesktopOAuthLogin(
  payload: OemCloudDesktopOAuthCallbackPayload,
): Promise<OemCloudBootstrapResponse> {
  if (!payload.tenantId || !payload.token) {
    throw new Error("桌面 OAuth 回调缺少 tenantId 或 token");
  }

  const runtime = resolveOemCloudRuntimeContext();
  if (!runtime) throw new Error("云端登录配置不可用");
  await importCloudAccount({
    baseUrl: runtime.baseUrl,
    tenantId: payload.tenantId,
    accessToken: payload.token,
  });
  const bootstrap = await getClientBootstrap(payload.tenantId);
  updateCloudSessionView(bootstrap.session);
  setOemCloudBootstrapSnapshot(bootstrap);
  syncSkillCatalogFromBootstrapPayload(bootstrap);
  syncServiceSkillCatalogFromBootstrapPayload(bootstrap);
  dispatchOemCloudOAuthCompleted({
    tenantId: payload.tenantId,
    nextPath: payload.nextPath,
    provider: "google",
  });
  return bootstrap;
}
