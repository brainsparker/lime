## Lime v1.166.0

Simplified Chinese release notes are the primary version.

### Features

- Add experimental background compression for idle local thread history, with writes materializing history through the shared App Server owner. Disabled by default.
- Add browser preferences for link destinations and unify link, website artifact, and native browser-tab opening.

### Fixes

- Preserve exact floating-point command timings during history parsing so archive integrity checks accept previously written rollout records.

- Refine thread archive, restore, and rollback file movement, timestamps, and history reads while preserving durable thread identity.
- Preserve source tabs and workspace context when opening website artifacts and local HTML, with protection against late navigation responses.
- Improve file previews, Markdown links, browser preferences, and keyboard shortcut settings.

### Improvements and Refactoring

- Separate archive, metadata, and compression maintenance into existing domain modules with shared writer and maintenance locks.
- Consolidate output browsing in the workspace side panel and remove duplicate workbench file panels and tab state.
- Synchronize Electron IPC, public JSON-RPC schemas, TypeScript/Rust clients, and command catalogs.

### Tests and Quality

- Extend targeted regressions and real-process checks for background compression, thread lifecycle, link opening, website tabs, and browser preferences.
- Complete Codex alignment, TUI, live-provider, and other unexecuted scenarios remain subject to their documented acceptance boundaries.

### Documentation

- Update shared runtime, thread-store, and GUI architecture and execution records, retaining historical failures and open issues.

### Other

- Align app, CLI, and Rust workspace versions to 1.166.0.

**Full changes**: `v1.165.0` -> `v1.166.0`
