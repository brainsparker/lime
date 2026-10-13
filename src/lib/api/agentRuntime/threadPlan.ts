import { isRecord, readField, readStringField } from "./canonicalReadFields";

export function canonicalTurnPlanItems(turns: unknown[]): Array<{
  content: string;
  status: "pending" | "in_progress" | "completed";
}> {
  let latest: Array<{
    content: string;
    status: "pending" | "in_progress" | "completed";
  }> | null = null;
  for (const turn of turns) {
    if (!isRecord(turn) || !Array.isArray(turn.items)) {
      continue;
    }
    for (const item of turn.items) {
      const snapshot = canonicalTurnPlanSnapshot(item);
      if (snapshot !== null) {
        latest = snapshot;
      }
    }
  }
  return latest ?? [];
}

function canonicalTurnPlanSnapshot(value: unknown): Array<{
  content: string;
  status: "pending" | "in_progress" | "completed";
}> | null {
  if (
    !isRecord(value) ||
    readStringField(value, "type") !== "dynamicToolCall"
  ) {
    return null;
  }
  const tool = readStringField(value, "tool")
    .replace(/[\s_-]+/gu, "")
    .toLowerCase();
  if (
    (tool !== "updateplan" && tool !== "updateplantool") ||
    readStringField(value, "status") !== "completed" ||
    value.success === false
  ) {
    return null;
  }
  const plan = canonicalUpdatePlanArgument(readField(value, "arguments"));
  if (!plan) {
    return null;
  }
  const snapshot: Array<{
    content: string;
    status: "pending" | "in_progress" | "completed";
  }> = [];
  for (const candidate of plan) {
    if (!isRecord(candidate)) {
      return null;
    }
    const content = readStringField(candidate, "step").trim();
    const status = readStringField(candidate, "status");
    if (
      !content ||
      (status !== "pending" &&
        status !== "in_progress" &&
        status !== "completed")
    ) {
      return null;
    }
    snapshot.push({ content, status });
  }
  return snapshot;
}

function canonicalUpdatePlanArgument(value: unknown): unknown[] | null {
  if (isRecord(value)) {
    return Array.isArray(value.plan) ? value.plan : null;
  }
  if (!Array.isArray(value)) {
    return null;
  }

  const planArguments = value.filter(
    (candidate) =>
      isRecord(candidate) && readStringField(candidate, "name") === "plan",
  );
  if (planArguments.length !== 1) {
    return null;
  }
  const planValue = (planArguments[0] as Record<string, unknown>).value;
  if (Array.isArray(planValue)) {
    return planValue;
  }
  if (typeof planValue !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(planValue) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
