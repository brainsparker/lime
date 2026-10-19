import { useSyncExternalStore } from "react";
import { useAtomValue } from "jotai";
import { questionDraftsAtom } from "./QuestionDraftStore";

export function useQuestionDrafts(scope: string) {
  const store = useAtomValue(questionDraftsAtom);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    () => store.read(scope),
    () => store.read(scope),
  );
  return { store, snapshot };
}
