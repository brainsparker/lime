#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runVitestSmoke } from "../lib/vitest-smoke-runner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const LOG_PREFIX = "smoke:agent-runtime-async-tabs";

function runVitest(label, args) {
  return runVitestSmoke({
    rootDir,
    label,
    args,
    logPrefix: LOG_PREFIX,
  });
}

function main() {
  const hydration = runVitest("刷新与切换的 canonical 队列水合", [
    "src/components/agent/chat/hooks/useAgentChat.test.tsx",
    "-t",
    "页面刷新恢复到排队会话时只水合运行态，不自动调用 legacy resume|切换到 running thread_read 时重新建立 canonical Thread 订阅|切换话题时应消费 session list 的 canonical queue count",
  ]);
  if (hydration.executedTests !== 3) {
    throw new Error("async-tabs 必须执行全部三项 canonical 队列水合测试");
  }

  const navigation = runVitest("侧栏状态与canonical会话恢复", [
    "src/components/AppSidebar.conversations.test.tsx",
    "src/components/agent/chat/utils/taskCenterTabs.test.ts",
    "-t",
    "回到首页时应按后台未完成会话状态显示侧栏运行图标|回到首页时应按后台排队会话状态显示侧栏排队图标|后台状态不会覆盖已完成的侧栏会话终态|reconcile 当前任务应保留本地追平目标，并跳过 detached 预览|切换中的目标会话尚未成为当前会话时，应标记为待恢复态",
  ]);
  if (navigation.executedTests !== 5) {
    throw new Error("async-tabs 必须执行全部五项canonical导航测试");
  }
  const unified = runVitest("统一工作区与canonical标题", [
    "src/components/agent/chat/workspace/threadTitle.unit.test.ts",
    "src/components/agent/chat/workspace/threadWorkspaceHeaderViewModel.unit.test.ts",
    "src/components/app-shell/AppShell.test.tsx",
    "src/components/workspace/layout/LayoutTransition.test.tsx",
  ]);
  if (unified.executedTests !== 24) {
    throw new Error("async-tabs 必须执行全部二十四项统一工作区测试");
  }

  console.log(
    `[${LOG_PREFIX}] async-tabs.summary: canonical_queue_hydration=covered; running_thread_subscription=covered; title_loading=covered; legacy_task_strip=deleted; unified_navigation=covered`,
  );
  console.log(`\n[${LOG_PREFIX}] 通过`);
}

main();
