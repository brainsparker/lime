import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SuggestionItem {
  key: string;
  label: string;
  detail?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect(): void | Promise<unknown>;
  onCompleteQuery?(): void;
}

export interface SuggestionSection {
  id: string;
  title: string;
  items: readonly SuggestionItem[];
  status?: string;
}

export function SuggestionList({
  label,
  sections,
  query,
  keyboardTarget,
  noResults,
  onRequestClose,
  onError,
}: {
  label: string;
  sections: readonly SuggestionSection[];
  query: string;
  keyboardTarget: HTMLElement | null;
  noResults: string;
  onRequestClose(): void;
  onError(error: unknown): void;
}) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [highlight, setHighlight] = useState({ query, key: "" });
  const items = sections
    .flatMap((section) => section.items)
    .filter((item) => !item.disabled);
  const selected =
    (highlight.query === query &&
      items.find((item) => item.key === highlight.key)) ||
    items[0];
  const selectedIndex = selected ? items.indexOf(selected) : -1;
  const callbacks = useRef({
    items,
    selected,
    selectedIndex,
    query,
    onRequestClose,
    onError,
  });
  callbacks.current = {
    items,
    selected,
    selectedIndex,
    query,
    onRequestClose,
    onError,
  };

  const select = async (item: SuggestionItem) => {
    if (item.disabled || busyRef.current) return;
    busyRef.current = true;
    try {
      await item.onSelect();
    } catch (error) {
      callbacks.current.onError(error);
    } finally {
      busyRef.current = false;
    }
  };
  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => {
    if (!keyboardTarget) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.keyCode === 229 ||
        event.key === "Process" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const current = callbacks.current;
      if (event.key === "Escape") current.onRequestClose();
      else if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        current.items.length
      ) {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const index =
          (current.selectedIndex + direction + current.items.length) %
          current.items.length;
        setHighlight({ query: current.query, key: current.items[index].key });
      } else if (
        (event.key === "Enter" || event.key === "Tab") &&
        !event.shiftKey &&
        current.selected
      ) {
        if (event.key === "Tab" && current.selected.onCompleteQuery)
          current.selected.onCompleteQuery();
        else void selectRef.current(current.selected);
      } else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    keyboardTarget.addEventListener("keydown", handleKeyDown, true);
    return () =>
      keyboardTarget.removeEventListener("keydown", handleKeyDown, true);
  }, [keyboardTarget]);

  useEffect(() => {
    if (!keyboardTarget) return;
    const attributes = {
      "aria-controls": id,
      "aria-expanded": "true",
      "aria-autocomplete": "list",
    };
    const previous = Object.fromEntries(
      Object.keys(attributes).map((key) => [
        key,
        keyboardTarget.getAttribute(key),
      ]),
    );
    for (const [key, value] of Object.entries(attributes))
      keyboardTarget.setAttribute(key, value);
    return () => {
      for (const [key, value] of Object.entries(attributes)) {
        if (keyboardTarget.getAttribute(key) !== value) continue;
        const old = previous[key];
        if (old === null) keyboardTarget.removeAttribute(key);
        else keyboardTarget.setAttribute(key, old);
      }
    };
  }, [id, keyboardTarget]);

  useEffect(() => {
    if (!keyboardTarget) return;
    const previous = keyboardTarget.getAttribute("aria-activedescendant");
    const optionId =
      selectedIndex >= 0 ? `${id}-option-${selectedIndex}` : null;
    if (optionId)
      keyboardTarget.setAttribute("aria-activedescendant", optionId);
    else keyboardTarget.removeAttribute("aria-activedescendant");
    listRef.current
      ?.querySelector<HTMLElement>("[aria-selected='true']")
      ?.scrollIntoView?.({ block: "nearest" });
    return () => {
      if (keyboardTarget.getAttribute("aria-activedescendant") !== optionId)
        return;
      if (previous === null)
        keyboardTarget.removeAttribute("aria-activedescendant");
      else keyboardTarget.setAttribute("aria-activedescendant", previous);
    };
  }, [id, keyboardTarget, selectedIndex, selected?.key]);

  const visible = sections.filter(
    (section) => section.items.length || section.status,
  );
  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={label}
      className="max-h-[inherit] overflow-y-auto overscroll-contain p-1 text-sm"
    >
      {visible.map((section) => (
        <div
          key={section.id}
          data-mention-section-id={section.id}
          role="group"
          aria-label={section.title}
        >
          {visible.length > 1 && (
            <div className="sticky top-0 z-10 bg-[var(--lime-surface)] px-2 py-1.5 text-xs text-[color:var(--lime-text-muted)]">
              {section.title}
            </div>
          )}
          {section.items.map((item) => {
            const index = items.indexOf(item);
            return (
              <button
                key={item.key}
                type="button"
                role="option"
                tabIndex={-1}
                id={index < 0 ? undefined : `${id}-option-${index}`}
                aria-selected={selected?.key === item.key}
                disabled={item.disabled}
                data-suggestion-key={item.key}
                className={cn(
                  "flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[color:var(--lime-text)] outline-none disabled:opacity-50",
                  selected?.key === item.key &&
                    "bg-[var(--lime-surface-hover)]",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  if (!item.disabled) setHighlight({ query, key: item.key });
                }}
                onClick={() => void select(item)}
              >
                {item.icon && (
                  <span className="flex size-4 shrink-0 items-center justify-center text-[color:var(--lime-text-muted)]">
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 truncate">{item.label}</span>
                {item.detail && (
                  <span className="min-w-0 flex-1 truncate text-[color:var(--lime-text-muted)]">
                    {item.detail}
                  </span>
                )}
              </button>
            );
          })}
          {section.status && !section.items.length && (
            <div
              role="status"
              className="px-2 py-2 text-[color:var(--lime-text-muted)]"
            >
              {section.status}
            </div>
          )}
        </div>
      ))}
      {!visible.length && (
        <div
          role="status"
          className="px-2 py-2 text-[color:var(--lime-text-muted)]"
        >
          {noResults}
        </div>
      )}
    </div>
  );
}
