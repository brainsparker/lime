export interface PresentationTrackSpan {
  index: number;
  count: number;
}

/** GUI 预检与原包写入共用原序排列约束；不可拆开或倒置既有合并跨度。 */
export function presentationTableMove({
  length,
  index,
  count = 1,
  insertionIndex,
  spans,
}: {
  length: number;
  index: number;
  count?: number;
  insertionIndex: number;
  spans: readonly PresentationTrackSpan[];
}):
  | { kind: "invalid"; reason: "range" | "merged" }
  | { kind: "unchanged" }
  | { kind: "move"; order: number[]; destination: number } {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    !Number.isInteger(count) ||
    count < 1 ||
    index + count > length ||
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > length
  )
    return { kind: "invalid", reason: "range" };
  if (insertionIndex >= index && insertionIndex <= index + count)
    return { kind: "unchanged" };
  const destination =
    insertionIndex > index ? insertionIndex - count : insertionIndex;
  const order = Array.from({ length }, (_, position) => position);
  order.splice(destination, 0, ...order.splice(index, count));
  const positions = new Map(order.map((old, position) => [old, position]));
  for (const span of spans)
    for (let offset = 1; offset < span.count; offset++)
      if (
        positions.get(span.index + offset) !==
        positions.get(span.index)! + offset
      )
        return { kind: "invalid", reason: "merged" };
  return { kind: "move", order, destination };
}
