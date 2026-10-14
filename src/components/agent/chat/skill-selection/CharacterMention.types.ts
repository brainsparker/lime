import type React from "react";
import type {
  ComposerController,
  ComposerEditorHandle,
} from "@/components/input-kit";
import type { Character } from "@/lib/api/projectMemory";
import type { Skill } from "@/lib/api/skills";
import type {
  ServiceSkillGroup,
  ServiceSkillHomeItem,
} from "../service-skills/types";
import type { SelectInputCapabilityHandler } from "./inputCapabilitySelection";
import type {
  InputbarPluginCapability,
  InputbarPluginSkillCapability,
  InputbarPluginSelectionOptions,
} from "../components/Inputbar/pluginInputCapability";
import type {
  CuratedTaskInputValues,
  CuratedTaskTemplateItem,
} from "../utils/curatedTaskTemplates";
import type { CuratedTaskReferenceEntry } from "../utils/curatedTaskReferenceSelection";

export interface CharacterMentionProps {
  /** 角色列表 */
  characters: Character[];
  /** 技能列表 */
  skills?: Skill[];
  /** 技能目录项列表 */
  serviceSkills?: ServiceSkillHomeItem[];
  /** 技能目录分组 */
  serviceSkillGroups?: ServiceSkillGroup[];
  /** 输入框 ref */
  editorRef: React.RefObject<ComposerEditorHandle>;
  controller: ComposerController;
  /** 当前输入值 */
  value: string;
  /** 输入值变更回调 */
  onChange: (value: string) => void;
  /** 选择角色回调 */
  onSelectCharacter?: (character: Character) => void;
  /** 统一选择输入能力回调 */
  onSelectInputCapability?: SelectInputCapabilityHandler;
  /** 选择结果模板回调 */
  onSelectCuratedTask?: (
    task: CuratedTaskTemplateItem,
    options?: {
      launchInputValues?: CuratedTaskInputValues;
      referenceMemoryIds?: string[];
      referenceEntries?: CuratedTaskReferenceEntry[];
      launcherPrefillHint?: string;
    },
  ) => void;
  /** 选择 Plugin 插件回调 */
  onSelectPlugin?: (
    plugin: InputbarPluginCapability,
    skill?: InputbarPluginSkillCapability,
    options?: InputbarPluginSelectionOptions,
  ) => void;
  /** Plugin 插件候选 */
  pluginSuggestions?: readonly InputbarPluginCapability[];
  /** 需要加载技能候选时触发 */
  onSkillSuggestionsNeeded?: () => void;
  /** 需要加载 Plugin 插件候选时触发 */
  onPluginSuggestionsNeeded?: () => void;
  projectId?: string | null;
  sessionId?: string | null;
  /** 当前默认带入的灵感引用 */
  defaultCuratedTaskReferenceMemoryIds?: string[];
  /** 当前默认带入的灵感引用对象 */
  defaultCuratedTaskReferenceEntries?: CuratedTaskReferenceEntry[];
  /** 跳转到设置页安装技能 */
  onNavigateToSettings?: () => void;
  /** 是否启用输入自动补全与联想面板 */
  inputCompletionEnabled?: boolean;
}
