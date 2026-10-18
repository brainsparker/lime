import { useState } from "react";
import {
  APP_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "./AppSidebar.constants";

export function useSidebarWidth() {
  const [width, setWidth] = useState(() => {
    const stored = Number(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
    );
    return Number.isFinite(stored) && stored >= 240
      ? stored
      : APP_SIDEBAR_WIDTH;
  });
  return { width, setWidth };
}
