import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyField,
  historyKeymap,
  indentWithTab,
  redoDepth,
  redo,
  undoDepth,
  undo,
} from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import type { FileEditorController } from "./FileEditorController";
import { fileEditorPhrases } from "./fileEditorPhrases";
import { FileEditorHistoryToolbar } from "./FileEditorHistoryToolbar";

async function fileLanguage(path: string): Promise<Extension> {
  const extension = path.split(".").at(-1)?.toLowerCase();
  switch (extension) {
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
    case "ts":
    case "tsx":
      return (await import("@codemirror/lang-javascript")).javascript({
        typescript: extension === "ts" || extension === "tsx",
        jsx: extension === "jsx" || extension === "tsx",
      });
    case "json":
      return (await import("@codemirror/lang-json")).json();
    case "md":
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown();
    case "html":
    case "htm":
      return (await import("@codemirror/lang-html")).html();
    case "css":
      return (await import("@codemirror/lang-css")).css();
    case "rs":
      return (await import("@codemirror/lang-rust")).rust();
    case "py":
      return (await import("@codemirror/lang-python")).python();
    default:
      return [];
  }
}

const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--lime-surface)",
    color: "var(--lime-text)",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    lineHeight: "1.6",
  },
  ".cm-content": { padding: "12px 0", caretColor: "var(--lime-text)" },
  ".cm-line": { padding: "0 12px" },
  ".cm-gutters": {
    backgroundColor: "var(--lime-surface)",
    color: "var(--lime-text-muted)",
    border: "none",
  },
  ".cm-activeLineGutter": { backgroundColor: "var(--lime-chrome-tab-hover)" },
  ".cm-cursor": { borderLeftColor: "var(--lime-text)" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--lime-chrome-tab-active-surface)",
  },
  ".cm-panels": {
    backgroundColor: "var(--lime-surface)",
    color: "var(--lime-text)",
    borderColor: "var(--lime-surface-border)",
  },
});

export function CodeMirrorFileEditor({
  controller,
  path,
  label,
  focusRequest = 0,
}: {
  controller: FileEditorController;
  path: string;
  label: string;
  focusRequest?: number;
}) {
  const { t } = useTranslation("agent");
  const phrases = useMemo(() => fileEditorPhrases(t), [t]);
  const localization = useRef(new Compartment()).current;
  const localized = useRef({ phrases, label });
  localized.current = { phrases, label };
  const editor = useRef<EditorView | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  useEffect(() => {
    if (!host.current) return;
    const readOnly = new Compartment();
    const language = new Compartment();
    const initial = controller.getSnapshot();
    let applying = false;
    let disposed = false;
    const updateHistoryState = (state: EditorState) => {
      const canUndo = undoDepth(state) > 0;
      const canRedo = redoDepth(state) > 0;
      setHistoryState((previous) =>
        previous.canUndo === canUndo && previous.canRedo === canRedo
          ? previous
          : { canUndo, canRedo },
      );
    };
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.content,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          controller.getDraft()?.history ?? [],
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightSelectionMatches(),
          syntaxHighlighting(defaultHighlightStyle),
          theme,
          language.of([]),
          readOnly.of([
            EditorState.readOnly.of(initial.isReadOnly),
            EditorView.editable.of(!initial.isReadOnly),
          ]),
          localization.of([
            EditorState.phrases.of(localized.current.phrases),
            EditorView.contentAttributes.of({
              "aria-label": localized.current.label,
            }),
          ]),
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                void controller.saveUntilClean();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !applying)
              controller.edit(update.state.doc.toString());
            if (update.docChanged) updateHistoryState(update.state);
          }),
        ],
      }),
    });
    editor.current = view;
    updateHistoryState(view.state);
    const detachHistory = controller.setEditorHistory(() =>
      undoDepth(view.state) > 0 || redoDepth(view.state) > 0
        ? historyField.init(() => view.state.field(historyField))
        : undefined,
    );
    let previousReadOnly = initial.isReadOnly;
    const unsubscribe = controller.subscribe(() => {
      const state = controller.getSnapshot();
      if (view.state.doc.toString() !== state.content) {
        applying = true;
        try {
          view.dispatch({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: state.content,
            },
          });
        } finally {
          applying = false;
        }
      }
      if (previousReadOnly !== state.isReadOnly) {
        previousReadOnly = state.isReadOnly;
        view.dispatch({
          effects: readOnly.reconfigure([
            EditorState.readOnly.of(state.isReadOnly),
            EditorView.editable.of(!state.isReadOnly),
          ]),
        });
      }
    });
    void fileLanguage(path)
      .then((support) => {
        if (!disposed)
          view.dispatch({ effects: language.reconfigure(support) });
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unsubscribe();
      detachHistory();
      editor.current = null;
      view.destroy();
    };
  }, [controller, path, localization]);
  useEffect(() => {
    editor.current?.dispatch({
      effects: localization.reconfigure([
        EditorState.phrases.of(phrases),
        EditorView.contentAttributes.of({ "aria-label": label }),
      ]),
    });
  }, [phrases, label, localization]);
  useEffect(() => {
    if (focusRequest > 0) editor.current?.focus();
  }, [focusRequest]);
  return (
    <div
      data-testid="file-code-editor"
      className="relative h-full min-h-0 overflow-hidden"
    >
      <div ref={host} className="h-full min-h-0 overflow-hidden" />
      {state.document?.kind !== "conflict" ? (
        <FileEditorHistoryToolbar
          {...historyState}
          isSaving={state.isSaving}
          hasSaveError={state.hasSaveError}
          onUndo={() => {
            const view = editor.current;
            if (view) {
              undo(view);
              view.focus();
            }
          }}
          onRedo={() => {
            const view = editor.current;
            if (view) {
              redo(view);
              view.focus();
            }
          }}
        />
      ) : null}
    </div>
  );
}
