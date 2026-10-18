import { loginAccount, logoutAccount, readAccount } from "./api/account";
import { subscribeAppServerNotifications } from "./api/appServerEventBus";
import type { AppServerAccount } from "./api/appServerTypes";
import type { OemCloudCurrentSession } from "./api/oemCloudControlPlaneTypes";
import { cacheOemCloudReferralStateFromBootstrap } from "./oemCloudReferralCache";

export const OEM_CLOUD_BOOTSTRAP_CHANGED_EVENT =
  "lime:oem-cloud-bootstrap-changed";

export interface CloudAccountView {
  account: Extract<AppServerAccount, { type: "cloud" }>;
  session: Omit<OemCloudCurrentSession, "token">;
}

let current: CloudAccountView | null = null;
let revision = 0;
let bootstrap: unknown = null;
let unwatch: (() => void) | null = null;
const listeners = new Set<(view: CloudAccountView | null) => void>();

export function cloudAccountIdentity(
  view: Pick<CloudAccountView, "account"> | null,
) {
  return view
    ? JSON.stringify([
        view.account.baseUrl,
        view.account.tenantId,
        view.account.userId,
        view.account.sessionId,
      ])
    : null;
}

function publish(view: CloudAccountView | null) {
  if (JSON.stringify(current) === JSON.stringify(view)) return;
  const identityChanged =
    cloudAccountIdentity(current) !== cloudAccountIdentity(view);
  current = view;
  if (identityChanged) clearOemCloudBootstrapSnapshot();
  for (const listener of listeners) listener(current);
}

function project(account: CloudAccountView["account"]): CloudAccountView {
  const same =
    cloudAccountIdentity(current) === cloudAccountIdentity({ account });
  return {
    account,
    session:
      same && current
        ? current.session
        : {
            tenant: {
              id: account.tenantId,
              name: account.tenantId,
              slug: account.tenantId,
            },
            user: {
              id: account.userId,
              email: account.email ?? "",
              displayName: account.displayName ?? account.userId,
              passwordConfigured: false,
              roles: [],
            },
            session: {
              id: account.sessionId,
              tenantId: account.tenantId,
              userId: account.userId,
              provider: "",
              roles: [],
              issuedAt: "",
              expiresAt: account.expiresAt ?? "",
            },
          },
  };
}

/** A view of the shared App Server account; this module never stores credentials. */
export function getCloudAccount(): CloudAccountView | null {
  return current;
}

export async function readCloudAccount(): Promise<CloudAccountView | null> {
  const ticket = ++revision;
  const { account } = await readAccount();
  if (ticket === revision)
    publish(account?.type === "cloud" ? project(account) : null);
  return current;
}

export async function importCloudAccount(params: {
  baseUrl: string;
  tenantId: string;
  accessToken: string;
}) {
  ++revision;
  await loginAccount({ type: "cloudAuthTokens", ...params });
  return await readCloudAccount();
}

export async function logoutCloudAccount(): Promise<void> {
  ++revision;
  await logoutAccount();
  await readCloudAccount();
}

/** Rich profile fields are a disposable projection of the same verified account identity. */
export function updateCloudSessionView(session: OemCloudCurrentSession): void {
  if (
    !current ||
    current.account.tenantId !== session.tenant.id ||
    current.account.userId !== session.user.id ||
    current.account.sessionId !== session.session.id
  ) {
    throw new Error(
      "cloud session projection identity does not match the shared account",
    );
  }
  const { token: _credential, ...metadata } = session;
  void _credential;
  publish({ account: current.account, session: metadata });
}

export function subscribeCloudAccount(
  listener: (view: CloudAccountView | null) => void,
): () => void {
  listeners.add(listener);
  listener(current);
  if (!unwatch) {
    const refresh = () => {
      void readCloudAccount().catch(() => undefined);
    };
    const dispose = subscribeAppServerNotifications({
      onNotifications: (notifications) => {
        if (
          notifications.some(
            (notification) => notification.method === "account/updated",
          )
        )
          refresh();
      },
    });
    if (typeof window !== "undefined")
      window.addEventListener("focus", refresh);
    unwatch = () => {
      dispose();
      if (typeof window !== "undefined")
        window.removeEventListener("focus", refresh);
    };
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unwatch?.();
      unwatch = null;
    }
  };
}

function emitBootstrapChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OEM_CLOUD_BOOTSTRAP_CHANGED_EVENT, {
      detail: { hasBootstrap: bootstrap != null },
    }),
  );
}

export function setOemCloudBootstrapSnapshot(payload: unknown): void {
  if (
    payload &&
    typeof payload === "object" &&
    "session" in payload &&
    payload.session &&
    typeof payload.session === "object"
  ) {
    const value = payload as { session: OemCloudCurrentSession };
    const { token: _credential, ...metadata } = value.session;
    void _credential;
    bootstrap = { ...value, session: metadata };
  } else {
    bootstrap = payload;
  }
  if (bootstrap) cacheOemCloudReferralStateFromBootstrap(bootstrap);
  emitBootstrapChanged();
}

export function getOemCloudBootstrapSnapshot<T = unknown>(): T | null {
  return bootstrap as T | null;
}

export function clearOemCloudBootstrapSnapshot(): void {
  bootstrap = null;
  emitBootstrapChanged();
}

export function subscribeOemCloudBootstrapChanged(
  listener: (payload: unknown) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handle = () => listener(bootstrap);
  window.addEventListener(OEM_CLOUD_BOOTSTRAP_CHANGED_EVENT, handle);
  return () =>
    window.removeEventListener(OEM_CLOUD_BOOTSTRAP_CHANGED_EVENT, handle);
}

export class CloudAccountChangedError extends Error {
  constructor() {
    super("cloud account changed while a request was in flight");
  }
}
