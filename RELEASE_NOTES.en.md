## Lime v1.155.0

Simplified Chinese release notes are the primary version; this English companion summarizes the same release.

### Features

- Add semantic TUI copying for answers, code blocks, and displayed source blocks, a status copy picker, Markdown/HTML formats, and narrow-screen key hints.
- Let history reading and copy mode absorb paginated content while preserving reading position, mouse selection, and group snapshots, with navigation back to the latest content.
- Project read, search, and directory-list actions for commands through the shared App Server, consistently across live notifications, resume, and pagination.

### Fixes

- Preserve continuous ASCII/IME input, Tab after short IME prefixes, and disconnected drafts; process input bursts before drawing to reduce scheduling-induced text splits.
- Correct layout and first-key handling after terminal resizing and external editor handoff; reflow automatically when tmux omits size notifications.
- Keep asynchronous copy, image paste, and completion feedback tied to their original context so late results cannot affect a new thread, selection, or draft; a shared worker retains native clipboard ownership.
- Preserve actual command argv, working directory, and process identity across polling and stdin continuation, with exactly one start/completion for preparation failures, silent commands, and trailing output.
- Preserve complete terminal interaction snapshots across completion, live/read/page projection, and cold recovery after process restart.

### Improvements and Refactoring

- Consolidate terminal geometry, input timing, draw gating, clipboard scheduling, and history snapshot owners by replacing duplicate paths.
- Consolidate command parsing, execution sessions, and canonical projection, and split large modules while retaining the shared GUI/CLI/TUI App Server and RuntimeCore.

### Tests and Quality

- Extend actual command execution, CLI stdio, TUI PTY, history pagination, clipboard, and tmux resize regressions for canonical identities, exactly-once completion, and terminal restoration.
- Validate a fixed release candidate with isolated build artifacts, and record platform evidence by its actual scope; macOS results do not substitute for Windows/Linux native clipboard or live-provider checks.

### Documentation

- Update architecture, command boundaries, TUI inventories, and execution plans with current owners, removed paths, and remaining acceptance scope.

### Other

- Align the desktop app, CLI npm package, and Rust workspace at `1.155.0`.

**Full Changelog**: `v1.154.0` -> `v1.155.0`
