import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import { ThreadSummaryPanel } from "./ThreadSummaryPanel";
import { selectThreadSummary } from "./threadSummaryProjection";
import {
  getThreadSummaryContentShift,
  getThreadSummaryDisplayMode,
} from "./threadSummaryPanelLayout";

const base = {
  thread_id: "thread-1",
  turn_id: "turn-1",
  sequence: 1,
  status: "completed",
  started_at: "2026-10-18T00:00:00Z",
  updated_at: "2026-10-18T00:00:00Z",
} as const;
const items: AgentThreadItem[] = [
  { ...base, id: "plan-old", type: "plan", text: "Superseded plan" },
  { ...base, id: "warning-1", type: "warning", message: "Keep in timeline" },
  { ...base, id: "plan-1", type: "plan", text: "Current canonical plan" },
  {
    ...base,
    id: "file-1",
    type: "file_artifact",
    path: "result.md",
    source: "tool",
    content: "Saved output",
  },
  {
    ...base,
    id: "search-1",
    type: "web_search",
    results: [{ title: "Reference", url: "https://example.com/reference" }],
  },
];
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await changeLimeLocale("en-US");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await changeLimeLocale("en-US");
});

describe("Thread Summary canonical projection and actions", () => {
  it("opens canonical outputs, the latest plan, child threads and actual search sources through existing actions", () => {
    const file = vi.fn(),
      output = vi.fn(),
      source = vi.fn(),
      child = vi.fn();
    act(() =>
      root.render(
        <ThreadSummaryPanel
          threadItems={items}
          canonicalChildren={[
            {
              name: "Reviewer",
              threadId: "child-1",
              sessionId: "session-child",
              parentThreadId: "thread-1",
              status: "running",
              updatedAtMs: 1,
            },
          ]}
          onFileClick={file}
          onOpenArtifactFromTimeline={output}
          onOpenUrlPreview={source}
          onOpenSubagentSession={child}
        />,
      ),
    );
    expect(
      [...container.querySelectorAll("[data-summary-section]")].map((node) =>
        node.getAttribute("data-summary-section"),
      ),
    ).toEqual(["outputs", "plan", "background-subagents", "tool-sources"]);
    for (const title of ["result.md", "Plan", "Reviewer", "Reference"]) {
      act(() =>
        (
          container.querySelector(
            `button[title="${title}"]`,
          ) as HTMLButtonElement
        ).click(),
      );
    }
    expect(output).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: "result.md",
        timelineItemId: "file-1",
      }),
    );
    expect(file).toHaveBeenCalledWith("plan.md", "Current canonical plan");
    expect(child).toHaveBeenCalledWith("child-1");
    expect(source).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/reference" }),
    );
    expect(container.textContent).not.toContain("Keep in timeline");
    expect(container.textContent).not.toContain("Superseded plan");
  });

  it("hides absent sections and keeps section expansion independent of canonical refresh", () => {
    act(() =>
      root.render(
        <ThreadSummaryPanel
          threadItems={items.filter((item) => item.type === "plan")}
        />,
      ),
    );
    const button = container.querySelector(
      "[aria-expanded]",
    ) as HTMLButtonElement;
    act(() => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("false");
    act(() =>
      root.render(
        <ThreadSummaryPanel
          threadItems={[
            ...items.filter((item) => item.type === "plan"),
            {
              ...base,
              id: "plan-2",
              type: "plan",
              text: "Next canonical revision",
            },
          ]}
        />,
      ),
    );
    expect(container.querySelector("[aria-expanded]")).toBe(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelectorAll("[data-summary-section]")).toHaveLength(
      1,
    );
    expect(
      selectThreadSummary(items.filter((item) => item.type === "warning")),
    ).toEqual({ plan: null, outputs: [], sources: [] });
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
    "renders translated Summary sections in %s",
    async (locale) => {
      await changeLimeLocale(locale);
      act(() =>
        root.render(
          <ThreadSummaryPanel threadItems={items} persistenceError />,
        ),
      );
      expect(container.textContent).not.toContain("agentChat.summary.");
      expect(
        container.querySelector("[role=status]")?.textContent,
      ).toBeTruthy();
    },
  );

  it("uses main-pane geometry for shipped overlay/shift/gutter thresholds", () => {
    expect(
      [1095, 1096, 1535, 1536].map((width) =>
        getThreadSummaryDisplayMode(width),
      ),
    ).toEqual(["overlay", "shift", "shift", "gutter"]);
    expect(getThreadSummaryDisplayMode(1135, 340)).toBe("overlay");
    expect(getThreadSummaryDisplayMode(1136, 340)).toBe("shift");
    expect(getThreadSummaryContentShift("shift", true)).toBe(-154);
    expect(getThreadSummaryContentShift("shift", true, 340)).toBe(-174);
    expect(getThreadSummaryContentShift("gutter", true)).toBe(0);
    expect(getThreadSummaryContentShift("overlay", true)).toBe(0);
    expect(getThreadSummaryContentShift("shift", false)).toBe(0);
  });
});
