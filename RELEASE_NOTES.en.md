## Lime v1.165.0

Simplified Chinese release notes are the primary version. This English companion summarizes the same release scope.

### Features

- Add recent outputs, file previews and website entry points to the workspace side panel with consistent tab, browser and editor navigation.
- Support range and multiple selection in the file tree, with improved menus, keyboard actions and editor integration.
- Run Memory consolidation through the shared Agent runtime with restricted tools, native file changes, citations and usage tracking.

### Fixes

- Correct asynchronous question drafts, cross-thread recovery, cancellation and terminal rendering to avoid duplicate input and invalid status alerts.
- Restore session settings, compaction checkpoints, model history, input images and usage across thread forks and cold recovery.
- Preserve Anthropic signature deltas and Gemini signed content, and isolate native history by provider route during replay.
- Cancel and drain native file tasks during internal Agent shutdown before committing their results.
- Fix loading of adjacent dynamic libraries by sandboxed native file tools on macOS.
- Fall back to the global Memory summary until a workspace summary is available, while retaining workspace precedence.

### Improvements and Refactoring

- Persist canonical changes, compaction and model records in the same rollout batch and durable receipt, supporting standalone recovery from plain and compressed rollouts.
- Use a single strict structured request without tools for Memory extraction, and retain exact source-version and ownership checks during consolidation.
- Synchronize Hook metadata, plugin projections, protocol schemas and generated clients.
- Split history recovery, thread usage, file output and build-input modules, and remove the old consolidation proposal path and duplicate conversions.

### Tests and Quality

- Extend public JSON-RPC coverage for forks, cold recovery, four-protocol history capture and native filesystem permissions.
- Update side-panel, file-tree, question, five-language, Electron fixture and build-freshness regressions.
- Memory, full Codex alignment and platform coverage remain subject to the actual acceptance scope recorded in their execution plans.

### Documentation

- Update architecture, GUI, Memory, thread recovery, plugin and runtime alignment plans while preserving open acceptance work and original failure records.

### Other

- Align the application, CLI and Rust workspace versions to 1.165.0.

**Full changes**: `v1.164.0` -> `v1.165.0`
