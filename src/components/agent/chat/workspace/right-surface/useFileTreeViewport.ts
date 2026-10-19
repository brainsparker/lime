import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getFileTreeFocusScrollTop,
  getFileTreeViewport,
  indexFileTreeRows,
  type FileTreePosition,
} from "./fileTreeViewport";

export function useFileTreeViewport(
  directoryPath: string,
  rows: readonly FileTreePosition[],
  selectedPath: string | null,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const revealed = useRef<{ root: string; path: string } | null>(null);
  const [focus, setFocus] = useState({
    root: directoryPath,
    path: selectedPath,
  });
  const [physical, setPhysical] = useState({ top: 0, height: 420 });
  const index = useMemo(() => indexFileTreeRows(rows), [rows]);
  const viewport = getFileTreeViewport(
    index,
    physical.top,
    physical.height,
    true,
  );
  const requestedFocus =
    focus.root === directoryPath ? focus.path : selectedPath;
  const focusedIndex = (() => {
    let ancestor = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.path === requestedFocus) return i;
      if (
        row.isDirectory &&
        requestedFocus != null &&
        (requestedFocus.startsWith(row.path + "/") ||
          requestedFocus.startsWith(row.path + "\\"))
      )
        ancestor = i;
    }
    return ancestor >= 0 ? ancestor : rows.length ? 0 : -1;
  })();
  const updatePhysical = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const height =
      element.getBoundingClientRect().height || element.clientHeight;
    setPhysical((previous) => {
      const next = {
        top: element.scrollTop,
        height: height || previous.height,
      };
      return previous.top === next.top && previous.height === next.height
        ? previous
        : next;
    });
  }, []);
  const revealIndex = (rowIndex: number) => {
    const element = scrollRef.current;
    if (!element) return;
    const height =
      element.getBoundingClientRect().height ||
      element.clientHeight ||
      physical.height;
    const current = getFileTreeViewport(index, element.scrollTop, height, true);
    const top = getFileTreeFocusScrollTop(
      rowIndex,
      current.scrollTop,
      height,
      current.totalHeight,
      current.stickyHeight,
    );
    if (top != null) element.scrollTop = top;
    updatePhysical();
  };
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    updatePhysical();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updatePhysical);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updatePhysical]);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    pendingFocus.current = null;
    revealed.current = null;
    updatePhysical();
  }, [directoryPath, updatePhysical]);
  useLayoutEffect(() => {
    if (
      selectedPath == null ||
      (revealed.current?.root === directoryPath &&
        revealed.current.path === selectedPath)
    )
      return;
    const selectedIndex = rows.findIndex((row) => row.path === selectedPath);
    if (selectedIndex < 0) return;
    revealed.current = { root: directoryPath, path: selectedPath };
    revealIndex(selectedIndex);
  });
  useLayoutEffect(() => {
    const path = pendingFocus.current;
    if (path == null) return;
    const button = buttons.current.get(path);
    if (button) {
      pendingFocus.current = null;
      button.focus({ preventScroll: true });
    }
  });
  const indices: number[] = [];
  for (let i = viewport.start; i <= viewport.end; i++) indices.push(i);
  const parked =
    focusedIndex >= 0 &&
    (focusedIndex < viewport.start || focusedIndex > viewport.end)
      ? focusedIndex
      : -1;
  if (parked >= 0) indices.push(parked);
  indices.sort((a, b) => a - b);
  return {
    scrollRef,
    viewport,
    indices,
    parked,
    focusedIndex,
    updatePhysical,
    registerButton: (path: string, element: HTMLButtonElement | null) => {
      if (element) buttons.current.set(path, element);
      else buttons.current.delete(path);
    },
    setFocusPath: (path: string) => setFocus({ root: directoryPath, path }),
    focusIndex: (rowIndex: number) => {
      const row = rows[rowIndex];
      if (!row) return;
      pendingFocus.current = row.path;
      setFocus({ root: directoryPath, path: row.path });
      revealIndex(rowIndex);
    },
  };
}
