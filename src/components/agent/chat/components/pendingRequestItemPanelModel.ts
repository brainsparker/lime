import type { ActionRequired, ApprovalDecision } from "../types";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function pendingApprovalDetails(request: ActionRequired) {
  const args = request.arguments;
  const networkValue = args?.networkApprovalContext;
  const network =
    networkValue &&
    typeof networkValue === "object" &&
    !Array.isArray(networkValue)
      ? (networkValue as Record<string, unknown>)
      : null;

  return {
    command: text(args?.command),
    cwd: text(args?.cwd),
    grantRoot: text(args?.grantRoot),
    networkHost: text(network?.host),
    networkProtocol: text(network?.protocol),
  };
}

export function availableApprovalDecisions(
  request: ActionRequired,
): ApprovalDecision[] {
  const declared = request.availableDecisions;
  if (declared === undefined) return ["decline", "allow_once"];
  return Array.from(
    new Set(
      declared.filter(
        (decision) =>
          decision === "allow_once" ||
          decision === "allow_for_session" ||
          decision === "decline" ||
          decision === "cancel",
      ),
    ),
  );
}
