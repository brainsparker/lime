import type { ComposerEditorHandle } from "@/components/input-kit";
import {
  useCallback,
  useEffect,
  useState,
  type RefObject,
} from "react";
import {
  listHintRoutes,
  type HintRouteItem,
} from "@/lib/api/hintRoutes";

export type { HintRouteItem } from "@/lib/api/hintRoutes";

interface UseHintRoutesParams {
  setInput: (value: string) => void;
  editorRef: RefObject<ComposerEditorHandle>;
}

export function useHintRoutes({ setInput, editorRef }: UseHintRoutesParams) {
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [hintRoutes, setHintRoutes] = useState<HintRouteItem[]>([]);
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    listHintRoutes()
      .then((routes) => {
        if (routes?.length > 0) {
          setHintRoutes(routes);
        }
      })
      .catch(() => {});
  }, []);

  const handleSetInput = useCallback(
    (value: string) => {
      setInput(value);
      if (hintRoutes.length > 0 && value === "[") {
        setShowHintPopup(true);
        setHintIndex(0);
      } else if (!value.startsWith("[") || value.includes("]")) {
        setShowHintPopup(false);
      }
    },
    [hintRoutes.length, setInput],
  );

  const handleHintSelect = useCallback(
    (hint: string) => {
      setInput(`[${hint}] `);
      setShowHintPopup(false);
      editorRef.current?.focus();
    },
    [setInput, editorRef],
  );

  const handleHintKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const nativeEvent = e;
      if (
        nativeEvent.isComposing ||
        nativeEvent.key === "Process" ||
        nativeEvent.keyCode === 229
      ) {
        return;
      }
      if (!showHintPopup || hintRoutes.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHintIndex((i) => (i + 1) % hintRoutes.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHintIndex((i) => (i - 1 + hintRoutes.length) % hintRoutes.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleHintSelect(hintRoutes[hintIndex].hint);
      } else if (e.key === "Escape") {
        setShowHintPopup(false);
      }
    },
    [handleHintSelect, hintIndex, hintRoutes, showHintPopup],
  );

  return {
    showHintPopup,
    hintRoutes,
    hintIndex,
    handleSetInput,
    handleHintSelect,
    handleHintKeyDown,
  };
}
