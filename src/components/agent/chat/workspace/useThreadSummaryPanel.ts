import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  listenPersistedAtomUpdates,
  sendPersistedAtomState,
  updatePersistedAtomState,
} from "@/lib/api/persistedAtoms";
import { SUMMARY_PANEL_PIN_ATOM_KEY } from "@/lib/api/persistedAtomTypes";
import {
  getThreadSummaryContentShift,
  getThreadSummaryDisplayMode,
} from "./threadSummaryPanelLayout";

export function useThreadSummaryPanel(threadId: string | null) {
  const enabled = Boolean(threadId);
  const [mainContent, setMainContent] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [pin, setPin] = useState({ value: true, ready: false, error: false });
  const [updating, setUpdating] = useState(false);
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const revision = useRef(-1);
  const writing = useRef(false);
  const generation = useRef(0);
  const panelId = useId();
  const displayMode = getThreadSummaryDisplayMode(width);

  useLayoutEffect(() => {
    if (!mainContent) return;
    const measure = () => setWidth(mainContent.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(mainContent);
    return () => observer.disconnect();
  }, [mainContent]);

  useEffect(() => {
    const epoch = ++generation.current;
    if (!enabled) return;
    let unlisten: (() => void) | undefined;
    revision.current = -1;
    const read = async () => {
      try {
        const result = await sendPersistedAtomState({
          key: SUMMARY_PANEL_PIN_ATOM_KEY,
          query: { kind: "value" },
        });
        if (
          generation.current !== epoch ||
          result.storeRevision < revision.current
        )
          return;
        revision.current = result.storeRevision;
        if (result.outcome !== "ready" || result.data.queryKind !== "value") {
          setPin((current) => ({
            ...current,
            ready: false,
            error: result.persistence.state !== "loading",
          }));
          return;
        }
        setPin({
          value: result.data.value,
          ready: true,
          error: result.persistence.state === "error",
        });
      } catch {
        if (generation.current === epoch)
          setPin((current) => ({ ...current, ready: false, error: true }));
      }
    };
    void listenPersistedAtomUpdates((event) => {
      if (
        event.key === SUMMARY_PANEL_PIN_ATOM_KEY &&
        event.storeRevision >= revision.current
      )
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
          setPin((current) => ({ ...current, error: true }));
      });
    return () => {
      generation.current += 1;
      unlisten?.();
    };
  }, [enabled]);

  useEffect(() => {
    setPopoverOpen(false);
  }, [threadId, displayMode]);

  const togglePinned = useCallback(async () => {
    if (!pin.ready || writing.current) return;
    const epoch = generation.current;
    writing.current = true;
    setUpdating(true);
    try {
      const result = await updatePersistedAtomState({
        key: SUMMARY_PANEL_PIN_ATOM_KEY,
        mutation: { op: "set", value: !pin.value },
      });
      if (generation.current !== epoch) return;
      if (result.outcome === "applied" && typeof result.value === "boolean") {
        if (result.storeRevision >= revision.current) {
          revision.current = result.storeRevision;
          setPin({
            value: result.value,
            ready: true,
            error: result.persistence.state === "error",
          });
        }
      } else setPin((current) => ({ ...current, error: true }));
    } catch {
      if (generation.current === epoch)
        setPin((current) => ({ ...current, error: true }));
    } finally {
      writing.current = false;
      setUpdating(false);
    }
  }, [pin.ready, pin.value]);

  const isOverlay = displayMode === "overlay";
  return {
    panelId,
    mainContent,
    mainContentRef: setMainContent,
    displayMode,
    isPinned: pin.value,
    isOpen: enabled && (isOverlay ? isPopoverOpen : pin.value),
    isPopoverOpen: enabled && isOverlay && isPopoverOpen,
    isInline: enabled && !isOverlay && pin.value,
    isOverlay,
    pinDisabled: !pin.ready || updating,
    persistenceError: pin.error,
    contentShift: enabled
      ? getThreadSummaryContentShift(displayMode, pin.value)
      : 0,
    onOpenChange: (open: boolean) => {
      if (isOverlay) setPopoverOpen(open);
      else void togglePinned();
    },
  };
}

export type ThreadSummaryPanelState = ReturnType<typeof useThreadSummaryPanel>;
