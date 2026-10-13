import { useCallback, useEffect, useRef, useState } from "react";
import { searchDesktopThreads } from "@/lib/api/threadSearch";
import {
  threadSearchResultToSidebarHit,
  type SidebarThreadSearchHit,
} from "./sidebarThreadSearch";

const SEARCH_DEBOUNCE_MS = 100;

interface SidebarThreadSearchState {
  query: string;
  hits: SidebarThreadSearchHit[];
  nextCursor: string | null;
  loading: boolean;
  error: boolean;
}

const EMPTY_STATE: SidebarThreadSearchState = {
  query: "",
  hits: [],
  nextCursor: null,
  loading: false,
  error: false,
};

export function useSidebarThreadSearch(query: string, enabled: boolean) {
  const [state, setState] = useState<SidebarThreadSearchState>(EMPTY_STATE);
  const generation = useRef(0);
  const normalizedQuery = query.trim();

  const run = useCallback(async (term: string, cursor: string | null) => {
    const current = ++generation.current;
    setState((previous) => ({
      query: term,
      hits: cursor ? previous.hits : [],
      nextCursor: cursor ? previous.nextCursor : null,
      loading: true,
      error: false,
    }));
    try {
      const page = await searchDesktopThreads({
        searchTerm: term,
        cursor,
      });
      if (generation.current !== current) {
        return;
      }
      const hits = page.data.flatMap((result) => {
        const hit = threadSearchResultToSidebarHit(result);
        return hit ? [hit] : [];
      });
      setState((previous) => ({
        query: term,
        hits: cursor ? [...previous.hits, ...hits] : hits,
        nextCursor: page.nextCursor?.trim() || null,
        loading: false,
        error: false,
      }));
    } catch {
      if (generation.current !== current) {
        return;
      }
      setState({
        query: term,
        hits: [],
        nextCursor: null,
        loading: false,
        error: true,
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !normalizedQuery) {
      generation.current += 1;
      setState(EMPTY_STATE);
      return;
    }
    const timer = window.setTimeout(() => {
      void run(normalizedQuery, null);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, normalizedQuery, run]);

  const loadMore = useCallback(() => {
    if (!enabled || !normalizedQuery || !state.nextCursor || state.loading) {
      return;
    }
    if (state.query !== normalizedQuery) {
      return;
    }
    void run(normalizedQuery, state.nextCursor);
  }, [
    enabled,
    normalizedQuery,
    run,
    state.loading,
    state.nextCursor,
    state.query,
  ]);

  const current = enabled && state.query === normalizedQuery;
  return {
    hits: current ? state.hits : [],
    loading: current && state.loading,
    error: current && state.error,
    hasMore: current && Boolean(state.nextCursor),
    loadMore,
  };
}
