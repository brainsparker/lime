type FileTreeEntry = { name: string; isDir: boolean };

function tokenizeName(value: string): Array<string | number> {
  return (value.match(/[0-9]+|[^0-9]+/g) ?? [""]).map((part) => {
    if (!/^[0-9]+$/.test(part)) return part;
    let number = 0;
    for (let index = 0; index < part.length; index += 1) {
      number = number * 10 + part.charCodeAt(index) - 48;
    }
    return number;
  });
}

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareNames(left: string, right: string): number {
  const lowerLeft = left.toLowerCase();
  const lowerRight = right.toLowerCase();
  const leftTokens = tokenizeName(lowerLeft);
  const rightTokens = tokenizeName(lowerRight);
  for (
    let index = 0;
    index < Math.min(leftTokens.length, rightTokens.length);
    index += 1
  ) {
    const a = leftTokens[index];
    const b = rightTokens[index];
    if (a === b) continue;
    const order =
      typeof a === "number" && typeof b === "number"
        ? a < b
          ? -1
          : 1
        : compareText(String(a), String(b));
    if (order !== 0) return order;
  }
  return (
    leftTokens.length - rightTokens.length ||
    compareText(lowerLeft, lowerRight) ||
    compareText(left, right)
  );
}

export function sortFileTreeEntries<T extends FileTreeEntry>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (left, right) =>
      Number(right.isDir) - Number(left.isDir) ||
      compareNames(left.name, right.name),
  );
}
