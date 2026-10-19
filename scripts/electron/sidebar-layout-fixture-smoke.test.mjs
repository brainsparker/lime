import { describe, expect, it } from "vitest";
import { parseSidebarLayoutArgs } from "./sidebar-layout-fixture-smoke.mjs";
import {
  SIDEBAR_LAYOUT_REQUIRED_METHODS,
  assertSidebarBridge,
  assertSidebarLayout,
  assertSidebarMenu,
} from "./lib/sidebar-layout-fixture-evidence.mjs";

function layout() {
  return {
    electron: true,
    preloadInvoke: true,
    fallback: false,
    collapsed: false,
    sidebar: { width: 290, bottom: 896 },
    rail: { width: 52 },
    accountButton: { right: 44, bottom: 892 },
    projectCount: 5,
    recentCount: 10,
    rowMetrics: Array.from({ length: 17 }, () => ({
      height: 30,
      minHeight: 30,
      radius: 10,
      paddingLeft: 8,
      paddingRight: 8,
    })),
    menu: { x: 48, bottom: 896 },
    menuSide: "right",
    menuAlign: "end",
  };
}

function bridge() {
  return {
    rendererMethods: ["thread/list", "threadSection/list"],
    rpcReceipts: SIDEBAR_LAYOUT_REQUIRED_METHODS.map((method, id) => ({
      method,
      command: "app_server_handle_json_lines",
      transport: "electron-ipc",
      status: "success",
      electron: true,
      fallback: false,
      requestId: id,
      responseId: id,
    })),
  };
}

describe("sidebar layout real-Electron fixture oracles", () => {
  it("rejects unsafe run identities and unknown arguments", () => {
    expect(parseSidebarLayoutArgs(["--run-id", "sidebar-20261020"]).runId).toBe(
      "sidebar-20261020",
    );
    expect(parseSidebarLayoutArgs(["--help"]).help).toBe(true);
    expect(() => parseSidebarLayoutArgs(["--run-id", "../escape"])).toThrow();
    expect(() => parseSidebarLayoutArgs(["--reuse-running"])).toThrow();
  });

  it("accepts the shipped-base density and independent budgets", () => {
    expect(() => assertSidebarLayout(layout())).not.toThrow();
    expect(() => assertSidebarMenu(layout())).not.toThrow();
    const collapsed = layout();
    collapsed.collapsed = true;
    collapsed.sidebar.width = 52;
    collapsed.projectCount = 0;
    collapsed.recentCount = 0;
    collapsed.rowMetrics = [];
    expect(() =>
      assertSidebarLayout(collapsed, { collapsed: true }),
    ).not.toThrow();
  });

  it.each([
    ["minimum width", (item) => (item.sidebar.width = 240)],
    ["rail width", (item) => (item.rail.width = 48)],
    ["project budget", (item) => (item.projectCount = 7)],
    ["Recents budget", (item) => (item.recentCount = 3)],
    ["row density", (item) => (item.rowMetrics[0].height = 36)],
    ["footer alignment", (item) => (item.accountButton.bottom = 800)],
    ["browser mirror", (item) => (item.electron = false)],
    ["renderer fallback", (item) => (item.fallback = true)],
  ])("fails closed on %s", (_name, mutate) => {
    const observed = layout();
    mutate(observed);
    expect(() => assertSidebarLayout(observed)).toThrow();
  });

  it("requires actual right/end menu placement", () => {
    const wrongSide = layout();
    wrongSide.menu.x = 0;
    expect(() => assertSidebarMenu(wrongSide)).toThrow();
    const wrongAlign = layout();
    wrongAlign.menuAlign = "start";
    expect(() => assertSidebarMenu(wrongAlign)).toThrow();
  });

  it("requires canonical method receipts and renderer IPC evidence", () => {
    expect(() => assertSidebarBridge(bridge())).not.toThrow();
    const missing = bridge();
    missing.rpcReceipts.pop();
    expect(() => assertSidebarBridge(missing)).toThrow();
    const mismatch = bridge();
    mismatch.rpcReceipts[0].responseId = "unrelated";
    expect(() => assertSidebarBridge(mismatch)).toThrow();
    const mirror = bridge();
    mirror.rendererMethods = [];
    expect(() => assertSidebarBridge(mirror)).toThrow();
  });
});
