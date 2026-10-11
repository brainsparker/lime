use super::*;

pub(super) fn policy_block_events(
    tool_id: &str,
    tool: &TrackedTool,
    result: &AgentToolResult,
) -> Vec<RuntimeEvent> {
    if result.success {
        return Vec::new();
    }
    let diagnostics = policy_diagnostics(tool, result);

    match policy_block_kind(result) {
        Some(PolicyBlockKind::PermissionDenied) => vec![RuntimeEvent::new(
            "permission.denied",
            compact_object(json!({
                "toolCallId": tool_id,
                "toolName": tool.name,
                "reasonCode": policy_reason_code(result, "permission_denied"),
                "reason": policy_reason(result),
                "policyName": diagnostics.get("policyName").cloned(),
                "policyProfile": diagnostics.get("policyProfile").cloned(),
                "policyDecisionId": diagnostics.get("policyDecisionId").cloned(),
                "platform": diagnostics.get("platform").cloned(),
                "command": diagnostics.get("command").cloned(),
                "cwd": diagnostics.get("cwd").cloned(),
                "diagnostics": diagnostics,
                "source": "runtime_tool",
            })),
        )],
        Some(PolicyBlockKind::SandboxBlocked) => vec![RuntimeEvent::new(
            "sandbox.blocked",
            compact_object(json!({
                "toolCallId": tool_id,
                "toolName": tool.name,
                "reasonCode": policy_reason_code(result, "sandbox_blocked"),
                "reason": policy_reason(result),
                "sandboxPolicy": diagnostics.get("sandboxPolicy").cloned(),
                "policyProfile": diagnostics.get("policyProfile").cloned(),
                "policyDecisionId": diagnostics.get("policyDecisionId").cloned(),
                "platform": diagnostics.get("platform").cloned(),
                "command": diagnostics.get("command").cloned(),
                "cwd": diagnostics.get("cwd").cloned(),
                "diagnostics": diagnostics,
                "source": "runtime_tool",
            })),
        )],
        None => Vec::new(),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PolicyBlockKind {
    PermissionDenied,
    SandboxBlocked,
}

pub(super) fn policy_block_kind(result: &AgentToolResult) -> Option<PolicyBlockKind> {
    let metadata = result.metadata.as_ref();
    if metadata
        .and_then(|metadata| metadata_string(metadata, &["eventClass", "event_class"]))
        .as_deref()
        == Some("sandbox.blocked")
    {
        return Some(PolicyBlockKind::SandboxBlocked);
    }
    if metadata
        .and_then(|metadata| metadata_string(metadata, &["eventClass", "event_class"]))
        .as_deref()
        == Some("permission.denied")
    {
        return Some(PolicyBlockKind::PermissionDenied);
    }

    let category = metadata
        .and_then(|metadata| {
            metadata_string(
                metadata,
                &[
                    "failureCategory",
                    "failure_category",
                    "reasonCode",
                    "reason_code",
                    "code",
                ],
            )
        })
        .unwrap_or_default()
        .to_ascii_lowercase();
    if category.contains("sandbox") {
        return Some(PolicyBlockKind::SandboxBlocked);
    }
    if category.contains("permission") || category.contains("denied") || category.contains("policy")
    {
        return Some(PolicyBlockKind::PermissionDenied);
    }

    let text = format!(
        "{}\n{}",
        result.error.as_deref().unwrap_or_default(),
        result.output
    )
    .to_ascii_lowercase();
    if text.contains("sandbox") && (text.contains("block") || text.contains("denied")) {
        Some(PolicyBlockKind::SandboxBlocked)
    } else if text.contains("permission denied")
        || text.contains("access denied")
        || text.contains("policy denied")
        || text.contains("not allowed")
    {
        Some(PolicyBlockKind::PermissionDenied)
    } else {
        None
    }
}

pub(super) fn policy_reason_code(result: &AgentToolResult, fallback: &str) -> String {
    result
        .metadata
        .as_ref()
        .and_then(|metadata| metadata_string(metadata, &["reasonCode", "reason_code", "code"]))
        .unwrap_or_else(|| fallback.to_string())
}

pub(super) fn policy_reason(result: &AgentToolResult) -> Option<String> {
    result
        .metadata
        .as_ref()
        .and_then(|metadata| metadata_string(metadata, &["reason", "message"]))
        .or_else(|| result.error.as_deref().and_then(non_empty_string))
        .or_else(|| non_empty_string(&result.output))
}

pub(super) fn policy_diagnostics(tool: &TrackedTool, result: &AgentToolResult) -> Value {
    let metadata = result.metadata.as_ref();
    compact_object(json!({
        "policyName": metadata.and_then(|metadata| metadata_string(metadata, &["policyName", "policy_name", "policy"])),
        "policyProfile": metadata.and_then(|metadata| metadata_string(metadata, &["policyProfile", "policy_profile", "profile"])),
        "policyDecisionId": metadata.and_then(|metadata| metadata_string(metadata, &["policyDecisionId", "policy_decision_id", "decisionId", "decision_id"])),
        "sandboxPolicy": metadata.and_then(|metadata| metadata_string(metadata, &["sandboxPolicy", "sandbox_policy", "sandbox"])),
        "sandboxReason": metadata.and_then(|metadata| metadata_string(metadata, &["sandboxReason", "sandbox_reason"])),
        "platform": metadata.and_then(|metadata| metadata_string(metadata, &["platform", "os", "target_os"])).or_else(|| Some(std::env::consts::OS.to_string())),
        "arch": metadata.and_then(|metadata| metadata_string(metadata, &["arch", "target_arch"])).or_else(|| Some(std::env::consts::ARCH.to_string())),
        "toolSurface": metadata.and_then(|metadata| metadata_string(metadata, &["toolSurface", "tool_surface"])).unwrap_or_else(|| "runtime_tool".to_string()),
        "toolName": tool.name,
        "command": command_from_arguments(tool.arguments.as_ref()).or_else(|| metadata.and_then(|metadata| metadata_string(metadata, &["command", "cmd", "script"]))),
        "canonicalCommand": tool.command_facts.as_ref().map(|facts| facts.canonical_command.clone()),
        "commandSummary": tool.command_facts.as_ref().map(|facts| facts.summary.clone()),
        "commandArgv": tool.command_facts.as_ref().map(|facts| facts.argv.clone()),
        "commandArgvSource": tool.command_facts.as_ref().map(|facts| facts.source),
        "cwd": cwd_from_value(tool.arguments.as_ref()).or_else(|| metadata.and_then(|metadata| metadata_string(metadata, &["cwd", "workingDir", "working_dir"]))),
    }))
}
