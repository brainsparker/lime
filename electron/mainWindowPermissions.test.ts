import type { Session, WebContents } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  installMainWindowPermissionHandlers,
  shouldAllowMainWindowPermission,
} from "./mainWindowPermissions";

const mainWebContents = { id: 8 };
type PermissionDetails = {
  isMainFrame?: boolean;
  mediaTypes?: string[];
  mediaType?: string;
};

function decide(permission: string, details?: PermissionDetails) {
  return shouldAllowMainWindowPermission({
    mainWebContents,
    requestWebContents: mainWebContents,
    permission,
    details,
  });
}

function install() {
  const setPermissionRequestHandler = vi.fn();
  const setPermissionCheckHandler = vi.fn();
  let mainWindow: { webContents: { id: number } } | null = {
    webContents: mainWebContents,
  };
  installMainWindowPermissionHandlers({
    session: { setPermissionRequestHandler, setPermissionCheckHandler },
    getMainWindow: () => mainWindow,
  });
  const request = setPermissionRequestHandler.mock.calls[0]?.[0] as NonNullable<
    Parameters<Session["setPermissionRequestHandler"]>[0]
  >;
  const check = setPermissionCheckHandler.mock.calls[0]?.[0] as NonNullable<
    Parameters<Session["setPermissionCheckHandler"]>[0]
  >;
  return {
    request,
    check,
    setPermissionRequestHandler,
    setPermissionCheckHandler,
    replaceWindow: (next: typeof mainWindow) => {
      mainWindow = next;
    },
  };
}

function requestResult(
  handler: ReturnType<typeof install>["request"],
  id: number,
  permission: Parameters<ReturnType<typeof install>["request"]>[1],
  details: Parameters<ReturnType<typeof install>["request"]>[3],
) {
  const callback = vi.fn();
  handler({ id } as WebContents, permission, callback, details);
  expect(callback).toHaveBeenCalledTimes(1);
  return callback.mock.calls[0][0];
}

describe("mainWindowPermissions", () => {
  it.each(["microphone", "audioCapture", "camera", "videoCapture"])(
    "保留主窗口既有媒体权限 %s",
    (permission) => {
      expect(decide(permission)).toBe(true);
    },
  );
  it.each([["audio"], ["video"], ["audio", "video"]])(
    "媒体请求允许有效数组 %j",
    (...mediaTypes) => {
      expect(decide("media", { mediaTypes })).toBe(true);
    },
  );
  it.each(["audio", "video"])("媒体check允许单值 %s", (mediaType) => {
    expect(decide("media", { mediaType })).toBe(true);
  });
  it.each([
    undefined,
    {},
    { mediaTypes: [] },
    { mediaTypes: ["unknown"] },
    { mediaTypes: ["audio", "unknown"] },
    { mediaType: "unknown" },
  ])("媒体缺少或包含未知类型时拒绝 %#", (details) => {
    expect(decide("media", details)).toBe(false);
  });
  it("只有主窗口主frame可写sanitized clipboard", () => {
    expect(decide("clipboard-sanitized-write", { isMainFrame: true })).toBe(
      true,
    );
    expect(decide("clipboard-sanitized-write", { isMainFrame: false })).toBe(
      false,
    );
    expect(decide("clipboard-sanitized-write", {})).toBe(false);
    expect(decide("clipboard-sanitized-write")).toBe(false);
  });
  it.each([
    "clipboard-read",
    "deprecated-sync-clipboard-read",
    "clipboard-write",
    "notifications",
    "unknown",
  ])("主窗口主frame也拒绝 %s", (permission) => {
    expect(decide(permission, { isMainFrame: true })).toBe(false);
  });
  it.each([
    { name: "其他host", main: mainWebContents, requester: { id: 9 } },
    { name: "null requester", main: mainWebContents, requester: null },
    { name: "无主窗口", main: null, requester: mainWebContents },
  ])("$name的媒体与clipboard请求均拒绝", ({ main, requester }) => {
    for (const permission of [
      "media",
      "microphone",
      "clipboard-sanitized-write",
    ]) {
      expect(
        shouldAllowMainWindowPermission({
          mainWebContents: main,
          requestWebContents: requester,
          permission,
          details: { mediaTypes: ["audio"], isMainFrame: true },
        }),
      ).toBe(false);
    }
  });
  it("两个session handler共同执行主frame写和读拒绝策略", () => {
    const handlers = install();
    expect(handlers.setPermissionRequestHandler).toHaveBeenCalledTimes(1);
    expect(handlers.setPermissionCheckHandler).toHaveBeenCalledTimes(1);
    for (const isMainFrame of [true, false]) {
      const details = { isMainFrame, requestingUrl: "file:///lime/index.html" };
      expect(
        requestResult(
          handlers.request,
          8,
          "clipboard-sanitized-write",
          details,
        ),
      ).toBe(isMainFrame);
      expect(
        handlers.check(
          { id: 8 } as WebContents,
          "clipboard-sanitized-write",
          "file://",
          details,
        ),
      ).toBe(isMainFrame);
      expect(
        requestResult(handlers.request, 8, "clipboard-read", details),
      ).toBe(false);
      expect(
        handlers.check(
          { id: 8 } as WebContents,
          "clipboard-read",
          "file://",
          details,
        ),
      ).toBe(false);
    }
    expect(
      handlers.check(null, "clipboard-sanitized-write", "file://", {
        isMainFrame: true,
      }),
    ).toBe(false);
    expect(
      handlers.check(
        { id: 8 } as WebContents,
        "deprecated-sync-clipboard-read",
        "file://",
        { isMainFrame: true },
      ),
    ).toBe(false);
    expect(
      requestResult(handlers.request, 8, "unknown", {
        isMainFrame: true,
        requestingUrl: "file:///lime/index.html",
      }),
    ).toBe(false);
  });
  it("媒体request数组与check单值接线保留有效音频和视频", () => {
    const { request, check } = install();
    for (const mediaType of ["audio", "video"] as const) {
      expect(
        requestResult(request, 8, "media", {
          mediaTypes: [mediaType],
          isMainFrame: true,
          requestingUrl: "file:///lime/index.html",
        }),
      ).toBe(true);
      expect(
        check({ id: 8 } as WebContents, "media", "file://", {
          mediaType,
          isMainFrame: true,
        }),
      ).toBe(true);
    }
    expect(
      check({ id: 8 } as WebContents, "media", "file://", {
        mediaType: "unknown",
        isMainFrame: true,
      }),
    ).toBe(false);
  });
  it("主窗口重建后每次用当前身份决策，不沿用旧window grant", () => {
    const handlers = install();
    const details = {
      isMainFrame: true,
      requestingUrl: "file:///lime/index.html",
    };
    expect(
      handlers.check(
        { id: 8 } as WebContents,
        "clipboard-sanitized-write",
        "file://",
        details,
      ),
    ).toBe(true);
    handlers.replaceWindow({ webContents: { id: 9 } });
    expect(
      requestResult(handlers.request, 8, "clipboard-sanitized-write", details),
    ).toBe(false);
    expect(
      handlers.check(
        { id: 8 } as WebContents,
        "clipboard-sanitized-write",
        "file://",
        details,
      ),
    ).toBe(false);
    expect(
      requestResult(handlers.request, 9, "clipboard-sanitized-write", details),
    ).toBe(true);
    expect(
      handlers.check(
        { id: 9 } as WebContents,
        "clipboard-sanitized-write",
        "file://",
        details,
      ),
    ).toBe(true);
    handlers.replaceWindow(null);
    expect(
      requestResult(handlers.request, 9, "clipboard-sanitized-write", details),
    ).toBe(false);
    expect(
      handlers.check(
        { id: 9 } as WebContents,
        "clipboard-sanitized-write",
        "file://",
        details,
      ),
    ).toBe(false);
  });
});
