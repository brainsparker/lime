import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installLongListCollapseInputObservation,
  stopLongListCollapseInputObservation,
  withLongListCollapseInputObservation,
} from "./session-history-user-collapse-input.mjs";
import {
  attachLongListCollapseFailure,
  extractLongListCollapseFailure,
  summarizeLongListCollapseMeasurements,
} from "./session-history-user-collapse-geometry.mjs";

const page = { evaluate: async (callback, argument) => callback(argument) };
const probe = {
  sessionId: "measure-session",
  threadId: "measure-thread",
  turnId: "turn-232",
  itemId: "item_user-turn-232",
  ordinal: 232,
};
let descriptor;
let fakeDescriptor;
let bounds;
let calls;
let nativeFailure;
let failureReceiver;
const fullNode = () =>
  document.querySelector('[data-testid="user-message-content-full"]');
function rect(height, width = 600) {
  return { height, width, top: 0, bottom: height, left: 0, right: width };
}

beforeEach(() => {
  document.body.innerHTML = `<div data-testid="message-list-frame" data-session-id="measure-session">
    <div data-testid="message-list-scroll-container"><div data-testid="virtualized-turn-list"
      data-total-entries="14" data-start-index="0" data-end-index="7" data-offscreen-count="7">
      <div data-turn-key="canonical:turn-232"><div data-testid="message-turn-group" data-render-entry-kind="canonical_turn">
        <div data-message-role="user" data-runtime-turn-id="turn-232" data-thread-item-id="item_user-turn-232">
          <div data-testid="collapsible-user-message-content" data-user-message-content-state="unmeasured">
            <div data-testid="user-message-content-viewport"><div data-testid="user-message-content-full">PRIVATE BODY</div></div>
          </div>
        </div></div></div>
    </div></div></div>`;
  descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "getBoundingClientRect",
  );
  bounds = new WeakMap();
  calls = [];
  nativeFailure = new Error("native exact exception");
  failureReceiver = {};
  function nativeRect() {
    calls.push({ receiver: this, args: [...arguments] });
    if (this === failureReceiver) throw nativeFailure;
    return bounds.get(this) ?? rect(500);
  }
  fakeDescriptor = { ...descriptor, value: nativeRect };
  Object.defineProperty(
    Element.prototype,
    "getBoundingClientRect",
    fakeDescriptor,
  );
  bounds.set(fullNode(), rect(4800));
});

afterEach(async () => {
  await stopLongListCollapseInputObservation(page);
  Object.defineProperty(Element.prototype, "getBoundingClientRect", descriptor);
  document.body.innerHTML = "";
});

describe("bounded passive native full-body geometry sampling", () => {
  it("preserves native receiver/arguments/return/throw and avoids recursive auxiliary sampling", async () => {
    await installLongListCollapseInputObservation(page, probe);
    const full = fullNode();
    const value = full.getBoundingClientRect("argument", 2);
    expect(value).toBe(bounds.get(full));
    expect(calls[0]).toEqual({ receiver: full, args: ["argument", 2] });
    let thrown;
    try {
      Reflect.apply(Element.prototype.getBoundingClientRect, failureReceiver, [
        "argument",
      ]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(nativeFailure);
    const captured = await stopLongListCollapseInputObservation(page);
    const proof = summarizeLongListCollapseMeasurements(
      captured.measurementSampling,
    );
    expect(proof.samples).toHaveLength(1);
    expect(proof.samples[0]).toMatchObject({
      mountId: 1,
      turnId: "turn-232",
      itemId: "item_user-turn-232",
      rowKey: "canonical:turn-232",
      state: "unmeasured",
      fullHeight: 4800,
      fullWidth: 600,
      viewportHeight: 500,
      rowHeight: 500,
      totalEntries: 14,
      startIndex: 0,
      endIndex: 7,
      offscreenCount: 7,
      scrollTop: 0,
    });
    expect(calls).toHaveLength(4); // full、两个original辅助rect、原生抛出。
    expect(proof.nativeRestored).toBe(true);
    expect(Element.prototype.getBoundingClientRect).toBe(fakeDescriptor.value);
    expect(JSON.stringify(proof)).not.toContain("PRIVATE BODY");
  });

  it("distinguishes same-node dimension oscillation from repeated canonical Item mounts", async () => {
    await installLongListCollapseInputObservation(page, probe);
    const full = fullNode();
    for (const [height, width] of [
      [4800, 600],
      [300, 620],
      [300, 620],
      [4800, 600],
    ]) {
      bounds.set(full, rect(height, width));
      full.getBoundingClientRect();
    }
    const replacement = full.cloneNode(true);
    full.replaceWith(replacement);
    bounds.set(replacement, rect(4800));
    replacement.getBoundingClientRect();
    const captured = await stopLongListCollapseInputObservation(page);
    const proof = summarizeLongListCollapseMeasurements(
      captured.measurementSampling,
    );
    expect(proof.samples.map((sample) => sample.mountId)).toEqual([
      1, 1, 1, 1, 2,
    ]);
    expect(proof).toMatchObject({
      uniqueMountCount: 2,
      dimensionChangedMountCount: 1,
      oscillatingMountCount: 1,
      remountedIdentityCount: 1,
      completeHistoryClaim: false,
    });
  });

  it("caps records at 300 without changing later native calls", async () => {
    await installLongListCollapseInputObservation(page, probe);
    for (let index = 0; index < 350; index += 1)
      expect(fullNode().getBoundingClientRect()).toBe(bounds.get(fullNode()));
    const captured = await stopLongListCollapseInputObservation(page);
    expect(
      summarizeLongListCollapseMeasurements(captured.measurementSampling),
    ).toMatchObject({
      capturedCount: 300,
      totalCalls: 350,
      droppedCount: 50,
      nativeRestored: true,
    });
  });

  it("records only canonical full nodes in the observed session, including a non-probe Item", async () => {
    await installLongListCollapseInputObservation(page, probe);
    document
      .querySelector('[data-testid="user-message-content-viewport"]')
      .getBoundingClientRect();
    document
      .querySelector('[data-testid="message-turn-group"]')
      .setAttribute("data-render-entry-kind", "message_group");
    fullNode().getBoundingClientRect();
    document
      .querySelector('[data-testid="message-turn-group"]')
      .setAttribute("data-render-entry-kind", "canonical_turn");
    const bubble = document.querySelector('[data-message-role="user"]');
    bubble.setAttribute("data-runtime-turn-id", "turn-231");
    bubble.setAttribute("data-thread-item-id", "item_user-turn-231");
    fullNode().getBoundingClientRect();
    document
      .querySelector('[data-testid="message-list-frame"]')
      .setAttribute("data-session-id", "other-session");
    fullNode().getBoundingClientRect();
    const captured = await stopLongListCollapseInputObservation(page);
    expect(captured.measurementSampling.samples).toHaveLength(1);
    expect(captured.measurementSampling.samples[0].turnId).toBe("turn-231");
  });

  it("synchronously freezes error-time records, preserves the original failure, and survives runtime diagnostic rebuilding", async () => {
    const original = new Error("actual gate failure");
    await expect(
      withLongListCollapseInputObservation(
        page,
        probe,
        "interactive",
        async () => {
          fullNode().getBoundingClientRect();
          window.dispatchEvent(new Event("error"));
          bounds.set(fullNode(), rect(1));
          fullNode().getBoundingClientRect();
          throw original;
        },
      ),
    ).rejects.toBe(original);
    expect(Element.prototype.getBoundingClientRect).toBe(fakeDescriptor.value);
    let evidence = extractLongListCollapseFailure(original);
    expect(evidence.measurementSampling).toMatchObject({
      frozenAtError: true,
      capturedCount: 1,
      totalCalls: 1,
      nativeRestored: true,
    });
    expect(evidence.measurementSampling.samples[0].fullHeight).toBe(4800);
    await attachLongListCollapseFailure(
      original,
      { evaluate: async () => ({ rows: [] }) },
      probe,
      {
        phase: "interactive",
        stage: "collapsed",
        observations: {},
        trace: { complete: false },
      },
    );
    evidence = extractLongListCollapseFailure(original);
    expect(evidence.measurementSampling.samples[0].mountId).toBe(1);
    expect(JSON.stringify(evidence)).not.toContain("PRIVATE BODY");
  });

  it("drops unknown fields and malformed identities at the measurement evidence boundary", () => {
    const proof = summarizeLongListCollapseMeasurements({
      samples: [
        {
          sequence: 1,
          mountId: 1,
          turnId: "turn-232",
          itemId: "item-232",
          rowKey: "canonical:turn-232",
          fullHeight: 4800,
          fullWidth: 600,
          text: "PRIVATE BODY",
          clipboard: "PRIVATE CLIPBOARD",
        },
        { mountId: 2, turnId: "PRIVATE BODY", itemId: "item", rowKey: "row" },
      ],
      raw: "PRIVATE REQUEST",
      totalCalls: 2,
    });
    expect(proof.samples).toHaveLength(1);
    expect(JSON.stringify(proof)).not.toContain("PRIVATE");
    expect(proof.completeHistoryClaim).toBe(false);
  });
});
