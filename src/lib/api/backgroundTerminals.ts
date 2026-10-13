import {
  AppServerClient,
  type AppServerThreadBackgroundTerminal,
  type AppServerThreadBackgroundTerminalsCleanResponse,
  type AppServerThreadBackgroundTerminalsListResponse,
  type AppServerThreadBackgroundTerminalsTerminateResponse,
} from "@/lib/api/appServer";

const PAGE_LIMIT = 100;

export type BackgroundTerminalsAppServerClient = Pick<
  AppServerClient,
  | "listThreadBackgroundTerminals"
  | "terminateThreadBackgroundTerminal"
  | "cleanThreadBackgroundTerminals"
>;

export async function listBackgroundTerminals(
  threadId: string,
  client: BackgroundTerminalsAppServerClient = new AppServerClient(),
): Promise<AppServerThreadBackgroundTerminal[]> {
  const id = requiredId(threadId, "threadId");
  const terminals: AppServerThreadBackgroundTerminal[] = [];
  let cursor: string | null = null;
  const visitedCursors = new Set<string>();
  while (true) {
    const page: AppServerThreadBackgroundTerminalsListResponse = (
      await client.listThreadBackgroundTerminals({
        threadId: id,
        cursor,
        limit: PAGE_LIMIT,
      })
    ).result;
    terminals.push(...page.data);
    const nextCursor = page.nextCursor ?? null;
    if (!nextCursor) {
      return terminals;
    }
    if (visitedCursors.has(nextCursor)) {
      throw new Error("background terminal pagination cursor repeated");
    }
    visitedCursors.add(nextCursor);
    cursor = nextCursor;
  }
}

export async function cleanBackgroundTerminals(
  threadId: string,
  client: BackgroundTerminalsAppServerClient = new AppServerClient(),
): Promise<AppServerThreadBackgroundTerminalsCleanResponse> {
  const id = requiredId(threadId, "threadId");
  return (await client.cleanThreadBackgroundTerminals({ threadId: id })).result;
}

export async function terminateBackgroundTerminalForItem(
  params: { threadId: string; itemId: string },
  client: BackgroundTerminalsAppServerClient = new AppServerClient(),
): Promise<AppServerThreadBackgroundTerminalsTerminateResponse> {
  const threadId = requiredId(params.threadId, "threadId");
  const itemId = requiredId(params.itemId, "itemId");
  const terminal = await findBackgroundTerminal(threadId, itemId, client);
  if (!terminal) {
    return { terminated: false };
  }
  return (
    await client.terminateThreadBackgroundTerminal({
      threadId,
      processId: terminal.processId,
    })
  ).result;
}

async function findBackgroundTerminal(
  threadId: string,
  itemId: string,
  client: BackgroundTerminalsAppServerClient,
) {
  const terminals = await listBackgroundTerminals(threadId, client);
  return terminals.find((candidate) => candidate.itemId === itemId) ?? null;
}

function requiredId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`background terminal ${name} is required`);
  }
  return trimmed;
}
