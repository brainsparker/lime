import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import type { EditorView } from "@tiptap/pm/view";
import {
  detectCodeBlockLanguage,
  normalizeCodeBlockLanguage,
} from "./composerCodeBlockLanguage";
import { loadCodeBlockDetector } from "./composerCodeBlockHighlight";

export interface CodeBlockAutoDetectOptions {
  readonly detect?: (content: string) => Promise<string | null>;
  readonly enabled?: () => boolean;
  readonly delayMs?: number;
}

async function detectLanguage(content: string): Promise<string | null> {
  return detectCodeBlockLanguage(content, async (source, subset) => {
    const detector = await loadCodeBlockDetector();
    return detector.detect(source, subset);
  });
}

export function createCodeBlockAutoDetect(
  options: CodeBlockAutoDetectOptions = {},
): Plugin {
  const detect = options.detect ?? detectLanguage;
  const delay = options.delayMs ?? 150;
  const enabled = () => options.enabled?.() !== false;
  let ownedView: EditorView | undefined;
  return new Plugin({
    appendTransaction: (transactions, previous, state) => {
      if (
        !ownedView?.editable ||
        ownedView.composing ||
        !enabled() ||
        !transactions.some((item) => item.docChanged)
      )
        return null;
      const selected = state.selection.$from;
      if (
        !selected.parent.type.spec.code ||
        selected.parent.attrs.autoDetectLanguage === false ||
        selected.parent.textContent.trim() ||
        selected.parent.attrs.language == null
      )
        return null;
      const mapping = new Mapping();
      transactions.forEach((transaction) =>
        mapping.appendMapping(transaction.mapping),
      );
      const priorPosition = mapping.invert().mapResult(selected.before(), 1);
      if (priorPosition.deleted) return null;
      const priorNode = previous.doc.nodeAt(priorPosition.pos);
      if (
        !priorNode?.type.spec.code ||
        priorNode.type !== selected.parent.type ||
        !priorNode.textContent.trim()
      )
        return null;
      // Only clearing this existing block removes its detected metadata.
      return state.tr
        .setNodeMarkup(selected.before(), undefined, {
          ...selected.parent.attrs,
          language: null,
        })
        .setMeta("addToHistory", false);
    },
    view: (view) => {
      ownedView = view;
      const detections = new WeakMap<ProseMirrorNode, Promise<string | null>>();
      let generation = 0;
      let destroyed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let previousDoc = view.state.doc;
      let previousPlugins = view.state.plugins;
      let previousEditable = view.editable;
      let previousEnabled = enabled();
      const canRun = () =>
        !destroyed && !view.isDestroyed && view.editable && enabled();
      const detectNode = (node: ProseMirrorNode) => {
        let result = detections.get(node);
        if (!result) {
          result = Promise.resolve()
            .then(() => detect(node.textContent))
            .then((language) =>
              language === null
                ? null
                : (normalizeCodeBlockLanguage(language) ?? "plaintext"),
            )
            .catch(() => "plaintext");
          detections.set(node, result);
        }
        return result;
      };
      const run = async (currentGeneration: number) => {
        timer = undefined;
        if (!canRun() || generation !== currentGeneration) return;
        if (view.composing) {
          timer = setTimeout(() => {
            void run(currentGeneration);
          }, delay);
          return;
        }
        const capturedDoc = view.state.doc;
        const candidates: {
          node: ProseMirrorNode;
          pos: number;
          language: Promise<string | null>;
        }[] = [];
        capturedDoc.descendants((node, pos) => {
          if (!node.type.spec.code) return;
          if (node.attrs.autoDetectLanguage !== false)
            candidates.push({ node, pos, language: detectNode(node) });
          return false;
        });
        const results = await Promise.all(
          candidates.map((candidate) => candidate.language),
        );
        if (
          !canRun() ||
          generation !== currentGeneration ||
          view.state.doc !== capturedDoc
        )
          return;
        if (view.composing) {
          timer = setTimeout(() => {
            void run(currentGeneration);
          }, delay);
          return;
        }
        const transaction = view.state.tr;
        candidates.forEach(({ node, pos }, index) => {
          const language = results[index];
          if (
            node.attrs.language === language ||
            node.attrs.autoDetectLanguage === false
          )
            return;
          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            language,
          });
          const updated = transaction.doc.nodeAt(pos);
          if (updated) detections.set(updated, Promise.resolve(language));
        });
        if (transaction.docChanged)
          view.dispatch(transaction.setMeta("addToHistory", false));
      };
      const schedule = () => {
        generation += 1;
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
        if (canRun())
          timer = setTimeout(() => {
            void run(generation);
          }, delay);
      };
      schedule();
      return {
        update: () => {
          const currentDoc = view.state.doc;
          const editable = view.editable;
          const currentEnabled = enabled();
          if (
            previousDoc !== currentDoc ||
            previousPlugins !== view.state.plugins ||
            previousEditable !== editable ||
            previousEnabled !== currentEnabled
          ) {
            previousDoc = currentDoc;
            previousPlugins = view.state.plugins;
            previousEditable = editable;
            previousEnabled = currentEnabled;
            schedule();
          }
        },
        destroy: () => {
          destroyed = true;
          generation += 1;
          if (timer !== undefined) clearTimeout(timer);
          if (ownedView === view) ownedView = undefined;
        },
      };
    },
  });
}
