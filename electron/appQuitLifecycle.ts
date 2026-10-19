interface QuitEvent {
  preventDefault(): void;
}

interface QuitApp {
  on(
    event: "before-quit" | "will-quit",
    listener: (event: QuitEvent) => void,
  ): unknown;
  quit(): void;
}

interface QuitLifecycle {
  prepare(): void;
  dispose(): Promise<void>;
  onError(error: unknown): void;
}

/** Keep Main alive until its existing asynchronous owners have stopped. */
export function installAppQuitLifecycle(
  app: QuitApp,
  { prepare, dispose, onError }: QuitLifecycle,
): void {
  let prepared = false;
  let drained = false;
  let shutdown: Promise<void> | undefined;

  app.on("before-quit", () => {
    if (prepared) return;
    prepared = true;
    prepare();
  });
  app.on("will-quit", (event) => {
    if (drained) return;
    event.preventDefault();
    shutdown ??= Promise.resolve()
      .then(dispose)
      .catch(onError)
      .finally(() => {
        drained = true;
        // Electron can remain inside the current `will-quit` dispatch while
        // running the async drain continuation. Resume the quit on the next
        // event-loop turn so the second lifecycle pass is not re-entrant.
        setTimeout(() => app.quit(), 0);
      });
  });
}
