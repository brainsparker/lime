import { describe, expect, it } from "vitest";
import type { Config } from "@/lib/api/appConfig";
import {
  mergeExecutionPolicyDraft,
  readExecutionPolicyDraft,
} from "./executionPolicyConfig";

const initial = {
  default_provider: "openai",
  agent: {
    tool_execution: { tool_overrides: { Bash: { warning_policy: "none" } } },
  },
} as Config;

describe("execution policy field ownership", () => {
  it("projects existing defaults without inventing model settings", () => {
    expect(readExecutionPolicyDraft()).toEqual({
      enabled: false,
      strict: false,
      notify_on_fallback: true,
      updatePlanEnabled: false,
      bashWarningPolicy: "shell_command_risk",
      shellRules: [],
      networkRules: [],
    });
  });

  it.each(["enabled", "strict", "notify_on_fallback"] as const)(
    "merges only sandbox %s into later sandbox and agent fields",
    (field) => {
      const snapshot = readExecutionPolicyDraft(initial);
      const current = {
        ...initial,
        language: "ja-JP",
        agent: {
          ...initial.agent,
          default_model: "later",
          workspace_sandbox: {
            enabled: true,
            strict: true,
            notify_on_fallback: false,
          },
        },
      };
      const draft = { ...snapshot, [field]: !snapshot[field] };
      expect(mergeExecutionPolicyDraft(current, draft, snapshot)).toEqual({
        ...current,
        agent: {
          ...current.agent,
          workspace_sandbox: {
            ...current.agent.workspace_sandbox,
            [field]: draft[field],
          },
        },
      });
    },
  );

  it("canonicalizes edited bash on the latest overrides and preserves all other overrides", () => {
    const snapshot = readExecutionPolicyDraft(initial);
    const current = {
      ...initial,
      agent: {
        tool_execution: {
          tool_overrides: {
            Bash: { warning_policy: "none" as const },
            bash: {
              warning_policy: "none" as const,
              restriction_profile: "workspace_shell_command" as const,
            },
            read: { warning_policy: "none" as const },
          },
          network_rules: [{ rule_id: "later", pattern: "later.test" }],
        },
      },
    };
    expect(
      mergeExecutionPolicyDraft(
        current,
        { ...snapshot, bashWarningPolicy: "shell_command_risk" },
        snapshot,
      ),
    ).toEqual({
      ...current,
      agent: {
        ...current.agent,
        tool_execution: {
          ...current.agent.tool_execution,
          tool_overrides: {
            bash: {
              warning_policy: "shell_command_risk",
              restriction_profile: "workspace_shell_command",
              sandbox_profile: "workspace_command",
            },
            read: { warning_policy: "none" },
          },
        },
      },
    });
  });

  it("changes only plan exposure without normalizing unedited legacy overrides or adding models", () => {
    const snapshot = readExecutionPolicyDraft(initial);
    expect(
      mergeExecutionPolicyDraft(
        initial,
        { ...snapshot, updatePlanEnabled: true },
        snapshot,
      ),
    ).toEqual({
      ...initial,
      agent: {
        ...initial.agent,
        tool_execution: {
          ...initial.agent!.tool_execution,
          update_plan_enabled: true,
        },
      },
    });
  });

  it.each(["shellRules", "networkRules"] as const)(
    "removes %s atomically while retaining the other later list",
    (field) => {
      const config = {
        ...initial,
        agent: {
          ...initial.agent,
          tool_execution: {
            ...initial.agent!.tool_execution,
            shell_command_rules: [{ rule_id: "shell", pattern: "echo" }],
            network_rules: [{ rule_id: "network", pattern: "example.test" }],
          },
        },
      };
      const snapshot = readExecutionPolicyDraft(config);
      const current = structuredClone(config);
      current.agent.tool_execution.shell_command_rules[0].pattern =
        "later shell";
      current.agent.tool_execution.network_rules[0].pattern = "later network";
      const expected = structuredClone(current);
      expected.agent.tool_execution[
        field === "shellRules" ? "shell_command_rules" : "network_rules"
      ] = [];
      expect(
        mergeExecutionPolicyDraft(
          current,
          { ...snapshot, [field]: [] },
          snapshot,
        ),
      ).toEqual(expected);
      expect(config.agent.tool_execution.shell_command_rules[0].pattern).toBe(
        "echo",
      );
    },
  );
});
