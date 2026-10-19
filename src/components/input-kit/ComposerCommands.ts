export interface ComposerCommandHandler {
  isActive(): boolean;
  run(): void | Promise<unknown>;
  priority?: "normal" | "fallback";
}

/** Surface commands resolve within the requested conversation, never the last editor. */
export class ComposerCommands {
  private readonly handlers = new Map<
    string,
    Map<symbol, ComposerCommandHandler>
  >();

  register(scope: string, handler: ComposerCommandHandler): () => void {
    const key = Symbol(scope);
    let scoped = this.handlers.get(scope);
    if (!scoped) this.handlers.set(scope, (scoped = new Map()));
    scoped.set(key, handler);
    return () => {
      scoped.delete(key);
      if (!scoped.size && this.handlers.get(scope) === scoped)
        this.handlers.delete(scope);
    };
  }

  private active(
    scope: string | null | undefined,
  ): ComposerCommandHandler | undefined {
    if (!scope) return;
    const handlers = [...(this.handlers.get(scope)?.values() ?? [])].reverse();
    for (const priority of ["normal", "fallback"] as const) {
      const handler = handlers.find(
        (handler) =>
          (handler.priority ?? "normal") === priority && handler.isActive(),
      );
      if (!handler) continue;
      return handler;
    }
  }

  canRun(scope: string | null | undefined): boolean {
    return this.active(scope) !== undefined;
  }

  async run(
    command: "composer.addFiles",
    scope: string | null | undefined,
  ): Promise<boolean> {
    if (command !== "composer.addFiles") return false;
    const handler = this.active(scope);
    if (!handler) return false;
    await handler.run();
    return true;
  }
}

export const composerCommands = new ComposerCommands();
