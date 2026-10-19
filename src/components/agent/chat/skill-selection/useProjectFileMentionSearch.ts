import { useEffect, useId, useRef, useState } from "react";
import {
  searchProjectFiles,
  type ProjectFileSearchResult,
} from "@/lib/api/fuzzyFileSearch";
import { getProject } from "@/lib/api/project";

const SEARCH_DEBOUNCE_MS = 120;

export type ProjectFileMentionSearchStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

interface ProjectFileMentionSearchState {
  files: ProjectFileSearchResult[];
  status: ProjectFileMentionSearchStatus;
}

interface SearchResult extends ProjectFileMentionSearchState {
  identity: string;
}

export function useProjectFileMentionSearch(params: {
  active: boolean;
  projectId?: string | null;
  query: string;
}): ProjectFileMentionSearchState {
  const projectId = params.projectId?.trim() ?? "";
  const query = params.query.trim();
  const eligible = params.active && Boolean(projectId && query);
  const identity = JSON.stringify([eligible, projectId, query]);
  const [state, setState] = useState<SearchResult>({
    identity: "",
    files: [],
    status: "idle",
  });
  const searchOwnerId = useId();
  const cancellationToken = `composer-project-files-${searchOwnerId}`;
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;
    const abortController = new AbortController();

    if (!eligible) {
      setState({ identity, files: [], status: "idle" });
      return () => abortController.abort();
    }

    const timer = window.setTimeout(() => {
      setState({ identity, files: [], status: "loading" });
      void (async () => {
        try {
          const project = await getProject(projectId);
          const rootPath = project?.rootPath.trim();
          if (
            !rootPath ||
            abortController.signal.aborted ||
            requestVersionRef.current !== requestVersion
          ) {
            if (
              !abortController.signal.aborted &&
              requestVersionRef.current === requestVersion
            ) {
              setState({ identity, files: [], status: "idle" });
            }
            return;
          }

          const files = await searchProjectFiles(
            {
              query,
              rootPath,
              cancellationToken,
            },
            { signal: abortController.signal },
          );
          if (
            abortController.signal.aborted ||
            requestVersionRef.current !== requestVersion
          ) {
            return;
          }
          setState({ identity, files, status: "ready" });
        } catch {
          if (
            abortController.signal.aborted ||
            requestVersionRef.current !== requestVersion
          ) {
            return;
          }
          setState({ identity, files: [], status: "error" });
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [cancellationToken, eligible, identity, projectId, query]);

  return state.identity === identity
    ? { files: state.files, status: state.status }
    : { files: [], status: eligible ? "loading" : "idle" };
}
