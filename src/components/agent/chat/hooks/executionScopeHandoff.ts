import {
  executionScopeKey,
  executionSurfaceKey,
  requireExecutionScope,
  type ExecutionScope,
} from "./executionScope";

type Outcome = { readonly kind: string };
type Binding = { sessionId: string; threadId?: string };
export interface ExecutionScopeTask<T> {
  readonly scope: ExecutionScope;
  readonly payload: T;
  readonly binding: Binding | null;
  bind(binding: Binding): void;
  isCurrent(): boolean;
}
type Entry<T, R> = {
  scope: ExecutionScope;
  payload: T;
  binding: Binding | null;
  epoch: number;
  state: "pending" | "running" | "settled";
  promise: Promise<R>;
  resolve(value: R): void;
  reject(error: unknown): void;
  result?: R;
};
const aborted = () =>
  new DOMException("Execution scope was superseded", "AbortError");

/** Coordinates local payload delivery; canonical sessions remain owned by useAgentSession. */
export class ExecutionScopeHandoff<T, R extends Outcome> {
  private entries = new Map<string, Entry<T, R>>();
  private surface: string;
  private epoch = 0;
  private disposed = false;
  private active: Entry<T, R> | null = null;

  constructor(workspaceId: string, workingDir?: string | null) {
    this.surface = executionSurfaceKey(workspaceId, workingDir);
  }

  observeSurface(workspaceId: string, workingDir?: string | null): boolean {
    const next = executionSurfaceKey(workspaceId, workingDir);
    if (next === this.surface) return false;
    const target =
      this.active &&
      executionSurfaceKey(
        this.active.scope.workspaceId,
        this.active.scope.workingDir,
      );
    this.surface = next;
    if (next !== target) {
      this.cancel();
      return true;
    }
    return false;
  }

  request(scopeInput: ExecutionScope, payload: T): Promise<R> {
    if (this.disposed) throw aborted();
    const scope = requireExecutionScope(scopeInput);
    const key = executionScopeKey(scope);
    const previous = this.entries.get(key);
    if (
      previous &&
      (previous.state === "running" ||
        (previous.result && previous.result.kind !== "rejected") ||
        (previous.epoch === this.epoch && previous.result?.kind !== "rejected"))
    )
      return previous.promise;
    if (
      this.active?.state !== "settled" &&
      this.active &&
      this.active !== previous
    )
      throw new Error("Another execution scope submission is pending");
    const source = executionSurfaceKey(
      scope.sourceWorkspaceId,
      scope.sourceWorkingDir,
    );
    const target = executionSurfaceKey(scope.workspaceId, scope.workingDir);
    if (this.surface !== source && !(previous && this.surface === target))
      throw aborted();
    let resolve!: (value: R) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<R>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const entry: Entry<T, R> = {
      scope,
      payload: previous?.payload ?? payload,
      epoch: this.epoch,
      state: "pending",
      binding: previous?.binding ?? null,
      promise,
      resolve,
      reject,
    };
    this.entries.set(key, entry);
    this.active = entry;
    return promise;
  }

  commit(
    scopeInput: ExecutionScope,
    execute: (task: ExecutionScopeTask<T>) => Promise<R>,
  ): void {
    const entry = this.entries.get(executionScopeKey(scopeInput));
    if (
      !entry ||
      entry !== this.active ||
      entry.state !== "pending" ||
      entry.epoch !== this.epoch ||
      this.disposed
    )
      return;
    entry.state = "running";
    const current = () =>
      !this.disposed && entry.epoch === this.epoch && this.active === entry;
    void execute({
      scope: entry.scope,
      payload: entry.payload,
      get binding() {
        return entry.binding;
      },
      bind(binding) {
        if (
          entry.binding &&
          (entry.binding.sessionId !== binding.sessionId ||
            (entry.binding.threadId &&
              entry.binding.threadId !== binding.threadId))
        )
          throw new Error("Execution scope session identity changed");
        entry.binding = Object.freeze({ ...binding });
      },
      isCurrent: current,
    }).then(
      (result) => {
        entry.state = "settled";
        entry.result = result;
        entry.resolve(result);
      },
      (error) => {
        entry.state = "settled";
        entry.reject(error);
      },
    );
  }

  isActive(scope: ExecutionScope): boolean {
    return Boolean(
      this.active &&
      this.active.epoch === this.epoch &&
      executionScopeKey(this.active.scope) === executionScopeKey(scope),
    );
  }

  cancel(): void {
    this.epoch += 1;
    if (this.active?.state === "pending") {
      this.active.state = "settled";
      this.active.reject(aborted());
    }
    this.active = null;
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
  }
}
