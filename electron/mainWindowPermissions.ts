import type { Session, WebContents } from "electron";

type MainWindowPermissionDetails = {
  isMainFrame?: boolean;
  mediaTypes?: string[];
  mediaType?: string;
};

interface InstallMainWindowPermissionHandlersArgs {
  session: Pick<
    Session,
    "setPermissionRequestHandler" | "setPermissionCheckHandler"
  >;
  getMainWindow: () => { webContents: Pick<WebContents, "id"> } | null;
}

export function shouldAllowMainWindowPermission({
  mainWebContents,
  requestWebContents,
  permission,
  details,
}: {
  mainWebContents: Pick<WebContents, "id"> | null;
  requestWebContents: Pick<WebContents, "id"> | null;
  permission: string;
  details?: MainWindowPermissionDetails;
}): boolean {
  if (
    !mainWebContents ||
    !requestWebContents ||
    requestWebContents.id !== mainWebContents.id
  ) {
    return false;
  }

  if (permission === "clipboard-sanitized-write") {
    return details?.isMainFrame === true;
  }
  if (
    permission === "microphone" ||
    permission === "audioCapture" ||
    permission === "camera" ||
    permission === "videoCapture"
  ) {
    return true;
  }
  if (permission !== "media") {
    return false;
  }

  // request 使用 mediaTypes，check 使用 mediaType；两者沿用同一媒体白名单。
  const mediaTypes =
    details?.mediaTypes ?? (details?.mediaType ? [details.mediaType] : []);
  return (
    mediaTypes.length > 0 &&
    mediaTypes.every(
      (mediaType) => mediaType === "audio" || mediaType === "video",
    )
  );
}

export function installMainWindowPermissionHandlers({
  session,
  getMainWindow,
}: InstallMainWindowPermissionHandlersArgs): void {
  session.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      callback(
        shouldAllowMainWindowPermission({
          mainWebContents: getMainWindow()?.webContents ?? null,
          requestWebContents: webContents,
          permission,
          details,
        }),
      );
    },
  );
  session.setPermissionCheckHandler(
    (webContents, permission, _requestingOrigin, details) =>
      shouldAllowMainWindowPermission({
        mainWebContents: getMainWindow()?.webContents ?? null,
        requestWebContents: webContents,
        permission,
        details,
      }),
  );
}
