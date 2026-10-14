import type { ComposerController, ComposerSelection } from "@/components/input-kit";
import type { Skill } from "@/lib/api/skills";
import { buildInputbarPluginMention, normalizeInputbarPluginTrigger, type InputbarPluginCapability, type InputbarPluginSkillCapability } from "../components/Inputbar/pluginInputCapability";

function insertMention(controller: ComposerController, binding: Parameters<ComposerController["insertMention"]>[0], range?: ComposerSelection): void {
  const document = controller.getDocument();
  const selection = range ?? { start: document.selectionStart, end: document.selectionEnd };
  const leading = selection.start > 0 && !/\s/.test(document.text[selection.start - 1]);
  const trailing = selection.end < document.text.length && !/\s/.test(document.text[selection.end]);
  controller.insertMention(binding, selection);
  const end = controller.getDocument().selectionEnd;
  if (trailing) controller.replaceRange({ start: end, end }, " ");
  if (leading) controller.replaceRange({ start: selection.start, end: selection.start }, " ");
  const caret = end + Number(leading) + Number(trailing);
  controller.setSelection(caret);
}

export function insertComposerSkill(controller: ComposerController, skill: Skill, range?: ComposerSelection): void {
  if (controller.getDocument().mentionBindings.some((binding) => binding.kind === "skill" && binding.id === skill.key)) return;
  const directory = (skill.localDirectoryPath ?? skill.directory).replace(/[\\/]+$/, "");
  const path = /(?:^|[\\/])SKILL\.md$/i.test(directory) ? directory : `${directory}/SKILL.md`;
  insertMention(controller, { kind: "skill", id: skill.key, name: skill.name, path, label: `/${skill.key}` }, range);
}

export function insertComposerPlugin(controller: ComposerController, plugin: InputbarPluginCapability, skill?: InputbarPluginSkillCapability, range?: ComposerSelection): void {
  if (controller.getDocument().mentionBindings.some((binding) => binding.kind === "plugin" && binding.id === plugin.pluginId)) return;
  const mention = buildInputbarPluginMention(plugin);
  insertMention(controller, { kind: "plugin", id: plugin.pluginId, name: mention.name, path: mention.path, label: normalizeInputbarPluginTrigger(plugin, skill) }, range);
}
