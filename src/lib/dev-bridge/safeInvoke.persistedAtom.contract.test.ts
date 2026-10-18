import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElectronHostBridge } from "@/lib/electron-host";

const transport = vi.hoisted(() => ({
  invokeViaHttp: vi.fn(),
  isDevBridgeAvailable: vi.fn(() => false),
}));
vi.mock("./http-client", () => ({
  ...transport,
  hasDevBridgeEventListenerCapability: () => false,
  listenViaHttpEvent: vi.fn(),
  normalizeDevBridgeError: (_command: string, error: unknown) => error,
  resolveBridgeRequestTimeoutMs: () => 0,
}));
vi.mock("./mockPriorityCommands", () => ({
  shouldDisallowMockEventFallbackInBrowser: () => false,
}));
import {
  getInvokeErrorBuffer,
  getInvokeTraceBuffer,
  safeInvoke,
  safeListen,
} from "./safeInvoke";

const privateText = "PRIVATE_DRAFT_TEXT_中😀";
const privateMedia = "PRIVATE_BASE64_BYTES";
const request = {
  key: "composer-drafts-v1",
  mutation: {
    op: "put",
    scope: { workspaceId: privateText, kind: "local", id: privateText },
    draftId: privateText,
    expectedVersion: null,
    nextVersion: privateText,
    draft: { text: privateText, images: [{ data: privateMedia }] },
  },
};

function installBridge(invoke = vi.fn().mockResolvedValue({ saved: true })) {
  window.electronAPI = {
    invoke,
    supportsCommand: () => true,
    listen: vi.fn(() => () => undefined),
    emit: vi.fn(),
  } as ElectronHostBridge;
  return invoke;
}

function buffers() {
  return JSON.stringify({
    traces: getInvokeTraceBuffer(),
    errors: getInvokeErrorBuffer(),
    storage: { ...window.localStorage },
  });
}

describe("persisted atom current bridge diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    delete window.electronAPI;
    transport.isDevBridgeAvailable.mockReturnValue(false);
  });

  it("真实 IPC 原样发送富草稿，诊断仅保存有限元数据", async () => {
    const invoke = installBridge();
    await expect(safeInvoke("persisted_atom_update", request)).resolves.toEqual(
      { saved: true },
    );
    expect(invoke).toHaveBeenCalledWith("persisted_atom_update", request);
    expect(getInvokeTraceBuffer()).toEqual([
      expect.objectContaining({
        command: "persisted_atom_update",
        transport: "electron-ipc",
        status: "success",
        args_preview: { key: "composer-drafts-v1", op: "put" },
      }),
    ]);
    expect(buffers()).not.toContain(privateText);
    expect(buffers()).not.toContain(privateMedia);
  });

  it("读取 scope 与返回草稿均不进入诊断", async () => {
    const response = {
      key: "composer-drafts-v1",
      storeRevision: 0,
      persistence: { state: "saved", savedRevision: 0 },
      outcome: "ready",
      data: {
        queryKind: "scope",
        view: { scope: request.mutation.scope, entry: null },
      },
    };
    installBridge(vi.fn().mockResolvedValue(response));
    await expect(
      safeInvoke("persisted_atom_read", {
        key: "composer-drafts-v1",
        query: { kind: "scope", scope: request.mutation.scope },
      }),
    ).resolves.toBe(response);
    expect(getInvokeTraceBuffer()[0].args_preview).toEqual({
      key: "composer-drafts-v1",
    });
    expect(buffers()).not.toContain(privateText);
  });

  it.each([privateText, null])(
    "workspace-index query/data 保持原样且工作区不进入诊断",
    async (workspaceId) => {
      const response = {
        key: "composer-drafts-v1",
        storeRevision: 0,
        persistence: { state: "saved", savedRevision: 0 },
        outcome: "ready",
        data: { queryKind: "workspace-index", workspaceId, items: [] },
      };
      const invoke = vi.fn().mockResolvedValue(response);
      installBridge(invoke);
      const args = {
        key: "composer-drafts-v1",
        query: { kind: "workspace-index", workspaceId },
      };
      await expect(safeInvoke("persisted_atom_read", args)).resolves.toBe(
        response,
      );
      expect(invoke).toHaveBeenCalledExactlyOnceWith(
        "persisted_atom_read",
        args,
      );
      expect(getInvokeTraceBuffer()[0].args_preview).toEqual({
        key: "composer-drafts-v1",
      });
      expect(buffers()).not.toContain(privateText);
    },
  );

  it.each(["electron-ipc", "http-bridge"])(
    "%s 错误正文不落盘且保留原始调用失败",
    async (source) => {
      const error = new Error(privateText + privateMedia);
      if (source === "electron-ipc")
        installBridge(vi.fn().mockRejectedValue(error));
      else {
        transport.isDevBridgeAvailable.mockReturnValue(true);
        transport.invokeViaHttp.mockRejectedValue(error);
      }
      await expect(safeInvoke("persisted_atom_update", request)).rejects.toBe(
        error,
      );
      expect(getInvokeTraceBuffer()[0]).toMatchObject({
        command: "persisted_atom_update",
        transport: source,
        status: "error",
      });
      expect(getInvokeErrorBuffer()[0]).toMatchObject({
        command: "persisted_atom_update",
        transport: source,
      });
      expect(buffers()).not.toContain(privateText);
      expect(buffers()).not.toContain(privateMedia);
    },
  );

  it("无可用通道失败仍记录 command/status，不收录草稿", async () => {
    await expect(safeInvoke("persisted_atom_update", request)).rejects.toThrow(
      "IPC 不可用",
    );
    expect(getInvokeTraceBuffer()[0]).toMatchObject({
      command: "persisted_atom_update",
      transport: "unavailable",
      status: "error",
    });
    expect(buffers()).not.toContain(privateText);
  });

  it("diagnostic preview 不执行不可信请求的 getter", async () => {
    const getter = vi.fn(() => privateText);
    const args = Object.defineProperty({}, "key", {
      enumerable: true,
      get: getter,
    });
    installBridge();
    await safeInvoke("persisted_atom_update", args);
    expect(getter).not.toHaveBeenCalled();
    expect(buffers()).not.toContain(privateText);
  });

  it("非法 key/op 被固定标签替代，不写任意文本", async () => {
    installBridge();
    await safeInvoke("persisted_atom_update", {
      key: privateText,
      mutation: { op: privateMedia },
    });
    expect(getInvokeTraceBuffer()[0].args_preview).toEqual({
      key: "unknown",
      op: "unknown",
    });
    expect(buffers()).not.toContain(privateText);
    expect(buffers()).not.toContain(privateMedia);
  });

  it("摘要固定偏好只记录已知key/op，不记录偏好值或附带内容", async () => {
    installBridge();
    await safeInvoke("persisted_atom_update", {
      key: "app-shell-summary-panel-pinned",
      mutation: { op: "set", value: false, privateText },
    });
    expect(getInvokeTraceBuffer()[0].args_preview).toEqual({
      key: "app-shell-summary-panel-pinned",
      op: "set",
    });
    expect(buffers()).not.toContain(privateText);
  });

  it("原生保存通知订阅失败明确抛出，不能返回空取消函数", async () => {
    installBridge();
    const failure = new Error("native event bridge unavailable");
    window.electronAPI!.listen = vi.fn().mockRejectedValue(failure);
    await expect(safeListen("persisted-atom-update", vi.fn())).rejects.toThrow(
      "原生事件桥不可用",
    );
  });
});
