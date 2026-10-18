import type {
  ComposerDraftCoordinator,
  ComposerDraftCapture,
} from "@/components/input-kit/ComposerDraftCoordinator";
import type { AcceptedRuntimeSubmissionResult } from "@/components/agent/chat/hooks/agentSendResult";
import type { ComposerController } from "@/components/input-kit";
import type { Character } from "@/lib/api/projectMemory";
import type { ModelReasoningEffortLevel } from "@/lib/types/modelRegistry";
import type { AgentI18nResource } from "@/i18n/agentResources";
import type { AgentInitialInputCapabilityParams } from "@/types/page";
import type { SkillSelectionSourceProps } from "../skill-selection/skillSelectionBindings";
import type { AgentAccessMode } from "../hooks/agentChatStorage";
import type { ScopedComposerRestoreRequest } from "./composerSubmissionSettlement";
import type { CreationReplaySurfaceModel } from "../utils/creationReplaySurface";
import type { CuratedTaskReferenceEntry } from "../utils/curatedTaskReferenceSelection";
import type { MessagePathReference } from "../types";
import type { InputbarSendHandler } from "./Inputbar/inputbarSendPayload";
import type { ComposerProject } from "./Inputbar/components/composerUtilityBarTypes";
import type { InputbarPluginCapability } from "./Inputbar/pluginInputCapability";
import type {
  InputbarKnowledgePackOption,
  InputbarKnowledgePackSelection,
} from "./Inputbar/types";

export type AgentI18nKey = keyof AgentI18nResource;

export interface EmptyStateProps extends SkillSelectionSourceProps {
  composerController?: ComposerController;
  composerDraftCoordinator?: ComposerDraftCoordinator;
  onComposerDraftAccepted?: (
    capture: ComposerDraftCapture,
    result: AcceptedRuntimeSubmissionResult,
  ) => Promise<void> | void;
  input: string;
  setInput: (value: string) => void;
  onSend: InputbarSendHandler;
  onStop?: () => void;
  /** 首页首发按钮在 pointerdown 阶段发送，避免 click 后短暂停留首页空态。 */
  sendOnPointerDown?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  /** 当前激活的主题 */
  activeTheme?: string;
  /** 主题变更回调 */
  onThemeChange?: (theme: string) => void;
  providerType: string;
  setProviderType: (type: string) => void;
  model: string;
  setModel: (model: string) => void;
  reasoningEffort?: ModelReasoningEffortLevel | "";
  setReasoningEffort?: (value: ModelReasoningEffortLevel | "") => void;
  accessMode?: AgentAccessMode;
  setAccessMode?: (mode: AgentAccessMode) => void;
  onManageProviders?: () => void;
  taskEnabled?: boolean;
  onTaskEnabledChange?: (enabled: boolean) => void;
  objectiveEnabled?: boolean;
  onObjectiveEnabledChange?: (enabled: boolean) => void;
  subagentEnabled?: boolean;
  onSubagentEnabledChange?: (enabled: boolean) => void;
  selectedText?: string;
  /** 角色列表（用于 @ 引用） */
  characters?: Character[];
  /** 启动浏览器协助 */
  onLaunchBrowserAssist?: () => void | Promise<void>;
  /** 当前项目 ID */
  projectId?: string | null;
  /** 已打开项目列表 */
  openedProjects?: ComposerProject[];
  /** 切换当前项目上下文 */
  onProjectContextChange?: (projectId: string | null) => void;
  /** 当前会话 ID */
  sessionId?: string | null;
  /** 当前输入栏可显式激活的插件候选 */
  pluginSuggestions?: InputbarPluginCapability[];
  /** 插件候选读取失败信息 */
  pluginSuggestionsError?: string | null;
  /** 插件候选是否读取中 */
  pluginSuggestionsLoading?: boolean;
  /** 用户显式打开插件候选入口 */
  onPluginSuggestionsNeeded?: () => void;
  /** 进入首页时预选的输入框能力 */
  initialInputCapability?: AgentInitialInputCapabilityParams;
  /** 当前带入的 creation replay 前台投影 */
  creationReplaySurface?: CreationReplaySurfaceModel | null;
  /** 当前结果模板默认带入的 memory 引用 id */
  defaultCuratedTaskReferenceMemoryIds?: string[];
  /** 当前结果模板默认带入的参考对象 */
  defaultCuratedTaskReferenceEntries?: CuratedTaskReferenceEntry[];
  /** 当前项目资料选择态 */
  knowledgePackSelection?: InputbarKnowledgePackSelection | null;
  /** 当前项目可选资料 */
  knowledgePackOptions?: InputbarKnowledgePackOption[];
  /** 启用 / 关闭当前项目资料 */
  onToggleKnowledgePack?: (enabled: boolean) => void;
  /** 切换当前项目资料 */
  onSelectKnowledgePack?: (packName: string) => void;
  /** 显式选择 / 取消一份协同资料 */
  onToggleKnowledgeCompanionPack?: (packName: string, enabled: boolean) => void;
  /** 从当前输入或会话沉淀项目资料 */
  onStartKnowledgeOrganize?: () => void;
  /** 打开项目资料管理 */
  onManageKnowledgePacks?: () => void;
  /** 输入框已添加的本地文件/文件夹引用 */
  pathReferences?: MessagePathReference[];
  onAddPathReferences?: (references: MessagePathReference[]) => void;
  inputRestoreRequest?: ScopedComposerRestoreRequest | null;
  onInputRestoreRequestHandled?: (requestId: string) => void;
  onImportPathReferenceAsKnowledge?: (reference: MessagePathReference) => void;
  onRemovePathReference?: (id: string) => void;
  onClearPathReferences?: () => void;
  fileManagerOpen?: boolean;
  onToggleFileManager?: () => void;
}
