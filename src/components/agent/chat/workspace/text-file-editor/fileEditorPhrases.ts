import type { TFunction } from "i18next";

const phrases = {
  "Go to line": "goToLine",
  go: "go",
  Find: "find",
  Replace: "replaceLabel",
  next: "next",
  previous: "previous",
  all: "all",
  "match case": "matchCase",
  regexp: "regexp",
  "by word": "byWord",
  replace: "replace",
  "replace all": "replaceAll",
  close: "close",
  "current match": "currentMatch",
  "on line": "onLine",
  "replaced match on line $": "replacedOnLine",
  "replaced $ matches": "replacedMatches",
} as const;

export function fileEditorPhrases(t: TFunction<"agent">): Record<string, string> {
  return Object.fromEntries(Object.entries(phrases).map(([phrase, key]) => [
    phrase,
    t(`agentChat.fileEditor.search.${key}`),
  ]));
}
