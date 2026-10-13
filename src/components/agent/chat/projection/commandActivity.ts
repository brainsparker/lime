export function isRunningSessionCommand(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    item.type === "command_execution" &&
    item.status === "in_progress" &&
    item.source === "unifiedExecStartup" &&
    typeof item.process_id === "string" &&
    item.process_id.trim().length > 0
  );
}

export function hasRunningSessionCommand(items: readonly unknown[]): boolean {
  return items.some(isRunningSessionCommand);
}
