import { useEffect, useMemo, useState } from "react";
import { AppServerClient } from "@/lib/api/appServer";
import {
  collectThreadOutputs,
  type ThreadOutputsInput,
  type ThreadOutput,
} from "./threadOutputs";

const empty: readonly ThreadOutput[] = [];

function parentDirectory(path: string): string {
  const parent = path.slice(0, path.lastIndexOf("/"));
  return /^[a-z]:$/i.test(parent) ? `${parent}/` : parent || "/";
}

export function useThreadOutputs(
  input: ThreadOutputsInput,
  enabled: boolean,
): readonly ThreadOutput[] {
  const { threadId, turns, items, cwd, projectlessOutputDirectory } = input;
  // 流式消息更新不应反复清空同一目录或重发相同的文件系统请求。
  const serializedCandidates = useMemo(
    () =>
      JSON.stringify(
        enabled
          ? collectThreadOutputs({
              threadId,
              turns,
              items,
              cwd,
              projectlessOutputDirectory,
            })
          : empty,
      ),
    [enabled, threadId, turns, items, cwd, projectlessOutputDirectory],
  );
  const candidates = useMemo(
    () => JSON.parse(serializedCandidates) as readonly ThreadOutput[],
    [serializedCandidates],
  );
  const nonFileOutputs = useMemo(
    () => candidates.filter((output) => output.type === "website").slice(0, 24),
    [candidates],
  );
  const [checked, setChecked] = useState<{
    candidates: typeof candidates;
    outputs: readonly ThreadOutput[];
  } | null>(null);
  useEffect(() => {
    const parents = [
      ...new Set(
        candidates.flatMap((output) =>
          output.type === "website" ? [] : [parentDirectory(output.path)],
        ),
      ),
    ];
    if (!parents.length) return;
    let current = true;
    const client = new AppServerClient();
    // 复用 fs/readDirectory；成功的空目录与查询失败具有不同语义。
    void Promise.all(
      parents.map(async (path) => {
        const { result } = await client.readDirectory({ path });
        return [
          path,
          new Set(result.entries.map((entry) => entry.fileName)),
        ] as const;
      }),
    ).then(
      (entries) => {
        if (!current) return;
        const directories = new Map(entries);
        setChecked({
          candidates,
          outputs: candidates
            .filter((output) => {
              if (output.type === "website") return true;
              const { path } = output;
              const index = path.lastIndexOf("/");
              return directories
                .get(parentDirectory(path))
                ?.has(path.slice(index + 1));
            })
            .slice(0, 24),
        });
      },
      () => {
        if (current)
          setChecked({ candidates, outputs: candidates.slice(0, 24) });
      },
    );
    return () => {
      current = false;
    };
  }, [candidates]);
  return checked?.candidates === candidates ? checked.outputs : nonFileOutputs;
}
