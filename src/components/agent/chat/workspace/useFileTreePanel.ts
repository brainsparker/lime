import { usePersistedBooleanAtom } from "@/hooks/usePersistedBooleanAtom";
import { FILE_TREE_OPEN_ATOM_KEY } from "@/lib/api/persistedAtomTypes";

export function useFileTreePanel() {
  const state = usePersistedBooleanAtom(FILE_TREE_OPEN_ATOM_KEY);
  return {
    isOpen: state.value,
    disabled: !state.ready || state.updating,
    persistenceError: state.error,
    setOpen: state.setValue,
    toggle: () => state.setValue(!state.value),
  };
}
