import { describe, expect, it } from "vitest";
import { formatResizeReflowFailure } from "./claw-chat-current-fixture-resize-reflow-diagnostics.mjs";
import { sanitizeText } from "./claw-chat-current-fixture-utils.mjs";

const PRIVATE = "PRIVATE BODY https://private.invalid <div>raw HTML</div>";
const rect = {
  x: 302,
  y: 8,
  width: 966,
  height: 46,
  top: 8,
  left: 302,
  right: 1268,
  bottom: 54,
};

function snapshot() {
  const node = () => ({ exists: true, visible: true, rect: { ...rect } });
  return {
    label: "wide",
    url: PRIVATE,
    assistantTextPreview: PRIVATE.repeat(500),
    bodyText: PRIVATE.repeat(500),
    viewport: { width: 1280, height: 820 },
    activeThreadHeaderStable: true,
    activeThreadHeader: {
      stable: true,
      header: node(),
      context: node(),
      title: node(),
      status: node(),
      actions: node(),
      toolbar: { ...node(), visualRect: { ...rect } },
      taskCenterChromeShell: { exists: false, visible: false, rect: null },
      taskCenterTabStrip: { exists: false, visible: false, rect: null },
      taskCenterWorkspaceBar: { exists: false, visible: false, rect: null },
      compactModeBar: {
        exists: false,
        visible: false,
        rect: null,
        visualRect: null,
        expectedVisible: false,
        positionStable: true,
      },
      noContextActionsOverlap: true,
      childrenContained: true,
      noCompactModeBarOverlap: true,
    },
  };
}

function summaryError(label, value) {
  const error = new Error(formatResizeReflowFailure(label, value));
  error.stack += `\n${"    at fixture-frame\n".repeat(300)}`;
  return sanitizeText(error.stack || error.message);
}

const failures = [
  ["headerVisible", ["header", "visible"], false],
  ["titleVisible", ["title", "visible"], false],
  ["contextVisible", ["context", "visible"], false],
  ["actionsVisible", ["actions", "visible"], false],
  ["toolbarVisible", ["toolbar", "visible"], false],
  ["taskCenterChromeShellHidden", ["taskCenterChromeShell", "visible"], true],
  ["taskCenterTabStripHidden", ["taskCenterTabStrip", "visible"], true],
  ["taskCenterWorkspaceBarHidden", ["taskCenterWorkspaceBar", "visible"], true],
  ["noContextActionsOverlap", ["noContextActionsOverlap"], false],
  ["childrenContained", ["childrenContained"], false],
  ["noCompactModeBarOverlap", ["noCompactModeBarOverlap"], false],
  ["compactModeBarPositionStable", ["compactModeBar", "positionStable"], false],
];

describe("resize/reflow safe failure diagnostics", () => {
  it.each(failures)(
    "retains the %s counterexample in the existing truncated summary path",
    (check, path, value) => {
      const raw = snapshot();
      const target = path
        .slice(0, -1)
        .reduce((current, key) => current[key], raw.activeThreadHeader);
      target[path.at(-1)] = value;
      raw.activeThreadHeaderStable = false;
      raw.activeThreadHeader.stable = false;

      const error = summaryError("wide", raw);

      expect(error).toContain(`[truncated `);
      expect(error).toContain(`failedHeaderChecks=["${check}"]`);
      expect(error).toContain(`"${check}":false`);
      expect(error).toContain('headerStable={"snapshot":false,"header":false}');
      expect(error).not.toContain(PRIVATE);
      expect(error).not.toContain("https://");
      expect(error).not.toContain("assistantTextPreview");
    },
  );

  it("keeps every failed check before geometry even when all checks fail", () => {
    const raw = snapshot();
    for (const [, path, value] of failures) {
      const target = path
        .slice(0, -1)
        .reduce((current, key) => current[key], raw.activeThreadHeader);
      target[path.at(-1)] = value;
    }
    const error = summaryError("compact", raw);

    expect(error).toContain(`[truncated `);
    expect(error).toContain(
      `failedHeaderChecks=${JSON.stringify(failures.map(([check]) => check))}`,
    );
    for (const [check] of failures) expect(error).toContain(`"${check}":false`);
  });

  it("includes only allowlisted finite geometry and booleans", () => {
    const raw = snapshot();
    raw.activeThreadHeader.header = {
      exists: PRIVATE,
      visible: PRIVATE,
      text: PRIVATE,
      title: PRIVATE,
      html: PRIVATE,
      rect: {
        ...rect,
        x: PRIVATE,
        y: Infinity,
        width: NaN,
        top: -8,
        privateProperty: PRIVATE,
      },
    };
    raw.activeThreadHeader.toolbar.visualRect = { ...rect, rawHtml: PRIVATE };
    raw.activeThreadHeader.compactModeBar.expectedVisible = PRIVATE;
    raw.viewport.width = "1280";
    raw.viewport.location = PRIVATE;

    const message = formatResizeReflowFailure(PRIVATE, raw);
    const geometry = JSON.parse(message.split("; headerGeometry=")[1]);

    expect(message).toContain("未稳定: unknown;");
    expect(message).toContain('failedHeaderChecks=["headerVisible"]');
    expect(message).toContain('"headerVisible":null');
    expect(geometry.viewport).toEqual({ width: null, height: 820 });
    expect(geometry.header).toEqual({
      exists: null,
      visible: null,
      rect: { ...rect, x: null, y: null, width: null, top: -8 },
    });
    expect(geometry.toolbar.visualRect).toEqual(rect);
    expect(geometry.compactModeBar.expectedVisible).toBeNull();
    expect(message).not.toContain(PRIVATE);
    expect(message).not.toContain("privateProperty");
    expect(message).not.toContain("rawHtml");
  });

  it.each([null, undefined, {}])(
    "reports absent header observations as unknown instead of passing: %s",
    (raw) => {
      const message = formatResizeReflowFailure("restored", raw);

      expect(message).toContain("未稳定: restored;");
      expect(message).toContain(
        `failedHeaderChecks=${JSON.stringify(failures.map(([check]) => check))}`,
      );
      for (const [check] of failures)
        expect(message).toContain(`"${check}":null`);
      expect(message).toContain('headerStable={"snapshot":null,"header":null}');
    },
  );

  it("does not invent a header failure when the observed checks pass", () => {
    const message = formatResizeReflowFailure("wide", snapshot());

    expect(message).toContain("failedHeaderChecks=[];");
    for (const [check] of failures)
      expect(message).toContain(`"${check}":true`);
    expect(message).toContain('headerStable={"snapshot":true,"header":true}');
  });
});
