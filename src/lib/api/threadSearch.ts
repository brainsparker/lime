import { AppServerClient } from "@/lib/api/appServer";
import type {
  AppServerThreadSearchParams,
  AppServerThreadSearchResponse,
} from "@/lib/api/appServerTypes";

export const DESKTOP_THREAD_SEARCH_SOURCE_KINDS = [
  "appServer",
  "cli",
  "vscode",
] as const satisfies NonNullable<AppServerThreadSearchParams["sourceKinds"]>;

const DEFAULT_LIMIT = 25;

export type ThreadSearchAppServerClient = Pick<AppServerClient, "searchThreads">;

export async function searchDesktopThreads(
  params: {
    searchTerm: string;
    cursor?: string | null;
    limit?: number;
  },
  client: ThreadSearchAppServerClient = new AppServerClient(),
): Promise<AppServerThreadSearchResponse> {
  const searchTerm = params.searchTerm.trim();
  if (!searchTerm) {
    throw new Error("thread/search requires a non-empty searchTerm");
  }
  const limit = params.limit ?? DEFAULT_LIMIT;
  return (
    await client.searchThreads({
      searchTerm,
      cursor: params.cursor ?? null,
      limit,
      sortKey: "recency_at",
      sortDirection: "desc",
      archived: false,
      sourceKinds: [...DESKTOP_THREAD_SEARCH_SOURCE_KINDS],
    })
  ).result;
}
