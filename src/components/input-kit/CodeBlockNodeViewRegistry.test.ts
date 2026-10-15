import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { composerSchema } from "@/components/input-kit/composerSchema";
import { CodeBlockNodeViewRegistry } from "./CodeBlockNodeViewRegistry";

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
function setup() {
  const doc = composerSchema.node(
    "doc",
    null,
    ["one", "two"].map((text) =>
      composerSchema.node("code_block", null, composerSchema.text(text)),
    ),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const view = new EditorView(host, { state: EditorState.create({ doc }) });
  const registry = new CodeBlockNodeViewRegistry();
  cleanups.push(() => {
    view.destroy();
    registry.destroy();
    host.remove();
  });
  return { view, registry };
}

describe("CodeBlockNodeViewRegistry", () => {
  it("snapshot identity stays stable between publications; entries/id/container remain distinct", () => {
    const { view, registry } = setup();
    const initial = registry.getSnapshot();
    expect(registry.getSnapshot()).toBe(initial);
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    const first = registry.createNodeView(
      view.state.doc.firstChild!,
      view,
      () => 0,
    );
    const one = registry.getSnapshot();
    const second = registry.createNodeView(
      view.state.doc.lastChild!,
      view,
      () => view.state.doc.firstChild!.nodeSize,
    );
    const two = registry.getSnapshot();
    expect(two).not.toBe(one);
    expect(registry.getSnapshot()).toBe(two);
    expect(new Set(two.map((entry) => entry.id)).size).toBe(2);
    expect(first.toolbarPortalContainer).not.toBe(
      second.toolbarPortalContainer,
    );
    expect(two.map((entry) => entry.getContent())).toEqual(["one", "two"]);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(first.update(view.state.doc.firstChild!)).toBe(true);
    expect(registry.getSnapshot()).toBe(two);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    first.destroy();
    expect(registry.getSnapshot()).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("wrong-instance unregister/update cannot publish or remove another entry", () => {
    const { view, registry } = setup();
    const first = registry.createNodeView(
      view.state.doc.firstChild!,
      view,
      () => 0,
    );
    const second = registry.createNodeView(
      view.state.doc.lastChild!,
      view,
      () => 5,
    );
    const snapshot = registry.getSnapshot();
    registry.unregisterNodeView(first.id, second);
    registry.publishNodeViewUpdate(first.id, second);
    expect(registry.getSnapshot()).toBe(snapshot);
    expect(registry.isOwnerCurrent(first.id, first, view)).toBe(true);
    expect(registry.isOwnerCurrent(first.id, second, view)).toBe(false);
  });

  it("destroy clears snapshot once, invalidates old entry, and supports repeated cleanup/unsubscribe", () => {
    const { view, registry } = setup();
    registry.createNodeView(view.state.doc.firstChild!, view, () => 0);
    const entry = registry.getSnapshot()[0];
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    registry.destroy();
    const empty = registry.getSnapshot();
    registry.destroy();
    expect(registry.getSnapshot()).toBe(empty);
    expect(empty).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(entry.selectLanguage("python")).toBe(false);
    expect(entry.getContent()).toBe("");
    unsubscribe();
    unsubscribe();
    expect(() =>
      registry.createNodeView(view.state.doc.firstChild!, view, () => 0),
    ).toThrow("destroyed");
  });
});
