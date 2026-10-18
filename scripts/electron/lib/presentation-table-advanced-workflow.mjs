import { runPresentationTableAdvancedScenario } from "./presentation-table-advanced-scenario.mjs";
import { runPresentationTableRowResizeScenario } from "./presentation-table-row-resize-scenario.mjs";
import { runPresentationTableReorderScenario } from "./presentation-table-reorder-scenario.mjs";

/** 三段场景共享真实文件与同一 Electron 会话，分别保留独立原包证据。 */
export async function runPresentationTableAdvancedWorkflow(options) {
  const editing = await runPresentationTableAdvancedScenario(options);
  const rowResize = await runPresentationTableRowResizeScenario(options);
  const reorder = await runPresentationTableReorderScenario(options);
  return { editing, rowResize, reorder };
}
