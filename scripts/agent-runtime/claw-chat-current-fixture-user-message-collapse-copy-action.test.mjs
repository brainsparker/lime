import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readCopyActionDom,
  prepareCopyAction,
  summarizeCopyActionGeometry,
  summarizeCopyActionPreparation,
  summarizeCopyActionPhases,
} from "./claw-chat-current-fixture-user-message-collapse-copy-action.mjs";

const PRIVATE = "PRIVATE BODY / token https://private.invalid";
const expected = {
  itemId: "copy-item",
  turnId: "copy-turn",
  clientId: "copy-client",
};
const previousHitTest = Object.getOwnPropertyDescriptor(
  document,
  "elementFromPoint",
);
let bubble, footer, button, inner, container, hit;

function setRect(node, value) {
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
    x: value.left,
    y: value.top,
    width: value.right - value.left,
    height: value.bottom - value.top,
    ...value,
  });
}
function reveal() {
  footer.style.maxHeight = "24px";
  footer.style.opacity = "1";
  footer.style.pointerEvents = "auto";
  hit = inner;
}
function read() {
  return readCopyActionDom(button, expected);
}

beforeEach(() => {
  document.body.innerHTML = `
    <div data-testid="message-turn-group" data-render-entry-kind="canonical_turn">
      <div id="container" style="display:flex;flex-direction:column;overflow:hidden;flex-shrink:1;height:300px">
        <div data-message-role="user" data-thread-item-id="copy-item" data-runtime-turn-id="copy-turn" data-message-id="copy-client">
          <div class="space-y-2 private-class"><a href="https://private.invalid">${PRIVATE}</a></div>
        </div>
        <div data-testid="user-message-footer" style="display:flex;flex-shrink:0;overflow:hidden;max-height:0px;opacity:0;pointer-events:none">
          <button title="${PRIVATE}" aria-label="${PRIVATE}" style="display:inline-flex;flex-shrink:1"><span>${PRIVATE}</span></button>
        </div>
      </div>
    </div>`;
  bubble = document.querySelector('[data-message-role="user"]');
  footer = document.querySelector('[data-testid="user-message-footer"]');
  button = document.querySelector("button");
  inner = button.querySelector("span");
  container = document.querySelector("#container");
  setRect(bubble, { left: 100, top: 10, right: 500, bottom: 310 });
  setRect(footer, { left: 100, top: 290, right: 500, bottom: 314 });
  setRect(button, { left: 120, top: 290, right: 144, bottom: 314 });
  setRect(container, { left: 100, top: 10, right: 500, bottom: 310 });
  hit = bubble.querySelector(".space-y-2");
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(() => hit),
  });
});
afterEach(() => {
  if (previousHitTest)
    Object.defineProperty(document, "elementFromPoint", previousHitTest);
  else delete document.elementFromPoint;
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("safe copy action geometry", () => {
  it("distinguishes a hidden footer and bubble subtree hit from a button descendant after reveal", () => {
    const before = summarizeCopyActionGeometry(read());
    expect(before).toMatchObject({
      bubbleCount: 1,
      identityMatches: true,
      bubble: { rect: { top: 10, bottom: 310, height: 300 } },
      footer: {
        rect: { top: 290, height: 24 },
        layout: {
          maxHeight: "0px",
          pointerEvents: "none",
          opacity: 0,
          flexShrink: 0,
        },
      },
      button: { rect: { left: 120, right: 144, height: 24 } },
      container: {
        layout: {
          display: "flex",
          flexDirection: "column",
          flexShrink: 1,
          overflowY: "unknown",
        },
      },
      center: { x: 132, y: 302, insideViewport: true },
      hit: { relation: "user-bubble-descendant", acceptsButton: false },
    });
    expect(before.hit.path[0]).toMatchObject({
      isSpaceStack: true,
      insideBubble: true,
    });
    expect(document.elementFromPoint).toHaveBeenCalledWith(132, 302);
    reveal();
    const after = summarizeCopyActionGeometry(read());
    expect(after).toMatchObject({
      footer: {
        layout: { maxHeight: "24px", opacity: 1, pointerEvents: "auto" },
      },
      hit: { relation: "copy-button-descendant", acceptsButton: true },
    });
    expect(after.hit.path[0]).toMatchObject({ insideButton: true });
    expect(after.hit.path[1]).toMatchObject({ isButton: true });
    expect(JSON.stringify({ before, after })).not.toContain(PRIVATE);
    expect(JSON.stringify({ before, after })).not.toContain("private-class");
    expect(JSON.stringify({ before, after })).not.toContain("https://");
  });

  it.each(["bubble", "footer", "button", "other", "none"])(
    "classifies the button center hit on %s",
    (target) => {
      hit = { bubble, footer, button, other: document.body, none: null }[
        target
      ];
      const expectedRelation = {
        bubble: "user-bubble",
        footer: "footer",
        button: "copy-button",
        other: "other",
        none: "none",
      }[target];
      expect(read().hit).toMatchObject({
        relation: expectedRelation,
        acceptsButton: target === "button",
      });
    },
  );

  it("does not claim identity when the bubble client or canonical candidates differ", () => {
    bubble.dataset.messageId = "wrong-client";
    expect(read().identityMatches).toBe(false);
    bubble.dataset.messageId = expected.clientId;
    container.insertBefore(bubble.cloneNode(true), footer);
    expect(read()).toMatchObject({
      bubbleCount: 2,
      identityMatches: false,
      bubble: null,
    });
  });

  it("keeps the DOM observer independently serializable", () => {
    const callback = Function(`return (${readCopyActionDom.toString()})`)();
    expect(callback(button, expected)).toEqual(read());
  });

  it("bounds hit paths and rejects raw CSS, attributes and inconsistent acceptsButton claims", () => {
    const safe = summarizeCopyActionGeometry({
      body: PRIVATE,
      error: PRIVATE,
      button: {
        tag: PRIVATE,
        rect: { width: Infinity, text: PRIVATE },
        layout: {
          flexBasis: `url(${PRIVATE})`,
          flexShrink: 1,
          height: PRIVATE,
          transform: PRIVATE,
          pointerEvents: PRIVATE,
        },
      },
      hit: {
        relation: "user-bubble",
        acceptsButton: true,
        path: Array.from({ length: 20 }, () => ({
          tag: "DIV",
          testId: PRIVATE,
          className: PRIVATE,
          href: PRIVATE,
          text: PRIVATE,
        })),
      },
    });
    expect(safe.button).toMatchObject({
      tag: "unknown",
      rect: { width: null },
      layout: {
        flexBasis: "unknown",
        flexShrink: 1,
        height: "unknown",
        pointerEvents: "unknown",
      },
    });
    expect(safe.hit).toMatchObject({
      relation: "user-bubble",
      acceptsButton: false,
      pathTruncated: true,
    });
    expect(safe.hit.path).toHaveLength(8);
    expect(JSON.stringify(safe)).not.toContain(PRIVATE);
  });
});

describe("real locator hover preparation contract with controlled dependencies", () => {
  function controlled({ hoverError, buttonError, observationError } = {}) {
    const actions = [];
    const bubbleLocator = {
      hover: vi.fn(async () => {
        actions.push("bubble-hover");
        if (hoverError) throw hoverError;
        reveal();
      }),
    };
    const copyButton = {
      hover: vi.fn(async () => {
        actions.push("button-hover");
        if (buttonError) throw buttonError;
      }),
      evaluate: vi.fn(async (callback, argument) => {
        actions.push("capture");
        if (observationError) throw observationError;
        return callback(button, argument);
      }),
    };
    const ensureVisible = vi.fn(async () => {
      actions.push("wheel-preparation");
    });
    return {
      args: { bubble: bubbleLocator, copyButton, expected, ensureVisible },
      actions,
      bubbleLocator,
      copyButton,
      ensureVisible,
    };
  }

  it("records hidden state then uses bubble hover, viewport preparation and button hover before copying", async () => {
    const fixture = controlled();
    const evidence = await prepareCopyAction(fixture.args);
    expect(fixture.actions).toEqual([
      "capture",
      "bubble-hover",
      "capture",
      "wheel-preparation",
      "button-hover",
      "capture",
    ]);
    expect(fixture.bubbleLocator.hover).toHaveBeenCalledExactlyOnceWith();
    expect(fixture.copyButton.hover).toHaveBeenCalledExactlyOnceWith();
    expect(fixture.ensureVisible).toHaveBeenCalledExactlyOnceWith(
      fixture.copyButton,
    );
    expect(evidence).toMatchObject({
      input: "locator-hover",
      bubbleHoverCompleted: true,
      buttonHoverCompleted: true,
      observations: {
        beforeHover: {
          hit: { acceptsButton: false },
          footer: { layout: { opacity: 0 } },
        },
        afterBubbleHover: { hit: { acceptsButton: true } },
        ready: { hit: { acceptsButton: true } },
      },
    });
  });

  it.each(["hoverError", "buttonError"])(
    "preserves the %s and attaches only safe partial geometry",
    async (key) => {
      const error = new Error(PRIVATE);
      const fixture = controlled({ [key]: error });
      await expect(prepareCopyAction(fixture.args)).rejects.toBe(error);
      expect(
        error.copyActionGeometryEvidence.observations.beforeHover.hit
          .acceptsButton,
      ).toBe(false);
      expect(
        error.copyActionGeometryEvidence.observations.failure,
      ).toBeTruthy();
      expect(JSON.stringify(error.copyActionGeometryEvidence)).not.toContain(
        PRIVATE,
      );
      const phases = summarizeCopyActionPhases({}, error, "copy-collapsed");
      expect(phases.collapsed).toEqual(error.copyActionGeometryEvidence);
      expect(summarizeCopyActionPhases({}, error, "pointer-expanded")).toEqual(
        {},
      );
    },
  );

  it("does not replace input preparation when geometry observation is unavailable", async () => {
    const fixture = controlled({ observationError: new Error(PRIVATE) });
    const result = await prepareCopyAction(fixture.args);
    expect(result).toMatchObject({
      bubbleHoverCompleted: true,
      buttonHoverCompleted: true,
      observations: {
        beforeHover: { unavailable: true },
        afterBubbleHover: { unavailable: true },
        ready: { unavailable: true },
      },
    });
    expect(JSON.stringify(result)).not.toContain(PRIVATE);
  });

  it("whitelists phase/observation keys and ignores generic or inherited errors", () => {
    const proof = {
      observations: { beforeHover: read(), rawError: PRIVATE },
      rawError: PRIVATE,
    };
    const safe = summarizeCopyActionPreparation(proof);
    expect(Object.keys(safe.observations)).toEqual(["beforeHover"]);
    expect(
      summarizeCopyActionPhases({ collapsed: proof, unknown: proof }),
    ).toEqual({ collapsed: safe });
    expect(
      summarizeCopyActionPhases({}, { evidence: proof }, "copy-collapsed"),
    ).toEqual({});
    expect(
      summarizeCopyActionPhases(
        {},
        Object.create({ copyActionGeometryEvidence: proof }),
        "copy-collapsed",
      ),
    ).toEqual({});
    expect(JSON.stringify(safe)).not.toContain(PRIVATE);
  });
});
