import type {
  ConversationProjectionDiagnostic,
  ConversationProjectionState,
} from "./contracts";

const MAX_DIAGNOSTICS = 200;

export function addDiagnostic(
  state: ConversationProjectionState,
  diagnostic: ConversationProjectionDiagnostic,
): ConversationProjectionState {
  return {
    ...state,
    diagnostics: appendDiagnostic(state.diagnostics, diagnostic),
  };
}

export function appendDiagnostic(
  diagnostics: readonly ConversationProjectionDiagnostic[],
  diagnostic: ConversationProjectionDiagnostic,
): ConversationProjectionDiagnostic[] {
  return [...diagnostics, diagnostic].slice(-MAX_DIAGNOSTICS);
}
