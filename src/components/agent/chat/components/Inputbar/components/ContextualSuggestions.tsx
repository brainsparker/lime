import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Blocks,
  File,
  ListChecks,
  Paperclip,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ComposerController,
  ComposerEditorHandle,
} from "@/components/input-kit";
import { composerPositionToOffset } from "@/components/input-kit/composerPositions";
import {
  SuggestionList,
  type SuggestionSection,
} from "@/components/input-kit/SuggestionList";
import type { Skill } from "@/lib/api/skills";
import { skillDisplayName } from "../../../skill-selection/skillDisplayName";
import { useProjectFileMentionSearch } from "../../../skill-selection/useProjectFileMentionSearch";
import {
  insertComposerPlugin,
  insertComposerSkill,
} from "../../../skill-selection/composerCapabilityMention";
import type { SelectInputCapabilityHandler } from "../../../skill-selection/inputCapabilitySelection";
import type { InputbarPluginCapability } from "../pluginInputCapability";
import { resolveInputbarPluginDisplayName } from "../pluginInputCapability";

export interface ContextualSuggestionCommand {
  id: "goal" | "plan-mode";
  label: string;
  onSelect(): void;
}

export interface ContextualSuggestionsConfig {
  onAddFiles(): void;
  commands?: readonly ContextualSuggestionCommand[];
  projectId?: string | null;
  skills?: readonly Skill[];
  skillsLoading?: boolean;
  onSkillSuggestionsNeeded?(): void;
  onSelectInputCapability?: SelectInputCapabilityHandler;
  plugins?: readonly InputbarPluginCapability[];
  pluginsLoading?: boolean;
  pluginsError?: string | null;
  onPluginSuggestionsNeeded?(): void;
  onChange(text: string): void;
}

export function ContextualSuggestions({
  controller,
  config,
  editorRef,
  anchorRef,
  disabled,
}: {
  controller: ComposerController;
  config: ContextualSuggestionsConfig;
  editorRef: RefObject<ComposerEditorHandle>;
  anchorRef: RefObject<HTMLDivElement>;
  disabled: boolean;
}) {
  const { t } = useTranslation("agent");
  const suggestion = useSyncExternalStore(
    controller.subscribe,
    controller.getSuggestion,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState({
    left: 0,
    bottom: 0,
    width: 360,
    maxHeight: 320,
  });
  const active = suggestion.active && !disabled;
  const callbacks = useRef(config);
  callbacks.current = config;
  useEffect(() => {
    if (!active) return;
    callbacks.current.onSkillSuggestionsNeeded?.();
    callbacks.current.onPluginSuggestionsNeeded?.();
  }, [active]);

  useLayoutEffect(() => {
    if (!active) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width || 360, window.innerWidth - 24);
      setAnchor({
        left: Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12),
        bottom: Math.max(window.innerHeight - rect.top + 4, 4),
        width,
        maxHeight: Math.max(0, rect.top - 4 - 12),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    if (anchorRef.current) observer.observe(anchorRef.current);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, anchorRef]);

  useEffect(() => {
    if (!active) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        panelRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      )
        return;
      controller.dismissSuggestions();
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [active, anchorRef, controller]);

  useEffect(() => {
    if (disabled && suggestion.active) controller.dismissSuggestions();
  }, [controller, disabled, suggestion.active]);

  const query = suggestion.query.trim().toLocaleLowerCase();
  const atMention = suggestion.kind === "at-mention";
  const skillsOnly = suggestion.kind === "skill-mention";
  const fileSearch = useProjectFileMentionSearch({
    active: active && atMention,
    projectId: config.projectId,
    query: suggestion.query,
  });
  if (!active) return null;

  const focus = () => editorRef.current?.focus();
  const notify = () => {
    config.onChange(controller.getDocument().text);
    focus();
  };
  const matches = (...values: (string | undefined)[]) =>
    !query ||
    values.some((value) => value?.toLocaleLowerCase().includes(query));
  const clearForAction = (run: () => void) => {
    controller.clearSuggestion();
    notify();
    run();
    focus();
  };
  const mentionRange = () => {
    const current = controller.getSuggestion();
    if (!current.active || !current.range) return null;
    const doc = controller.getEditorState().doc;
    return {
      start: composerPositionToOffset(doc, current.range.from),
      end: composerPositionToOffset(doc, current.range.to),
    };
  };
  const sections: SuggestionSection[] = [];
  const actions = [
    ...(atMention && matches(t("agentChat.inputbar.suggestions.addFiles"))
      ? [
          {
            key: "context-action:pick-local-files",
            label: t("agentChat.inputbar.suggestions.addFiles"),
            icon: <Paperclip size={16} />,
            onSelect: () => clearForAction(config.onAddFiles),
          },
        ]
      : []),
    ...(!skillsOnly
      ? [...(config.commands ?? [])]
          .sort(
            (a, b) =>
              Number(a.id === "plan-mode") - Number(b.id === "plan-mode"),
          )
          .filter((command) => matches(command.id, command.label))
          .map((command) => ({
            key: `command:${command.id}`,
            label: command.label,
            icon:
              command.id === "goal" ? (
                <Target size={16} />
              ) : (
                <ListChecks size={16} />
              ),
            onSelect: () => clearForAction(command.onSelect),
          }))
      : []),
  ];
  if (actions.length)
    sections.push({
      id: "context-actions",
      title: t("agentChat.inputbar.suggestions.add"),
      items: actions,
    });
  if (atMention) {
    const plugins =
      config.plugins?.filter((plugin) =>
        matches(
          plugin.displayName,
          plugin.pluginId,
          plugin.description,
          plugin.trigger,
        ),
      ) ?? [];
    if (plugins.length || config.pluginsLoading || config.pluginsError)
      sections.push({
        id: "plugins",
        title: t("agentChat.inputbar.suggestions.plugins"),
        status: config.pluginsError
          ? t("agentChat.inputbar.suggestions.error")
          : config.pluginsLoading
            ? t("agentChat.inputbar.suggestions.loading")
            : undefined,
        items: plugins.map((plugin) => ({
          key: `plugin:${plugin.pluginId}`,
          label: resolveInputbarPluginDisplayName(plugin),
          detail: plugin.description,
          icon: <Blocks size={16} />,
          disabled: plugin.disabled || Boolean(plugin.blockerCodes?.length),
          onSelect: () => {
            const range = mentionRange();
            if (!range) return;
            insertComposerPlugin(controller, plugin, undefined, range);
            controller.dismissSuggestions();
            notify();
          },
        })),
      });
  }
  if (skillsOnly || (atMention && query.length > 0)) {
    const skills =
      config.skills?.filter(
        (skill) =>
          skill.installed &&
          matches(
            skill.name,
            skill.displayName ?? "",
            skill.key,
            skill.description,
          ),
      ) ?? [];
    if (skills.length || config.skillsLoading)
      sections.push({
        id: "skills",
        title: t("agentChat.inputbar.suggestions.skills"),
        status: config.skillsLoading
          ? t("agentChat.inputbar.suggestions.loading")
          : undefined,
        items: skills.map((skill) => ({
          key: `skill:${skill.key}`,
          label: skillDisplayName(skill),
          detail: skill.description,
          icon: <Sparkles size={16} />,
          onSelect: () => {
            const range = mentionRange();
            if (!range) return;
            insertComposerSkill(controller, skill, range);
            controller.dismissSuggestions();
            config.onSelectInputCapability?.({
              kind: "installed_skill",
              skill,
            });
            notify();
          },
        })),
      });
  }
  if (
    atMention &&
    (fileSearch.files.length ||
      fileSearch.status === "loading" ||
      fileSearch.status === "error")
  )
    sections.push({
      id: "files",
      title: t("agentChat.inputbar.suggestions.files"),
      status:
        fileSearch.status === "error"
          ? t("agentChat.inputbar.suggestions.error")
          : fileSearch.status === "loading"
            ? t("agentChat.inputbar.suggestions.loading")
            : undefined,
      items: fileSearch.files.map((file) => ({
        key: `file:${file.path}`,
        label: file.file_name,
        detail: file.path,
        icon: <File size={16} />,
        onSelect: () => {
          const range = mentionRange();
          if (!range) return;
          controller.insertMention(
            {
              kind: "file",
              id: file.path,
              name: file.file_name,
              path: file.path,
              label: file.path.includes(" ") ? `"${file.path}"` : file.path,
            },
            range,
          );
          controller.dismissSuggestions();
          notify();
        },
      })),
    });
  return createPortal(
    <div
      ref={panelRef}
      data-testid="composer-context-suggestions"
      className="fixed z-[80] overflow-hidden rounded-xl border border-[color:var(--lime-surface-border)] bg-[var(--lime-surface)] shadow-xl"
      style={{
        left: anchor.left,
        bottom: anchor.bottom,
        width: anchor.width,
        maxHeight: anchor.maxHeight,
      }}
    >
      <SuggestionList
        label={t("agentChat.inputbar.suggestions.label")}
        sections={sections}
        query={suggestion.query}
        keyboardTarget={editorRef.current?.getElement() ?? null}
        noResults={t("agentChat.inputbar.suggestions.noResults")}
        onRequestClose={() => {
          controller.dismissSuggestions();
          focus();
        }}
        onError={() => toast.error(t("agentChat.inputbar.suggestions.error"))}
      />
    </div>,
    document.body,
  );
}
