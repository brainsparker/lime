import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";

export type ComposerSuggestionSource =
  | {
      kind: "at-mention-category";
      category: "files" | "pages" | "spaces" | "chats";
    }
  | { kind: "slash-command"; commandId: string; dismissOnInput?: boolean }
  | { kind: "browser-tabs" };

interface SuggestionMatch {
  /** ProseMirror positions, not displayed-text offsets. */
  from: number;
  query: string;
  trigger: "@" | "/" | "$";
}

export interface ComposerSuggestion {
  active: boolean;
  activation: "typed" | "synthetic" | null;
  anchorPos: number | null;
  dismissedMatch: SuggestionMatch | null;
  kind: "at-mention" | "slash-command" | "skill-mention" | null;
  query: string;
  range: { from: number; to: number } | null;
  source: ComposerSuggestionSource | null;
  trigger: "@" | "+" | "/" | "$" | null;
}

type SuggestionAction =
  | { type: "close" | "dismiss" | "suppress-query" }
  | { type: "open-synthetic"; from: number; trigger: "+" }
  | { type: "set-source"; source: ComposerSuggestionSource | null };

const inactive: ComposerSuggestion = {
  active: false,
  activation: null,
  anchorPos: null,
  dismissedMatch: null,
  kind: null,
  query: "",
  range: null,
  source: null,
  trigger: null,
};

const suggestionKey = new PluginKey<ComposerSuggestion>(
  "composer-suggestion-ui",
);

function typedSuggestion(state: EditorState): ComposerSuggestion | null {
  const { selection } = state;
  if (!selection.empty || selection.$from.parent.type.spec.code) return null;
  const before = selection.$from.parent.textBetween(
    0,
    selection.$from.parentOffset,
    "\n",
    "\ufffc",
  );
  const patterns = [
    /(?:^|[\s([{])@(?!\s)([^@\n\ufffc]*)$/u,
    /(?:^|\s)\/(?!\s)([\p{L}\p{N}\p{M}.:_\\ -]*)$/u,
    /(?:^|[\s([{])\$(?!\s)([^$\n\ufffc]*)$/u,
  ];
  let result: ComposerSuggestion | null = null;
  for (const [index, pattern] of patterns.entries()) {
    const match = before.match(pattern);
    if (!match) continue;
    const query = match[1];
    const from = selection.from - query.length - 1;
    if (result?.range && result.range.from > from) continue;
    const trigger = (["@", "/", "$"] as const)[index];
    result = {
      ...inactive,
      active: true,
      activation: "typed",
      anchorPos: from,
      kind:
        trigger === "@"
          ? "at-mention"
          : trigger === "/"
            ? "slash-command"
            : "skill-mention",
      query,
      range: { from, to: selection.from },
      trigger,
    };
  }
  return result;
}

function mapDismissedMatch(
  transaction: Transaction,
  previous: ComposerSuggestion,
): SuggestionMatch | null {
  const match = previous.dismissedMatch;
  if (!match) return null;
  const mapped = transaction.mapping.mapResult(match.from, 1);
  return mapped.deleted ? null : { ...match, from: mapped.pos };
}

function updateTypedSuggestion(
  transaction: Transaction,
  previous: ComposerSuggestion,
  state: EditorState,
): ComposerSuggestion {
  const dismissedMatch = mapDismissedMatch(transaction, previous);
  const next = typedSuggestion(state);
  if (!next) return dismissedMatch ? { ...inactive, dismissedMatch } : inactive;
  if (
    dismissedMatch &&
    dismissedMatch.from === next.range?.from &&
    dismissedMatch.trigger === next.trigger &&
    next.query.startsWith(dismissedMatch.query)
  )
    return { ...inactive, dismissedMatch };
  const sameMatch =
    previous.active &&
    previous.trigger === next.trigger &&
    previous.range !== null &&
    transaction.mapping.map(previous.range.from, 1) === next.range?.from;
  return { ...next, source: sameMatch ? previous.source : null };
}

function updateSyntheticSuggestion(
  transaction: Transaction,
  previous: ComposerSuggestion,
  state: EditorState,
): ComposerSuggestion {
  if (
    transaction.docChanged &&
    previous.source?.kind === "slash-command" &&
    previous.source.dismissOnInput
  )
    return inactive;
  const from = transaction.mapping.map(previous.range!.from, -1);
  const { selection } = state;
  if (!selection.empty || selection.from < from) return inactive;
  const typed = typedSuggestion(state);
  if (typed?.range && typed.range.from >= from) return typed;
  const query = state.doc.textBetween(from, selection.from, "\n", "\n");
  if (query.includes("\n")) return inactive;
  return {
    ...previous,
    anchorPos: from,
    query,
    range: { from, to: selection.from },
  };
}

function applySuggestionAction(
  action: SuggestionAction,
  previous: ComposerSuggestion,
  transaction: Transaction,
): ComposerSuggestion {
  switch (action.type) {
    case "close":
      return inactive;
    case "dismiss":
    case "suppress-query":
      return previous.activation === "typed" &&
        previous.range &&
        previous.trigger !== "+" &&
        previous.trigger !== null
        ? {
            ...inactive,
            dismissedMatch: {
              from: previous.range.from,
              query: previous.query,
              trigger: previous.trigger,
            },
          }
        : inactive;
    case "open-synthetic":
      return {
        ...inactive,
        active: true,
        activation: "synthetic",
        anchorPos: action.from,
        kind: "at-mention",
        range: { from: action.from, to: action.from },
        trigger: action.trigger,
      };
    case "set-source": {
      if (!previous.active || !previous.range) return previous;
      const from = transaction.mapping.map(previous.range.from, -1);
      const to = previous.activation === "typed" ? from + 1 : from;
      return {
        ...previous,
        anchorPos: previous.trigger === "@" ? from : to,
        query: "",
        range: { from, to },
        source: action.source,
      };
    }
  }
}

export function createComposerSuggestions(): Plugin<ComposerSuggestion> {
  return new Plugin<ComposerSuggestion>({
    key: suggestionKey,
    props: {
      handleDOMEvents: {
        keydown(view, event) {
          return (
            getComposerSuggestion(view.state).active &&
            (event.isComposing || event.keyCode === 229)
          );
        },
        blur(view, event) {
          if (
            getComposerSuggestion(view.state).active &&
            !(
              event.relatedTarget === null && !view.dom.ownerDocument.hasFocus()
            )
          )
            view.dispatch(dismiss(view.state));
          return false;
        },
      },
    },
    state: {
      init: () => inactive,
      apply(transaction, previous, _oldState, state) {
        const action = transaction.getMeta(suggestionKey) as
          | SuggestionAction
          | undefined;
        if (action) return applySuggestionAction(action, previous, transaction);
        if (!transaction.docChanged && !transaction.selectionSet)
          return previous;
        return previous.active &&
          previous.activation === "synthetic" &&
          previous.range
          ? updateSyntheticSuggestion(transaction, previous, state)
          : updateTypedSuggestion(transaction, previous, state);
      },
    },
  });
}

export function getComposerSuggestion(state: EditorState): ComposerSuggestion {
  return suggestionKey.getState(state) ?? inactive;
}

export function withComposerSuggestionAction(
  transaction: Transaction,
  action: SuggestionAction,
): Transaction {
  return transaction.setMeta(suggestionKey, action);
}

export function toggleContext(state: EditorState): Transaction {
  const current = getComposerSuggestion(state);
  return withComposerSuggestionAction(
    state.tr,
    current.active &&
      current.activation === "synthetic" &&
      current.trigger === "+"
      ? { type: "close" }
      : { type: "open-synthetic", from: state.selection.from, trigger: "+" },
  );
}

export function dismiss(state: EditorState): Transaction {
  return withComposerSuggestionAction(state.tr, { type: "dismiss" });
}

export function setSource(
  state: EditorState,
  source: ComposerSuggestionSource | null,
  suggestion: ComposerSuggestion,
): Transaction | null {
  if (!suggestion.active || !suggestion.range) return null;
  const from =
    suggestion.range.from + Number(suggestion.activation === "typed");
  return withComposerSuggestionAction(
    state.tr.insertText("", from, suggestion.range.to),
    { type: "set-source", source },
  );
}

export function clear(
  state: EditorState,
  suggestion: ComposerSuggestion,
): Transaction | null {
  if (!suggestion.active || !suggestion.range) return null;
  const { from, to } = suggestion.range;
  const transaction = state.tr.insertText("", from, to);
  transaction.setSelection(TextSelection.create(transaction.doc, from));
  return withComposerSuggestionAction(transaction, { type: "close" });
}

export function completeQuery(
  state: EditorState,
  query: string,
  suggestion: ComposerSuggestion,
): Transaction | null {
  if (!suggestion.active || !suggestion.range) return null;
  const from =
    suggestion.range.from + Number(suggestion.activation === "typed");
  const transaction = state.tr.insertText(query, from, suggestion.range.to);
  transaction.setSelection(
    TextSelection.create(transaction.doc, from + query.length),
  );
  return transaction;
}
