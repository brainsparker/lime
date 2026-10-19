import { describe, expect, it } from "vitest";
import type { AgentThreadItem } from "../types";
import { isTimelineReadOnlyFileArtifact } from "./timelineFileArtifactKind";

function artifact(
  source: string,
  metadata?: Record<string, unknown>,
): AgentThreadItem {
  return {
    id: "artifact-1",
    thread_id: "thread-1",
    turn_id: "turn-1",
    sequence: 1,
    status: "completed",
    started_at: "2026-10-20T00:00:00Z",
    completed_at: "2026-10-20T00:00:01Z",
    updated_at: "2026-10-20T00:00:01Z",
    type: "file_artifact",
    path: "docs/result.md",
    source,
    metadata,
  };
}

describe("文件产物的只读语义", () => {
  it("当前文件读取与写入保留各自的动作语义", () => {
    expect(isTimelineReadOnlyFileArtifact(artifact("file_read"))).toBe(true);
    expect(isTimelineReadOnlyFileArtifact(artifact("write_file"))).toBe(false);
  });

  it("退役来源元数据不能把写入产物改判为读取", () => {
    for (const key of ["sourceProvenance", "source_provenance"]) {
      expect(
        isTimelineReadOnlyFileArtifact(
          artifact("write_file", { [key]: { operation: "read" } }),
        ),
      ).toBe(false);
    }
  });
});
