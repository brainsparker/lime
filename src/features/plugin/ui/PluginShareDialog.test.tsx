import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { cloudAccountIdentity, getCloudAccount } from "@/lib/cloudAccount";
import type { PluginCatalogEntry } from "./PluginCatalogPageViewModel";
import type { PluginShareContext } from "./PluginShareViewModel";
import { PluginShareDialog } from "./PluginShareDialog";

const mocks = vi.hoisted(() => ({
  userId: "owner",
  list: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  checkout: vi.fn(),
  revoke: vi.fn(),
  read: vi.fn(),
  reveal: vi.fn(),
  copy: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@/lib/cloudAccount", async (original) => ({
  ...(await original<typeof import("@/lib/cloudAccount")>()),
  getCloudAccount: () => ({
    account: {
      baseUrl: "https://fixture.test",
      tenantId: "tenant",
      userId: mocks.userId,
      sessionId: `session-${mocks.userId}`,
    },
  }),
}));
vi.mock("@/lib/api/pluginShare", () => ({
  listPluginShares: (...args: unknown[]) => mocks.list(...args),
  savePluginShare: (...args: unknown[]) => mocks.save(...args),
  updatePluginShareTargets: (...args: unknown[]) => mocks.update(...args),
  checkoutPluginShare: (...args: unknown[]) => mocks.checkout(...args),
  deletePluginShare: (...args: unknown[]) => mocks.revoke(...args),
}));
vi.mock("@/lib/api/pluginCatalog", () => ({
  readPlugin: (...args: unknown[]) => mocks.read(...args),
}));
vi.mock("@/lib/api/fileSystem", () => ({
  revealPathInFinder: (...args: unknown[]) => mocks.reveal(...args),
}));

const context: PluginShareContext = {
  remotePluginId: "opaque~share",
  discoverability: "PRIVATE",
  shareUrl: "https://fixture.test/share/opaque~share",
  creatorAccountUserId: "owner",
  canPublishToWorkspace: true,
  sharePrincipals: [
    {
      principalType: "user",
      principalId: "owner",
      role: "owner",
      name: "Owner",
    },
    {
      principalType: "user",
      principalId: "reader",
      role: "reader",
      name: "Reader",
    },
  ],
};
function entry(remote = false): PluginCatalogEntry {
  return {
    marketplace: {
      name: remote ? "workspace" : "personal",
      path: remote ? null : "/home/test/.agents/plugins/marketplace.json",
      plugins: [],
    },
    plugin: {
      name: "research",
      id: remote ? "opaque~share" : "research@personal",
      remotePluginId: remote ? "opaque~share" : null,
      source: remote
        ? { type: "remote" }
        : { type: "local", path: "/home/test/plugins/research" },
      installed: false,
      enabled: false,
      authPolicy: "ON_USE",
      availability: "AVAILABLE",
      installPolicy: "AVAILABLE",
      shareContext: remote ? context : null,
    },
  };
}
function shared(
  localPluginPath: string | null = "/home/test/plugins/research",
) {
  return {
    data: [
      {
        plugin: { ...entry(true).plugin, shareContext: context },
        localPluginPath,
      },
    ],
  };
}
let root: Root;
let container: HTMLDivElement;
async function render(target = entry()) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <PluginShareDialog
        entry={target}
        accountIdentity={cloudAccountIdentity(getCloudAccount())!}
        onClose={mocks.close}
      />,
    );
  });
}
function element<T extends Element = HTMLButtonElement>(testId: string) {
  const found = document.querySelector<T>(`[data-testid="${testId}"]`);
  expect(found).not.toBeNull();
  return found!;
}
async function click(testId: string) {
  await act(async () => {
    element(testId).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
async function select(selector: string, value: string) {
  await act(async () => {
    const node = document.querySelector<HTMLSelectElement>(selector)!;
    expect(node).not.toBeNull();
    node.value = value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("PluginShareDialog", () => {
  beforeEach(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks();
    mocks.userId = "owner";
    await changeLimeLocale("zh-CN");
    mocks.list.mockResolvedValue(shared());
    mocks.read.mockResolvedValue({ plugin: { summary: entry(true).plugin } });
    mocks.save.mockResolvedValue({
      remotePluginId: context.remotePluginId,
      shareUrl: context.shareUrl,
      canPublishToWorkspace: true,
    });
    mocks.update.mockResolvedValue({
      discoverability: "PRIVATE",
      principals: context.sharePrincipals,
    });
    mocks.checkout.mockResolvedValue({
      pluginPath: "/home/test/plugins/research",
    });
    mocks.revoke.mockResolvedValue({});
    mocks.copy.mockResolvedValue(undefined);
    mocks.reveal.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.copy },
    });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
  });

  it("首次显式私密创建，后续读取失败仍保留远端身份并按同一ID更新", async () => {
    mocks.list
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error("list unavailable"));
    await render();
    expect(mocks.save).not.toHaveBeenCalled();
    await click("plugin-share-create");
    expect(mocks.save).toHaveBeenNthCalledWith(1, {
      pluginPath: "/home/test/plugins/research",
      discoverability: "PRIVATE",
    });
    expect(element("plugin-share-error").textContent).toContain(
      "list unavailable",
    );
    await click("plugin-share-update");
    expect(mocks.save).toHaveBeenNthCalledWith(2, {
      pluginPath: "/home/test/plugins/research",
      remotePluginId: "opaque~share",
    });
  });

  it("保存失败保留权限草稿，重试后采用服务端权限与对象名称", async () => {
    mocks.update
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce({
        discoverability: "UNLISTED",
        principals: [
          {
            principalType: "user",
            principalId: "owner",
            name: "Owner",
            role: "owner",
          },
          {
            principalType: "workspace",
            principalId: "tenant",
            name: "Workspace",
            role: "reader",
          },
        ],
      });
    await render();
    await select('[data-testid="plugin-share-access"]', "UNLISTED");
    await select('select[aria-label="Reader 的权限"]', "remove");
    expect(element<HTMLButtonElement>("plugin-share-copy").disabled).toBe(true);
    await click("plugin-share-save-access");
    expect(element<HTMLSelectElement>("plugin-share-access").value).toBe(
      "UNLISTED",
    );
    expect(element("plugin-share-error").textContent).toContain(
      "permission denied",
    );
    await click("plugin-share-save-access");
    expect(mocks.update).toHaveBeenLastCalledWith({
      remotePluginId: "opaque~share",
      discoverability: "UNLISTED",
      shareTargets: [
        { principalType: "workspace", principalId: "tenant", role: "reader" },
      ],
    });
    expect(
      element<HTMLButtonElement>("plugin-share-save-access").disabled,
    ).toBe(true);
    expect(document.body.textContent).not.toContain("Reader");
  });

  it("同步阻止重复提交，失败不复制成功，成功复制完整分享URL", async () => {
    const pending = deferred<unknown>();
    mocks.save.mockReturnValueOnce(pending.promise);
    await render();
    await act(async () => {
      element("plugin-share-update").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      element("plugin-share-update").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () =>
      pending.resolve({
        remotePluginId: context.remotePluginId,
        shareUrl: context.shareUrl,
      }),
    );
    mocks.copy.mockRejectedValueOnce(new Error("clipboard denied"));
    await click("plugin-share-copy");
    expect(element("plugin-share-copy").textContent).toContain("复制链接");
    await click("plugin-share-copy");
    expect(mocks.copy).toHaveBeenLastCalledWith(context.shareUrl);
    expect(element("plugin-share-copy").textContent).toContain("链接已复制");
  });

  it("远端分享先授权读取，checkout后显示真实本地路径并经统一文件入口打开", async () => {
    mocks.list.mockResolvedValue(shared(null));
    await render(entry(true));
    expect(mocks.read).toHaveBeenCalledWith({
      pluginName: "opaque~share",
      remoteMarketplaceName: "workspace",
    });
    await click("plugin-share-checkout");
    expect(mocks.checkout).toHaveBeenCalledWith({
      remotePluginId: "opaque~share",
    });
    expect(element("plugin-share-local-path").textContent).toBe(
      "/home/test/plugins/research",
    );
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>("button:has(svg.lucide-folder-open)")
        ?.click();
    });
    expect(mocks.reveal).toHaveBeenCalledWith("/home/test/plugins/research");
  });

  it("撤销有二次确认，服务端成功才关闭，失败可重试", async () => {
    mocks.revoke
      .mockRejectedValueOnce(new Error("delete denied"))
      .mockResolvedValueOnce({});
    await render();
    await click("plugin-share-delete");
    expect(mocks.revoke).not.toHaveBeenCalled();
    await click("plugin-share-confirm-delete");
    expect(mocks.close).not.toHaveBeenCalled();
    expect(element("plugin-share-delete-confirm")).toBeTruthy();
    await click("plugin-share-confirm-delete");
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("账号切换后忽略迟到成功，不触发旧账号后续读取或关闭", async () => {
    const pending = deferred<unknown>();
    mocks.save.mockReturnValueOnce(pending.promise);
    await render();
    await click("plugin-share-update");
    mocks.userId = "another";
    await act(async () =>
      pending.resolve({
        remotePluginId: "old-account-id",
        shareUrl: "https://old.test",
      }),
    );
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("old-account-id");
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it.each([
    ["reader", false],
    ["editor", true],
  ] as const)(
    "%s 只读权限并隐藏撤销，版本更新按编辑权显示",
    async (role, canUpdate) => {
      mocks.userId = "reader";
      const response = shared();
      response.data[0].plugin.shareContext = {
        ...context,
        sharePrincipals: context.sharePrincipals?.map((principal) =>
          principal.principalId === "reader"
            ? { ...principal, role }
            : principal,
        ),
      };
      mocks.list.mockResolvedValue(response);
      await render();
      expect(element<HTMLSelectElement>("plugin-share-access").disabled).toBe(
        true,
      );
      expect(
        document.querySelector('[data-testid="plugin-share-delete"]'),
      ).toBeNull();
      expect(
        Boolean(document.querySelector('[data-testid="plugin-share-update"]')),
      ).toBe(canUpdate);
    },
  );

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
    "%s 提供实际翻译与可访问弹窗名称",
    async (locale) => {
      await changeLimeLocale(locale);
      await render();
      expect(
        document
          .querySelector('[role="dialog"]')
          ?.getAttribute("aria-labelledby"),
      ).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/plugin\.(share|catalog)/);
      expect(
        element("plugin-share-copy").textContent?.trim().length,
      ).toBeGreaterThan(0);
    },
  );
});
