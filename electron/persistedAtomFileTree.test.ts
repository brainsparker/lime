import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistedAtomHost } from "./persistedAtomHost";
import { parsePersistedAtomReadRequest } from "../src/lib/api/persistedAtomProtocol";

const key = "app-shell-file-tree-open";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await vi.waitFor(() => rm(root, { recursive: true, force: true }));
});
async function createRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "file-tree-state-"));
  roots.push(root);
  return root;
}

describe("File tree visibility in the existing Host atom owner", () => {
  it("defaults closed while preserving the independent Summary default", async () => {
    const host = new PersistedAtomHost(await createRoot());
    try {
      await host.ready;
      expect(
        host.sendPersistedAtomState({ key, query: { kind: "value" } }),
      ).toMatchObject({
        key,
        outcome: "ready",
        data: { queryKind: "value", value: false },
      });
      expect(
        host.sendPersistedAtomState({
          key: "app-shell-summary-panel-pinned",
          query: { kind: "value" },
        }),
      ).toMatchObject({
        outcome: "ready",
        data: { value: true },
      });
    } finally {
      host.dispose();
    }
  });

  it("broadcasts and restores the same saved value through the typed protocol", async () => {
    const root = await createRoot();
    const events: Array<{ key: string }> = [];
    const host = new PersistedAtomHost(root, (_event, payload) =>
      events.push(payload as { key: string }),
    );
    let restored: PersistedAtomHost | undefined;
    try {
      await host.ready;
      expect(
        parsePersistedAtomReadRequest({ key, query: { kind: "value" } }),
      ).toEqual({ key, query: { kind: "value" } });
      expect(
        host.updatePersistedAtomState({
          key,
          mutation: { op: "set", value: true },
        }),
      ).toMatchObject({ key, outcome: "applied", changed: true, value: true });
      expect(events.some((event) => event.key === key)).toBe(true);
      await vi.waitFor(
        async () => {
          const saved = JSON.parse(
            await readFile(path.join(root, "host-state.json"), "utf8"),
          );
          expect(saved.atoms[key]).toBe(true);
        },
        { timeout: 5000 },
      );
      restored = new PersistedAtomHost(root);
      await restored.ready;
      expect(
        restored.sendPersistedAtomState({ key, query: { kind: "value" } }),
      ).toMatchObject({ outcome: "ready", data: { value: true } });
      expect(
        restored.updatePersistedAtomState({
          key,
          mutation: { op: "set", value: "false" },
        }),
      ).toMatchObject({ outcome: "invalid", changed: false });
      expect(
        restored.updatePersistedAtomState({
          key: "arbitrary-boolean",
          mutation: { op: "set", value: true },
        }),
      ).toMatchObject({ outcome: "invalid", changed: false });
      expect(
        restored.sendPersistedAtomState({ key, query: { kind: "value" } }),
      ).toMatchObject({ data: { value: true } });
    } finally {
      restored?.dispose();
      host.dispose();
    }
  });
});
