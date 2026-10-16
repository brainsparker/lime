import type { MutableRefObject } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ToolExecutionNetworkRuleConfig } from "@/lib/api/appConfig";
import type { ExecutionPolicyFocusContext } from "@/types/page";
import {
  resolveExecutionPolicyNetworkRuleSuggestion,
  type ExecutionPolicyNetworkRuleFocus,
} from "./executionPolicyFocus";

interface ExecutionPolicyNetworkFocusPanelProps {
  disabled?: boolean;
  focus?: ExecutionPolicyFocusContext | null;
  focusedNetworkRuleRef: MutableRefObject<HTMLDivElement | null>;
  networkRuleFocus: ExecutionPolicyNetworkRuleFocus | null;
  onAddSuggestedRule: (rule: ToolExecutionNetworkRuleConfig) => void;
}

export function ExecutionPolicyNetworkFocusPanel({
  disabled,
  focus,
  focusedNetworkRuleRef,
  networkRuleFocus,
  onAddSuggestedRule,
}: ExecutionPolicyNetworkFocusPanelProps) {
  const { t } = useTranslation("settings");
  const suggestion = networkRuleFocus
    ? null
    : resolveExecutionPolicyNetworkRuleSuggestion(focus);

  if (networkRuleFocus) {
    return (
      <div
        ref={(node) => {
          focusedNetworkRuleRef.current = node;
        }}
        className="mb-3 rounded-[18px] border border-[color:var(--lime-warning-border)] bg-[color:var(--lime-warning-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--lime-warning)]"
        data-testid="execution-policy-network-focus"
      >
        {t("settings.executionPolicy.focus.networkRule", {
          ruleId:
            networkRuleFocus.ruleId ||
            t("settings.executionPolicy.focus.unnamedRule"),
          target: t(
            `settings.executionPolicy.networkTarget.${networkRuleFocus.target}`,
          ),
          value: networkRuleFocus.value,
        })}
      </div>
    );
  }

  if (focus?.section !== "network") {
    return null;
  }

  const focusValue =
    focus.value ||
    focus.ruleId ||
    t("settings.executionPolicy.focus.unknownTarget");

  return (
    <div
      className="mb-3 rounded-[18px] border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground"
      data-testid="execution-policy-network-focus-missing"
    >
      <div>
        {t("settings.executionPolicy.focus.networkRuleMissing", {
          value: focusValue,
        })}
      </div>
      {suggestion ? (
        <div
          className="mt-3 flex flex-col gap-3 rounded-[16px] border border-primary/20 bg-background px-3 py-3 text-foreground sm:flex-row sm:items-center sm:justify-between"
          data-testid="execution-policy-network-suggestion"
        >
          <div className="min-w-0 text-xs leading-5">
            {t("settings.executionPolicy.focus.suggestedNetworkRule", {
              target: t(
                `settings.executionPolicy.networkTarget.${suggestion.target}`,
              ),
              value: suggestion.value,
            })}
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={() => onAddSuggestedRule(suggestion.rule)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("settings.executionPolicy.focus.addSuggestedNetworkRule")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
