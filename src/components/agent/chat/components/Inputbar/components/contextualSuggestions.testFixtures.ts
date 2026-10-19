import { vi } from "vitest";
import type { ContextualSuggestionsConfig } from "./ContextualSuggestions";

export function stubSuggestionGeometry() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
}

export function createContextualSuggestionsFixture(
  overrides: Partial<ContextualSuggestionsConfig> = {},
): ContextualSuggestionsConfig {
  return {
    onAddFiles: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
}
