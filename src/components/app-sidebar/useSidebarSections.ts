import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-section-preferences";

interface SidebarSectionPreferences {
  order: string[];
  collapsed: string[];
}

function readPreferences(): SidebarSectionPreferences {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const strings = (input: unknown) =>
        Array.isArray(input)
          ? [
              ...new Set(
                input.filter((key): key is string => typeof key === "string"),
              ),
            ]
          : [];
      return {
        order: strings(record.order),
        collapsed: strings(record.collapsed),
      };
    }
  } catch {
    // Unavailable or invalid display preferences must not hide canonical data.
  }
  return { order: [], collapsed: [] };
}

/** Owns display order and collapse preferences only, never thread membership. */
export function useSidebarSections(sectionKeys: string[]) {
  const [preferences, setPreferences] = useState(readPreferences);
  const orderedKeys = [
    ...preferences.order.filter((key) => sectionKeys.includes(key)),
    ...sectionKeys.filter((key) => !preferences.order.includes(key)),
  ];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // The current window remains usable when browser storage is unavailable.
    }
  }, [preferences]);

  const toggleCollapsed = useCallback((sectionKey: string) => {
    setPreferences((current) => ({
      ...current,
      collapsed: current.collapsed.includes(sectionKey)
        ? current.collapsed.filter((key) => key !== sectionKey)
        : [...current.collapsed, sectionKey],
    }));
  }, []);

  const reorder = (source: string, target: string, after = false) => {
    if (
      source === target ||
      !orderedKeys.includes(source) ||
      !orderedKeys.includes(target)
    ) {
      return;
    }
    const order = orderedKeys.filter((key) => key !== source);
    order.splice(order.indexOf(target) + Number(after), 0, source);
    setPreferences((current) => ({ ...current, order }));
  };

  const move = (sectionKey: string, direction: -1 | 1) => {
    const index = orderedKeys.indexOf(sectionKey);
    const target = orderedKeys[index + direction];
    if (target) reorder(sectionKey, target, direction === 1);
  };

  return {
    orderedKeys,
    isCollapsed: (sectionKey: string) =>
      preferences.collapsed.includes(sectionKey),
    toggleCollapsed,
    reorder,
    move,
  };
}
