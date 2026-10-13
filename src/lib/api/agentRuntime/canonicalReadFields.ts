export function canonicalTimestamp(value: number): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? new Date(0).toISOString()
    : timestamp.toISOString();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(record, camelKey)) {
    return record[camelKey];
  }
  return snakeKey ? record[snakeKey] : undefined;
}

export function readStringField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): string {
  const value = readField(record, camelKey, snakeKey);
  return typeof value === "string" ? value : "";
}

export function readOptionalStringField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): string | undefined {
  const value = readField(record, camelKey, snakeKey);
  return typeof value === "string" ? value : undefined;
}

export function readOptionalNumberField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): number | undefined {
  const value = readField(record, camelKey, snakeKey);
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function readOptionalBooleanField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): boolean | undefined {
  const value = readField(record, camelKey, snakeKey);
  return typeof value === "boolean" ? value : undefined;
}

export function readStringArrayField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): string[] {
  const value = readField(record, camelKey, snakeKey);
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

export function readOptionalObjectField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): Record<string, unknown> | undefined {
  const value = readField(record, camelKey, snakeKey);
  return isRecord(value) ? value : undefined;
}

export function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}
