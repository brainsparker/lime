import { useEffect, useRef } from "react";
import type { OemCloudBootstrapResponse } from "@/lib/api/oemCloudControlPlane";
import {
  cloudAccountIdentity,
  CloudAccountChangedError,
  getCloudAccount,
  getOemCloudBootstrapSnapshot,
  readCloudAccount,
  subscribeCloudAccount,
  type CloudAccountView,
} from "@/lib/cloudAccount";
import { OEM_CLOUD_OAUTH_COMPLETED_EVENT } from "@/lib/oemCloudDesktopAuth";

interface CloudAccountSyncOptions {
  setSession: (session: CloudAccountView["session"] | null) => void;
  setInitializing: (value: boolean) => void;
  clearView: () => void;
  applyBootstrap: (bootstrap: OemCloudBootstrapResponse) => void;
  refresh: (tenantId: string) => Promise<unknown>;
  loadCommerce: (tenantId: string) => Promise<unknown>;
  onError: (error: unknown) => void;
  onOAuthCompleted: () => void;
}

/** Restores and observes the shared account; component state is only a disposable view. */
export function useCloudAccountSync(options: CloudAccountSyncOptions): void {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    let disposed = false;
    let seen: string | null | undefined;
    let run = 0;
    const handleError = (error: unknown, ticket: number) => {
      if (
        !disposed &&
        ticket === run &&
        !(error instanceof CloudAccountChangedError)
      ) {
        latest.current.onError(error);
      }
    };
    const dispose = subscribeCloudAccount((view) => {
      if (disposed) return;
      const key = cloudAccountIdentity(view);
      if (key === seen) {
        latest.current.setSession(view?.session ?? null);
        return;
      }
      seen = key;
      const ticket = ++run;
      latest.current.clearView();
      latest.current.setSession(view?.session ?? null);
      if (!view) {
        latest.current.setInitializing(false);
        return;
      }
      latest.current.setInitializing(true);
      void latest.current
        .refresh(view.account.tenantId)
        .catch((error) => handleError(error, ticket))
        .finally(() => {
          if (!disposed && ticket === run)
            latest.current.setInitializing(false);
        });
    });
    void readCloudAccount().catch((error) => {
      handleError(error, run);
      if (!disposed) latest.current.setInitializing(false);
    });
    const oauthCompleted = () => {
      const view = getCloudAccount();
      const snapshot =
        getOemCloudBootstrapSnapshot<OemCloudBootstrapResponse>();
      if (!view || !snapshot) return;
      try {
        latest.current.applyBootstrap(snapshot);
        latest.current.onOAuthCompleted();
        const ticket = run;
        void latest.current
          .loadCommerce(view.account.tenantId)
          .catch((error) => handleError(error, ticket));
      } catch (error) {
        handleError(error, run);
      }
    };
    window.addEventListener(OEM_CLOUD_OAUTH_COMPLETED_EVENT, oauthCompleted);
    return () => {
      disposed = true;
      ++run;
      dispose();
      window.removeEventListener(
        OEM_CLOUD_OAUTH_COMPLETED_EVENT,
        oauthCompleted,
      );
    };
  }, []);
}
