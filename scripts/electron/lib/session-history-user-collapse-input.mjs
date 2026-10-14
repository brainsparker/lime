import {
  COLLAPSE_SELECTORS,
  assert,
  extractLongListCollapseFailure,
  summarizeLongListCollapseFailure,
  summarizeLongListCollapseMeasurements,
} from "./session-history-user-collapse-geometry.mjs";

const OBSERVER_KEY = "__limeLongListCollapseInputObserver";

export async function installLongListCollapseInputObservation(page, probe) {
  await page.evaluate(
    ({ probe, selectors, key }) => {
      if (window[key])
        throw new Error("long-list collapse input observer 已存在");
      const events = [];
      const prototype = Element.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(
        prototype,
        "getBoundingClientRect",
      );
      const originalRect = descriptor?.value;
      if (typeof originalRect !== "function")
        throw new Error("缺少原生 Element rect 方法");
      const mountIds = new WeakMap();
      let nextMountId = 0;
      let samples = [];
      let totalCalls = 0;
      let frozenAtError = false;
      let observationErrorCount = 0;
      const safeId = (value) =>
        typeof value === "string" &&
        value.length <= 180 &&
        /^[A-Za-z0-9_:-]+$/.test(value);
      const nativeRect = (node) =>
        node instanceof Element ? Reflect.apply(originalRect, node, []) : null;
      const numberAttribute = (node, name) => {
        const raw = node?.getAttribute(name);
        const value = raw == null ? NaN : Number(raw);
        return Number.isSafeInteger(value) && value >= 0 ? value : null;
      };
      const record = (node, bounds) => {
        if (frozenAtError || !node.matches(selectors.full)) return;
        const frame = document.querySelector(selectors.frame);
        if (frame?.getAttribute("data-session-id") !== probe.sessionId) return;
        const bubble = node.closest('[data-message-role="user"]');
        const group = bubble?.closest('[data-testid="message-turn-group"]');
        const row = bubble?.closest("[data-turn-key]");
        const turnId = bubble?.getAttribute("data-runtime-turn-id");
        const itemId = bubble?.getAttribute("data-thread-item-id");
        const rowKey = row?.getAttribute("data-turn-key");
        if (
          group?.getAttribute("data-render-entry-kind") !== "canonical_turn" ||
          !safeId(turnId) ||
          !safeId(itemId) ||
          !safeId(rowKey)
        )
          return;
        totalCalls += 1;
        if (samples.length >= 300) return;
        if (!mountIds.has(node)) mountIds.set(node, ++nextMountId);
        const root = node.closest(selectors.root);
        const scroll = document.querySelector(selectors.scroll);
        const virtual = scroll?.querySelector(
          '[data-testid="virtualized-turn-list"]',
        );
        samples.push({
          sequence: totalCalls,
          mountId: mountIds.get(node),
          turnId,
          itemId,
          rowKey,
          state: root?.getAttribute("data-user-message-content-state") ?? null,
          fullHeight: bounds.height,
          fullWidth: bounds.width,
          viewportHeight:
            nativeRect(root?.querySelector(selectors.viewport))?.height ?? null,
          rowHeight: nativeRect(row)?.height ?? null,
          totalEntries: numberAttribute(virtual, "data-total-entries"),
          startIndex: numberAttribute(virtual, "data-start-index"),
          endIndex: numberAttribute(virtual, "data-end-index"),
          offscreenCount: numberAttribute(virtual, "data-offscreen-count"),
          scrollTop: scroll?.scrollTop ?? null,
        });
      };
      function observedRect() {
        // 先完整执行原生调用；原生返回值与异常保持原样。
        const bounds = Reflect.apply(originalRect, this, arguments);
        try {
          if (this instanceof Element) record(this, bounds);
        } catch {
          observationErrorCount += 1;
        }
        return bounds;
      }
      const freezeAtError = () => {
        if (frozenAtError || samples.length === 0) return;
        samples = samples.map((sample) => ({ ...sample }));
        frozenAtError = true;
      };
      const handler = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const frame = document.querySelector(selectors.frame);
        if (frame?.getAttribute("data-session-id") !== probe.sessionId) return;
        if (event.type === "wheel") {
          if (!target?.closest(selectors.scroll)) return;
          events.push({
            type: "wheel",
            trusted: event.isTrusted,
            deltaY: event.deltaY,
          });
          return;
        }
        const bubble = target?.closest('[data-message-role="user"]');
        const identityMatches =
          bubble?.getAttribute("data-runtime-turn-id") === probe.turnId &&
          bubble?.getAttribute("data-thread-item-id") === probe.itemId;
        if (!identityMatches) return;
        const toggle = target?.closest(selectors.toggle);
        if (event.type === "click" && toggle) {
          events.push({
            type: "click",
            trusted: event.isTrusted,
            detail: event.detail,
            toggle: true,
          });
        }
        if (
          event.type === "keydown" &&
          ["Tab", "Enter", " "].includes(event.key)
        ) {
          events.push({
            type: "keydown",
            trusted: event.isTrusted,
            key: event.key,
            shift: event.shiftKey,
            toggle: Boolean(toggle),
            focused: document.activeElement === target,
          });
        }
      };
      for (const type of ["wheel", "click", "keydown"])
        document.addEventListener(type, handler, true);
      Object.defineProperty(prototype, "getBoundingClientRect", {
        ...descriptor,
        value: observedRect,
      });
      window.addEventListener("error", freezeAtError);
      window[key] = {
        events,
        capture: () => ({
          events: events.map((event) => ({ ...event })),
          measurementSampling: {
            samples: samples.map((sample) => ({ ...sample })),
            totalCalls,
            frozenAtError,
            observationErrorCount,
          },
        }),
        dispose: () => {
          for (const type of ["wheel", "click", "keydown"])
            document.removeEventListener(type, handler, true);
          window.removeEventListener("error", freezeAtError);
          if (prototype.getBoundingClientRect === observedRect)
            Object.defineProperty(
              prototype,
              "getBoundingClientRect",
              descriptor,
            );
          return prototype.getBoundingClientRect === originalRect;
        },
      };
    },
    { probe, selectors: COLLAPSE_SELECTORS, key: OBSERVER_KEY },
  );
}

export async function stopLongListCollapseInputObservation(page) {
  return page.evaluate((key) => {
    const observer = window[key];
    if (!observer) return null;
    // 同步 clone 完整安全采样，再恢复原生方法。
    const captured = observer.capture();
    try {
      captured.measurementSampling.nativeRestored = observer.dispose();
      return captured;
    } finally {
      delete window[key];
    }
  }, OBSERVER_KEY);
}

export function assertLongListCollapseTrustedInput(events, phase) {
  assert(
    Array.isArray(events) && events.length > 0,
    "缺少实际 long-list 输入事件",
  );
  assert(
    events.every((event) => event.trusted === true),
    "观察到 synthetic long-list 输入",
  );
  const wheels = events.filter(
    (event) =>
      event.type === "wheel" &&
      Number.isFinite(event.deltaY) &&
      event.deltaY !== 0,
  );
  const keys = events.filter(
    (event) => event.type === "keydown" && event.focused === true,
  );
  assert(wheels.length > 0, "没有真实滚轮输入");
  assert(
    keys.some((event) => event.key === "Tab" && event.shift === true) &&
      keys.some((event) => event.key === "Tab" && event.shift === false),
    "未观察实际 Tab/Shift+Tab",
  );
  if (phase === "interactive") {
    assert(
      wheels.length >= 2 &&
        wheels.some((event) => event.deltaY < 0) &&
        wheels.some((event) => event.deltaY > 0),
      "未观察旧历史阅读与 successor 滚轮导航",
    );
    assert(
      keys.some((event) => event.key === "Enter" && event.toggle) &&
        keys.some((event) => event.key === " " && event.toggle),
      "未观察聚焦 toggle 的真实 Enter/Space",
    );
    assert(
      events.some(
        (event) => event.type === "click" && event.toggle && event.detail > 0,
      ),
      "未观察实际 pointer 展开",
    );
  } else assert(phase === "cold-restart", "未知输入证据阶段");
  return { trusted: true, phase, wheelCount: wheels.length, events };
}

export async function withLongListCollapseInputObservation(
  page,
  probe,
  phase,
  run,
) {
  await installLongListCollapseInputObservation(page, probe);
  let captured;
  try {
    const result = await run();
    captured = await stopLongListCollapseInputObservation(page);
    const input = assertLongListCollapseTrustedInput(captured?.events, phase);
    return {
      ...result,
      trustedInput: input,
      measurementSampling: summarizeLongListCollapseMeasurements(
        captured?.measurementSampling,
      ),
    };
  } catch (error) {
    captured ??= await stopLongListCollapseInputObservation(page).catch(
      () => null,
    );
    if (error instanceof Error) {
      try {
        error.userMessageCollapseEvidence = summarizeLongListCollapseFailure({
          ...extractLongListCollapseFailure(error),
          phase,
          probe,
          measurementSampling: captured?.measurementSampling,
        });
      } catch {
        /* 诊断不能覆盖原错误。 */
      }
    }
    throw error;
  } finally {
    await stopLongListCollapseInputObservation(page).catch(() => undefined);
  }
}
