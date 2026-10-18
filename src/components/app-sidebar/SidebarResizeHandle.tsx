import { useRef, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  APP_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "./AppSidebar.constants";

const MIN_WIDTH = 240;
const MAX_WIDTH = 520;

function constrainWidth(width: number) {
  return Math.round(
    Math.max(MIN_WIDTH, Math.min(width, MAX_WIDTH, window.innerWidth - 320)),
  );
}

export function SidebarResizeHandle({
  width,
  onWidthChange,
}: {
  width: number;
  onWidthChange: (width: number) => void;
}) {
  const { t } = useTranslation("navigation");
  const drag = useRef<{ width: number; pointerId: number } | null>(null);
  const currentWidth = useRef(width);
  currentWidth.current = width;
  const commit = (nextWidth: number) => {
    const constrained = constrainWidth(nextWidth);
    onWidthChange(constrained);
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(constrained));
  };
  const finishDrag = (
    event: PointerEvent<HTMLDivElement>,
    cancelled: boolean,
  ) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (cancelled) onWidthChange(drag.current.width);
    else commit(currentWidth.current);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={String(t("navigation.sidebar.actions.resize"))}
      aria-orientation="vertical"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, window.innerWidth - 320),
      )}
      aria-valuenow={constrainWidth(width)}
      data-testid="app-sidebar-resize"
      className="absolute inset-y-0 -right-1 z-40 w-2 cursor-col-resize touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = { width, pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        const left =
          event.currentTarget.parentElement?.getBoundingClientRect().left ?? 0;
        onWidthChange(constrainWidth(event.clientX - left));
      }}
      onPointerUp={(event) => finishDrag(event, false)}
      onPointerCancel={(event) => finishDrag(event, true)}
      onLostPointerCapture={(event) => finishDrag(event, true)}
      onDoubleClick={() => commit(APP_SIDEBAR_WIDTH)}
      onKeyDown={(event) => {
        const next =
          event.key === "ArrowLeft"
            ? width - 8
            : event.key === "ArrowRight"
              ? width + 8
              : event.key === "Home"
                ? MIN_WIDTH
                : event.key === "End"
                  ? MAX_WIDTH
                  : null;
        if (next === null) return;
        event.preventDefault();
        commit(next);
      }}
    />
  );
}
