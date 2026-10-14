import { describe, expect, it } from "vitest";
import { browserState } from "./browserWorkspace.testFixtures";
import { projectBrowserTabChanges } from "./browserTabHydration";

describe("Browser event and snapshot projection", () => {
  it("lets events during the read replace stale selection and URL", () => {
    const first = browserState();
    const second = browserState({
      selected: false,
      tabId: "second",
      viewId: "second-view",
    });
    const next = {
      ...second,
      selected: true,
      url: "https://example.com/latest",
    };
    expect(
      projectBrowserTabChanges(
        [first, second],
        [{ kind: "state", state: next }],
        first,
        new Set(),
      ),
    ).toEqual([{ ...first, selected: false }, next]);
  });

  it("keeps a close tombstone across stale snapshots and operation responses", () => {
    const first = browserState();
    const closed = new Set<string>();
    const changes = [
      {
        kind: "closed" as const,
        event: {
          browserSessionId: first.browserSessionId,
          threadId: first.threadId,
          tabId: first.tabId,
          viewId: first.viewId,
          reason: "closed",
        },
      },
      { kind: "state" as const, state: first },
    ];
    expect(projectBrowserTabChanges([first], changes, first, closed)).toEqual(
      [],
    );
    expect(
      projectBrowserTabChanges(
        [first],
        [{ kind: "state", state: first }],
        first,
        closed,
      ),
    ).toEqual([]);
    const replacement = {
      ...first,
      viewId: "replacement-view",
      webContentsId: 202,
    };
    expect(
      projectBrowserTabChanges(
        [],
        [{ kind: "state", state: replacement }],
        first,
        closed,
      ),
    ).toEqual([replacement]);
  });

  it.each([
    { threadId: "foreign" },
    { browserSessionId: "foreign" },
    { ownerWebContentsId: 42 },
    { windowId: 8 },
  ])("ignores foreign state events %j", (overrides) => {
    const first = browserState();
    expect(
      projectBrowserTabChanges(
        [first],
        [
          {
            kind: "state",
            state: { ...first, ...overrides, url: "https://foreign.example" },
          },
        ],
        first,
        new Set(),
      ),
    ).toEqual([first]);
  });
});
