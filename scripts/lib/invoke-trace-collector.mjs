import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export const INVOKE_TRACE_COLLECTOR_KEY = "lime_invoke_trace_buffer_v1";
export const INVOKE_TRACE_COLLECTOR_LIMIT = 240;

// Serialized into the renderer. Native Storage methods keep their receiver,
// arguments, return value and thrown exception; observation never masks them.
export function installInvokeTraceCollectorDom({ runId, startedAt }) {
  const key = "lime_invoke_trace_buffer_v1";
  const limit = 240;
  const slot = "__limeInvokeTraceCollector";
  const stopSlot = `__limeInvokeTraceCollectorStop_${runId}`;
  if (window[slot]) throw new Error("invoke trace collector already installed");
  if (!globalThis.crypto?.subtle || typeof TextEncoder !== "function")
    throw new Error("invoke trace collector requires native SHA-256");
  const storage = window.localStorage;
  const prototype = Storage.prototype;
  const methods = ["setItem", "removeItem", "clear"];
  const descriptors = Object.fromEntries(
    methods.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(prototype, name),
    ]),
  );
  const getItem = prototype.getItem;
  if (methods.some((name) => typeof descriptors[name]?.value !== "function"))
    throw new Error("native Storage methods are unavailable");
  const parseRing = (raw) => {
    const entries = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length > limit)
      throw new Error("invalid trace ring");
    if (
      entries.some(
        (entry) =>
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          typeof entry.timestamp !== "string" ||
          typeof entry.command !== "string" ||
          typeof entry.transport !== "string" ||
          !["success", "error"].includes(entry.status) ||
          !Number.isFinite(entry.duration_ms),
      )
    )
      throw new Error("invalid trace entry");
    return entries;
  };
  const readRaw = () => Reflect.apply(getItem, storage, [key]);
  const seedEntries = parseRing(readRaw());
  let knownRingJson = JSON.stringify(seedEntries);
  const ledgerEntries = [];
  const observations = [];
  const invalidations = [];
  let active = true;
  let owner;
  const invalidate = (reason, operation) => {
    invalidations.push({
      reason,
      operation,
      sequence: observations.length + 1,
    });
  };
  const hash = (serialized) => {
    const bytes = new TextEncoder().encode(serialized);
    return globalThis.crypto.subtle
      .digest("SHA-256", bytes)
      .then((buffer) =>
        [...new Uint8Array(buffer)]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join(""),
      )
      .catch(() => {
        invalidate("hash-failed", "capture");
        return null;
      });
  };
  const seedDigestPromise = hash(knownRingJson);
  let knownRingDigestPromise = seedDigestPromise;
  const observe = (operation, args, beforeRaw, afterRaw) => {
    const targetKey = operation === "clear" || args[0] === key;
    if (operation === "clear" || (operation === "removeItem" && targetKey)) {
      invalidate("trace-reset", operation);
      return;
    }
    if (typeof args[0] !== "string") {
      invalidate("unverifiable-key-coercion", operation);
      return;
    }
    if (beforeRaw === afterRaw && !targetKey) return;
    if (operation !== "setItem" || !targetKey || beforeRaw === afterRaw) {
      invalidate("non-append-write", operation);
      return;
    }
    try {
      const before = parseRing(beforeRaw);
      const after = parseRing(afterRaw);
      if (JSON.stringify(before) !== knownRingJson) {
        invalidate("lost-observation-window", operation);
        return;
      }
      const appended = after.at(-1);
      const afterJson = JSON.stringify(after);
      if (
        !appended ||
        afterJson !== JSON.stringify([...before, appended].slice(-limit))
      ) {
        invalidate("non-continuous-append", operation);
        return;
      }
      const sequence = observations.length + 1;
      const afterDigestPromise = hash(afterJson);
      ledgerEntries.push(appended);
      observations.push({
        sequence,
        operation: "append",
        nativeSucceeded: true,
        beforeCount: before.length,
        afterCount: after.length,
        // Reuse only after the native before-window matched the known bytes.
        beforeDigestPromise: knownRingDigestPromise,
        afterDigestPromise,
        entryDigestPromise: hash(JSON.stringify(appended)),
      });
      knownRingJson = afterJson;
      knownRingDigestPromise = afterDigestPromise;
    } catch {
      invalidate("invalid-trace-write", operation);
    }
  };
  const invokeNative = (operation, receiver, args) => {
    let beforeRaw;
    if (receiver === storage) {
      try {
        beforeRaw = readRaw();
      } catch {
        invalidate("native-read-failed", operation);
      }
    }
    let result;
    try {
      result = Reflect.apply(descriptors[operation].value, receiver, args);
    } catch (error) {
      if (
        receiver === storage &&
        (operation === "clear" ||
          args[0] === key ||
          typeof args[0] !== "string")
      )
        invalidate("native-write-threw", operation);
      throw error;
    }
    if (receiver === storage) {
      try {
        observe(operation, args, beforeRaw, readRaw());
      } catch {
        invalidate("observation-failed", operation);
      }
    }
    return result;
  };
  const wrappers = {
    setItem: function setItem(key, value) {
      return invokeNative("setItem", this, arguments);
    },
    removeItem: function removeItem(key) {
      return invokeNative("removeItem", this, arguments);
    },
    clear: function clear() {
      return invokeNative("clear", this, arguments);
    },
  };
  const hooksIntact = () =>
    active &&
    window[slot] === owner &&
    window[stopSlot] === owner &&
    prototype.getItem === getItem &&
    methods.every((name) => prototype[name] === wrappers[name]);
  const capture = async () => {
    const intact = hooksIntact();
    const activeAtCapture = active;
    let currentEntries = null;
    try {
      currentEntries = parseRing(readRaw());
    } catch {
      invalidate("native-read-invalid", "capture");
    }
    if (!intact) invalidate("collector-hook-lost", "capture");
    const currentJson = JSON.stringify(currentEntries);
    if (currentJson !== knownRingJson)
      invalidate("lost-observation-window", "capture");
    // Snapshot before the first await. Later appends belong to a later capture.
    const ledger = ledgerEntries.slice();
    const records = observations.slice();
    const currentDigestPromise = hash(currentJson);
    const transitions = await Promise.all(
      records.map(async (record) => ({
        sequence: record.sequence,
        operation: record.operation,
        nativeSucceeded: record.nativeSucceeded,
        beforeCount: record.beforeCount,
        afterCount: record.afterCount,
        beforeDigest: await record.beforeDigestPromise,
        afterDigest: await record.afterDigestPromise,
        entryDigest: await record.entryDigestPromise,
      })),
    );
    return {
      schemaVersion: 1,
      mode: "continuous-storage-append",
      runId,
      startedAt,
      traceKey: key,
      traceLimit: limit,
      hooksIntact: intact,
      activeAtCapture,
      seedEntries,
      seedDigest: await seedDigestPromise,
      ledgerEntries: ledger,
      observations: transitions,
      captureSequence: records.length,
      currentRingCount: currentEntries?.length ?? null,
      currentRingDigest: await currentDigestPromise,
      invalidations: invalidations.slice(),
    };
  };
  const restore = () => {
    for (const name of methods) {
      if (prototype[name] === wrappers[name]) {
        try {
          Object.defineProperty(prototype, name, descriptors[name]);
        } catch {
          invalidate("native-restore-failed", "stop");
        }
      }
    }
    active = false;
    if (window[slot] === owner) delete window[slot];
    if (window[stopSlot] === owner) delete window[stopSlot];
    return methods.every((name) => prototype[name] === descriptors[name].value);
  };
  const stop = async () => {
    const pending = capture();
    // Restore synchronously even if an asynchronous digest later fails.
    const nativeRestored = restore();
    const result = await pending;
    return { ...result, stopped: true, nativeRestored };
  };
  try {
    for (const name of methods)
      Object.defineProperty(prototype, name, {
        ...descriptors[name],
        value: wrappers[name],
      });
    owner = Object.freeze({ runId, startedAt, capture, stop });
    // Keep teardown reachable if the public observation hook is lost. The
    // distinct identity remains test-only and never enters production Storage.
    Object.defineProperty(window, stopSlot, {
      value: owner,
      configurable: true,
    });
    window[slot] = owner;
  } catch (error) {
    restore();
    throw error;
  }
  return { runId, startedAt, traceKey: key, traceLimit: limit };
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validEntries(entries) {
  return (
    Array.isArray(entries) &&
    entries.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        typeof entry.timestamp === "string" &&
        typeof entry.command === "string" &&
        typeof entry.transport === "string" &&
        ["success", "error"].includes(entry.status) &&
        Number.isFinite(entry.duration_ms),
    )
  );
}

export function validateInvokeTraceCollectorCapture(capture, handle) {
  try {
    if (
      !handle ||
      typeof handle.runId !== "string" ||
      handle.runId.length === 0 ||
      typeof handle.startedAt !== "string" ||
      !Number.isFinite(Date.parse(handle.startedAt)) ||
      handle.traceKey !== INVOKE_TRACE_COLLECTOR_KEY ||
      handle.traceLimit !== INVOKE_TRACE_COLLECTOR_LIMIT ||
      capture?.schemaVersion !== 1 ||
      capture.mode !== "continuous-storage-append" ||
      capture.runId !== handle.runId ||
      capture.startedAt !== handle.startedAt ||
      capture.traceKey !== handle.traceKey ||
      capture.traceLimit !== handle.traceLimit ||
      capture.hooksIntact !== true ||
      capture.activeAtCapture !== true ||
      !Array.isArray(capture.invalidations) ||
      capture.invalidations.length !== 0 ||
      !validEntries(capture.seedEntries) ||
      capture.seedEntries.length > handle.traceLimit ||
      !validEntries(capture.ledgerEntries) ||
      !Array.isArray(capture.observations) ||
      capture.captureSequence !== capture.ledgerEntries.length ||
      capture.observations.length !== capture.ledgerEntries.length ||
      capture.seedDigest !== hash(capture.seedEntries)
    )
      throw new Error("invalid collector provenance");
    let ring = capture.seedEntries;
    let ringDigest = hash(ring);
    for (const [index, entry] of capture.ledgerEntries.entries()) {
      const record = capture.observations[index];
      const next = [...ring, entry].slice(-handle.traceLimit);
      const nextDigest = hash(next);
      if (
        record?.sequence !== index + 1 ||
        record.operation !== "append" ||
        record.nativeSucceeded !== true ||
        record.beforeCount !== ring.length ||
        record.afterCount !== next.length ||
        record.beforeDigest !== ringDigest ||
        record.afterDigest !== nextDigest ||
        record.entryDigest !== hash(entry)
      )
        throw new Error("non-continuous collector provenance");
      ring = next;
      ringDigest = nextDigest;
    }
    if (
      capture.currentRingCount !== ring.length ||
      capture.currentRingDigest !== ringDigest
    )
      throw new Error("collector final window mismatch");
    return {
      complete: true,
      ledgerEntries: capture.ledgerEntries,
      provenance: {
        mode: capture.mode,
        runId: capture.runId,
        startedAt: capture.startedAt,
        traceKey: capture.traceKey,
        traceLimit: capture.traceLimit,
        seedCount: capture.seedEntries.length,
        seedDigest: capture.seedDigest,
        appendCount: capture.ledgerEntries.length,
        captureSequence: capture.captureSequence,
        currentRingCount: capture.currentRingCount,
        currentRingDigest: capture.currentRingDigest,
        transitionDigests: capture.observations.map(hash),
      },
    };
  } catch {
    return { complete: false, ledgerEntries: [], provenance: null };
  }
}

export function sameInvokeTraceCollectorProvenance(before, after) {
  return (
    !!before &&
    !!after &&
    before.mode === "continuous-storage-append" &&
    after.mode === before.mode &&
    before.runId === after.runId &&
    before.startedAt === after.startedAt &&
    before.traceKey === INVOKE_TRACE_COLLECTOR_KEY &&
    after.traceKey === before.traceKey &&
    before.traceLimit === INVOKE_TRACE_COLLECTOR_LIMIT &&
    after.traceLimit === before.traceLimit &&
    before.seedCount === after.seedCount &&
    before.seedDigest === after.seedDigest &&
    before.captureSequence === before.appendCount &&
    after.captureSequence === after.appendCount &&
    after.appendCount >= before.appendCount &&
    before.transitionDigests?.length === before.appendCount &&
    after.transitionDigests?.length === after.appendCount &&
    isDeepStrictEqual(
      before.transitionDigests,
      after.transitionDigests.slice(0, before.appendCount),
    )
  );
}

export async function installInvokeTraceCollector(page) {
  const identity = { runId: randomUUID(), startedAt: new Date().toISOString() };
  return page.evaluate(installInvokeTraceCollectorDom, identity);
}

export async function captureInvokeTraceCollector(page, handle) {
  return page.evaluate(async ({ runId, startedAt }) => {
    const observer = window.__limeInvokeTraceCollector;
    if (observer?.runId !== runId || observer.startedAt !== startedAt)
      throw new Error("invoke trace collector identity is unavailable");
    return observer.capture();
  }, handle);
}

export async function stopInvokeTraceCollector(page, handle) {
  return page.evaluate(async ({ runId, startedAt }) => {
    const observer = window[`__limeInvokeTraceCollectorStop_${runId}`];
    if (observer?.runId !== runId || observer.startedAt !== startedAt)
      throw new Error("invoke trace collector identity is unavailable");
    return observer.stop();
  }, handle);
}

export async function withInvokeTraceCollector(page, callback, onStopped) {
  const handle = await installInvokeTraceCollector(page);
  let failure;
  let callbackFailed = false;
  try {
    return await callback(handle);
  } catch (error) {
    failure = error;
    callbackFailed = true;
    throw error;
  } finally {
    let cleanupFailure;
    let proof = {
      mode: "continuous-storage-append",
      runId: handle.runId,
      startedAt: handle.startedAt,
      appendCount: null,
      ringCount: null,
      complete: false,
      nativeRestored: false,
    };
    try {
      const stopped = await stopInvokeTraceCollector(page, handle);
      const observed = validateInvokeTraceCollectorCapture(stopped, handle);
      proof = {
        ...proof,
        appendCount: observed.provenance?.appendCount ?? null,
        ringCount: observed.provenance?.currentRingCount ?? null,
        complete: observed.complete,
        nativeRestored: stopped.nativeRestored === true,
      };
      if (stopped.nativeRestored !== true || observed.complete !== true)
        throw new Error(
          "invoke trace collector cleanup has invalid provenance",
        );
    } catch (error) {
      cleanupFailure = error;
    }
    try {
      if (typeof onStopped === "function")
        await onStopped(Object.freeze(proof));
    } catch (error) {
      cleanupFailure ??= error;
    }
    if (cleanupFailure) {
      if (!callbackFailed) throw cleanupFailure;
      // Frozen errors and primitive rejections must also preserve the primary
      // failure. The cleanup flag is diagnostic, never a new failure source.
      try {
        Object.defineProperty(failure, "traceCollectorCleanupFailed", {
          value: true,
          configurable: true,
        });
      } catch {}
    }
  }
}
