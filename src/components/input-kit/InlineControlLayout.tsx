import { createContext, useLayoutEffect, useRef, useState } from "react";

export type InlineControlPresentation = "expanded" | "compact" | "hidden";

export const InlineControlLayoutContext =
  createContext<InlineControlPresentation>("expanded");

/** 先测展开宽度，再测收起标签后的宽度；保留测量值供空间恢复时使用。 */
export function useInlineControlLayout(enabled: boolean) {
  const availableRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const expandedWidth = useRef<number | null>(null);
  const compactWidth = useRef<number | null>(null);
  const measuredControl = useRef<HTMLElement | null>(null);
  const measuredLabel = useRef<string | null>(null);
  const [presentation, setPresentation] =
    useState<InlineControlPresentation>("expanded");

  useLayoutEffect(() => {
    if (!enabled) return;
    const available = availableRef.current;
    const container = controlRef.current;
    if (!available || !container) return;
    let observedControl: HTMLElement | null = null;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => measure());

    const measure = () => {
      const control = container.querySelector<HTMLElement>(
        "[data-inline-control]",
      );
      if (control !== observedControl) {
        if (observedControl) resizeObserver?.unobserve(observedControl);
        observedControl = control;
        if (control) resizeObserver?.observe(control);
      }
      if (!control) return;
      const label = control.getAttribute("aria-label");
      if (
        control !== measuredControl.current ||
        label !== measuredLabel.current
      ) {
        measuredControl.current = control;
        measuredLabel.current = label;
        expandedWidth.current = null;
        compactWidth.current = null;
        if (presentation !== "expanded") {
          setPresentation("expanded");
          return;
        }
      }
      const width = control.getBoundingClientRect().width;
      if (width > 0) {
        if (presentation === "expanded") expandedWidth.current = width;
        if (presentation === "compact") compactWidth.current = width;
      }
      const availableWidth = available.getBoundingClientRect().width;
      if (availableWidth <= 0 || expandedWidth.current === null) return;
      const next =
        expandedWidth.current <= availableWidth
          ? "expanded"
          : compactWidth.current === null ||
              compactWidth.current <= availableWidth
            ? "compact"
            : "hidden";
      setPresentation((current) => (current === next ? current : next));
    };
    resizeObserver?.observe(available);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label"],
    });
    measure();
    return () => {
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
    };
  }, [enabled, presentation]);

  return { availableRef, controlRef, presentation };
}
