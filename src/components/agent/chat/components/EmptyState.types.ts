import type {
  ComposerDraftCoordinator,
  ComposerDraftCapture,
} from "@/components/input-kit/ComposerDraftCoordinator";
import type { AcceptedRuntimeSubmissionResult } from "@/components/agent/chat/hooks/agentSendResult";
import type { ComposerController } from "@/components/input-kit";

import type { ModelReasoningEffortLevel } from "@/lib/types/modelRegistry";
import type { AgentI18nResource } from "@/i18n/agentResources";
import type { AgentInitialInputCapabilityParams } from "@/types/page";
import type { SkillSelectionSourceProps } from "../skill-selection/skillSelectionBindings";
import type { AgentAccessMode } from "../hooks/agentChatStorage";
import type { ScopedComposerRestoreRequest } from "./composerSubmissionSettlement";

import type { MessagePathReference } from "../types";
import type { InputbarSendHandler } from "./Inputbar/inputbarSendPayload";
import type { ComposerProject } from "./Inputbar/components/composerUtilityBarTypes";
import type { InputbarPluginCapability } from "./Inputbar/pluginInputCapability";

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
  /** 输入框已添加的本地文件/文件夹引用 */
  pathReferences?: MessagePathReference[];
  onAddPathReferences?: (references: MessagePathReference[]) => void;
  inputRestoreRequest?: ScopedComposerRestoreRequest | null;
  onInputRestoreRequestHandled?: (requestId: string) => void;
  onRemovePathReference?: (id: string) => void;
  onClearPathReferences?: () => void;
}
