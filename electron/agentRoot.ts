const AGENT_ROOT_ARGUMENT = "--agent-root=";

function isAbsolutePath(value: string): boolean {
  return !value.includes("\0") && /^(?:\/|[a-z]:[\\/]|\\\\)/i.test(value);
}

export function buildAgentRootArgument(agentRoot: string): string {
  if (!isAbsolutePath(agentRoot)) {
    throw new Error("Agent root must be an absolute path");
  }
  return `${AGENT_ROOT_ARGUMENT}${encodeURIComponent(agentRoot)}`;
}

/** Main 只投影已解析的数据根；缺失或歧义参数不能回退真实用户目录。 */
export function readAgentRootArgument(
  argv: readonly string[],
): string | undefined {
  const matches = argv.filter((argument) =>
    argument.startsWith(AGENT_ROOT_ARGUMENT),
  );
  if (matches.length !== 1) return undefined;
  try {
    const root = decodeURIComponent(
      matches[0].slice(AGENT_ROOT_ARGUMENT.length),
    );
    return isAbsolutePath(root) ? root : undefined;
  } catch {
    return undefined;
  }
}
