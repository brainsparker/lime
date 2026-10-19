import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import { ThreadSummaryPanel } from "./ThreadSummaryPanel";

let container: HTMLDivElement;
let root: Root;

const search: AgentThreadItem = {
  id: "search-1",
  type: "web_search",
  query: "Lime reference",
  thread_id: "thread-a",
  turn_id: "turn-a",
  sequence: 1,
  status: "completed",
  started_at: "2026-10-19T00:00:00Z",
  updated_at: "2026-10-19T00:00:00Z",
  results: [
    { title: "First result", url: "https://example.com/one" },
    { title: "Second result", url: "https://example.com/two" },
  ],
};

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await changeLimeLocale("en-US");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(items: readonly AgentThreadItem[], threadId = "thread-a") {
  act(() =>
    root.render(<ThreadSummaryPanel threadId={threadId} threadItems={items} />),
  );
  return container.querySelector('[data-summary-section="tool-sources"]');
}

describe("Summary Web search source", () => {
  it("groups repeated searches into one non-interactive source", () => {
    const section = render([search, { ...search, id: "search-2" }]);
    expect(section?.textContent).toContain("Web search");
    expect(section?.textContent?.match(/Web search/g)).toHaveLength(1);
    expect(section?.textContent).not.toContain("First result");
    expect(section?.textContent).not.toContain("Second result");
    expect(section?.querySelector('button[title="Web search"]')).toBeNull();
    expect(section?.querySelector("a")).toBeNull();
    expect(section?.textContent).not.toContain("Add source");
  });

  it("keeps the canonical search source when it has no results", () => {
    const section = render([{ ...search, results: [], output: undefined }]);
    expect(section?.textContent).toContain("Web search");
    expect(section?.textContent).not.toContain("Add source");
  });

  it.each([
    ["blank query and results only", { query: "  " }, false],
    ["empty search", { query: "", results: [], output: undefined }, false],
    [
      "structured queries",
      { query: "", action_data: { type: "search", queries: [" ", "Lime"] } },
      true,
    ],
    [
      "blank structured queries",
      { action_data: { type: "search", queries: [" "] } },
      false,
    ],
    [
      "search query fallback",
      { action_data: { type: "search", queries: [], query: "Lime" } },
      true,
    ],
    [
      "opened page",
      {
        query: "",
        action_data: { type: "openPage", url: "https://example.com" },
      },
      true,
    ],
    [
      "find in page",
      {
        query: "",
        action_data: { type: "findInPage", url: "https://example.com" },
      },
      true,
    ],
    [
      "invalid opened page",
      { action_data: { type: "openPage", url: "invalid" } },
      false,
    ],
    [
      "local opened page",
      { action_data: { type: "openPage", url: "file:///tmp/source" } },
      false,
    ],
    [
      "credentialed page",
      {
        action_data: {
          type: "openPage",
          url: "https://user:secret@example.com",
        },
      },
      false,
    ],
  ] as const)(
    "uses canonical source presence for %s",
    (_label, fields, present) => {
      const section = render([{ ...search, ...fields }]);
      expect(Boolean(section?.textContent?.includes("Web search"))).toBe(
        present,
      );
    },
  );

  it("does not treat unrelated tool output as a Web search source", () => {
    render([
      {
        ...search,
        id: "warning",
        type: "warning",
        message: "https://example.com is not a source",
      },
    ]);
    expect(
      container.querySelector('[data-testid="thread-summary-panel"]'),
    ).toBeNull();
  });

  it("derives each conversation from its current canonical items", () => {
    expect(render([search])?.textContent).toContain("Web search");
    render([], "thread-b");
    expect(
      container.querySelector('[data-summary-section="tool-sources"]'),
    ).toBeNull();
    expect(render([search])?.textContent).toContain("Web search");
  });

  it.each([
    ["zh-CN", "网页搜索"],
    ["zh-TW", "網頁搜尋"],
    ["en-US", "Web search"],
    ["ja-JP", "ウェブ検索"],
    ["ko-KR", "웹 검색"],
  ])("renders the source label in %s", async (locale, label) => {
    await changeLimeLocale(locale);
    expect(render([search])?.textContent).toContain(label);
  });
});
