import { writePresentationPreviewFixture } from "./presentation-preview-scenario.mjs";
import { runPresentationEditingScenario } from "./presentation-editing-scenario.mjs";
import {
  writePresentationStructureFixture,
  runPresentationStructureScenario,
} from "./presentation-structure-scenario.mjs";
import { runPresentationNavigationScenario } from "./presentation-navigation-scenario.mjs";
import {
  writePresentationTableFixture,
  runPresentationTableScenario,
} from "./presentation-table-scenario.mjs";
import { runPresentationTableStructureScenario } from "./presentation-table-structure-scenario.mjs";
import { runPresentationTableAdvancedWorkflow } from "./presentation-table-advanced-workflow.mjs";
import {
  writePresentationTableFormatFixture,
  runPresentationTableFormatScenario,
} from "./presentation-table-format-scenario.mjs";
import {
  writePresentationTableBuiltinFixture,
  runPresentationTableBuiltinScenario,
} from "./presentation-table-builtin-scenario.mjs";
import {
  writePresentationElementFixture,
  runPresentationElementScenario,
} from "./presentation-element-scenario.mjs";
import {
  writePresentationRichTextFixture,
  runPresentationRichTextScenario,
} from "./presentation-rich-text-scenario.mjs";

/** 每个独立编辑场景由自己的真实 OPC 源稿持有，不能串用基准文件。 */
export function writePresentationScenarioFixture(filePath, options) {
  const write = options.withPresentationRichText
    ? writePresentationRichTextFixture
    : options.withPresentationElements
      ? writePresentationElementFixture
      : options.withPresentationTableBuiltin
        ? writePresentationTableBuiltinFixture
        : options.withPresentationTableFormat
          ? writePresentationTableFormatFixture
          : options.withPresentationTable
            ? writePresentationTableFixture
            : options.withPresentationStructure
              ? writePresentationStructureFixture
              : writePresentationPreviewFixture;
  return write(filePath);
}

export async function runPresentationScenarios({
  app,
  page,
  evidenceDir,
  filePath,
  readTrace,
  options,
  stage,
  assertNoExtraTurn,
}) {
  const result = {};
  const scenarios = [
    [
      options.withPresentationRichText,
      "richText",
      "presentation-rich-text",
      runPresentationRichTextScenario,
    ],
    [
      options.withPresentationEditing,
      "editing",
      "presentation-editing",
      runPresentationEditingScenario,
    ],
    [
      options.withPresentationStructure,
      "structure",
      "presentation-structure",
      runPresentationStructureScenario,
    ],
    [
      options.withPresentationNavigation,
      "navigation",
      "presentation-navigation",
      runPresentationNavigationScenario,
    ],
    [
      options.withPresentationTable,
      "table",
      "presentation-table",
      runPresentationTableScenario,
    ],
    [
      options.withPresentationTableStructure,
      "tableStructure",
      "presentation-table-structure",
      runPresentationTableStructureScenario,
    ],
    [
      options.withPresentationTableAdvanced,
      "tableAdvanced",
      "presentation-table-advanced",
      runPresentationTableAdvancedWorkflow,
    ],
    [
      options.withPresentationTableFormat,
      "tableFormat",
      "presentation-table-format",
      runPresentationTableFormatScenario,
    ],
    [
      options.withPresentationTableBuiltin,
      "tableBuiltin",
      "presentation-table-builtin",
      runPresentationTableBuiltinScenario,
    ],
    [
      options.withPresentationElements,
      "elements",
      "presentation-elements",
      runPresentationElementScenario,
    ],
  ];
  for (const [enabled, key, name, run] of scenarios) {
    if (!enabled) continue;
    stage(name);
    result[key] = await run({ app, page, evidenceDir, filePath, readTrace });
    assertNoExtraTurn(name);
  }
  return result;
}
