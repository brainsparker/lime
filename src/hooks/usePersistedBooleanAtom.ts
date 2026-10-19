import { useCallback, useEffect, useRef, useState } from "react";
import {
  listenPersistedAtomUpdates,
  sendPersistedAtomState,
  updatePersistedAtomState,
} from "@/lib/api/persistedAtoms";
import {
  PERSISTED_BOOLEAN_DEFAULTS,
  type PersistedBooleanAtomKey,
} from "@/lib/api/persistedAtomTypes";

/** Renderer projection of the existing Host UI state owner. */
export function usePersistedBooleanAtom(
  key: PersistedBooleanAtomKey,
  enabled = true,
) {
  const [state, setState] = useState({
    value: Boolean(PERSISTED_BOOLEAN_DEFAULTS[key]),
    ready: false,
    error: false,
  });
  const [updating, setUpdating] = useState(false);
  const revision = useRef(-1);
  const generation = useRef(0);
  const writing = useRef<object | null>(null);

  useEffect(() => {
    const epoch = ++generation.current;
    revision.current = -1;
    writing.current = null;
    setUpdating(false);
    setState({
      value: PERSISTED_BOOLEAN_DEFAULTS[key],
      ready: false,
      error: false,
    });
    if (!enabled) return;
    let unlisten: (() => void) | undefined;
    const read = async () => {
      try {
        const result = await sendPersistedAtomState({
          key,
          query: { kind: "value" },
        });
        if (
          generation.current !== epoch ||
          result.storeRevision < revision.current
        )
          return;
        revision.current = result.storeRevision;
        if (result.outcome !== "ready" || result.data.queryKind !== "value") {
          setState((current) => ({
            ...current,
            ready: false,
            error: result.persistence.state !== "loading",
          }));
          return;
        }
        setState({
          value: result.data.value,
          ready: true,
          error: result.persistence.state === "error",
        });
      } catch {
        if (generation.current === epoch)
          setState((current) => ({ ...current, ready: false, error: true }));
      }
    };
    void listenPersistedAtomUpdates((event) => {
      if (event.key === key && event.storeRevision >= revision.current)
        void read();
    })
      .then((stop) => {
        if (generation.current !== epoch) stop();
        else {
          unlisten = stop;
          void read();
        }
      })
      .catch(() => {
        if (generation.current === epoch)
          setState((current) => ({ ...current, error: true }));
      });
    return () => {
      generation.current += 1;
      writing.current = null;
      unlisten?.();
    };
  }, [key, enabled]);

  const setValue = useCallback(
    async (value: boolean) => {
      if (!enabled || !state.ready || writing.current) return;
      const epoch = generation.current,
        token = {};
      writing.current = token;
      setUpdating(true);
      try {
        const result = await updatePersistedAtomState({
          key,
          mutation: { op: "set", value },
        });
        if (generation.current !== epoch) return;
        if (result.outcome === "applied" && typeof result.value === "boolean") {
          if (result.storeRevision >= revision.current) {
            revision.current = result.storeRevision;
            setState({
              value: result.value,
              ready: true,
              error: result.persistence.state === "error",
            });
          }
        } else setState((current) => ({ ...current, error: true }));
      } catch {
        if (generation.current === epoch)
          setState((current) => ({ ...current, error: true }));
      } finally {
        if (writing.current === token) {
          writing.current = null;
          setUpdating(false);
        }
      }
    },
    [enabled, key, state.ready],
  );

  return { ...state, updating, setValue };
}
