## Lime v1.162.0

Simplified Chinese release notes are the primary version. This English companion summarizes the same release scope.

### Features

- Unify the window header and workspace tabs, bring conversation actions and side-panel entry points together, and support pointer and keyboard resizing.
- Add a conversation summary panel with a persisted pin preference, using canonical conversation state.
- Add account preferences for enabling remote plugins and individual skills, shared by lists and previews and refreshed after saving.

### Fixes

- Correct Responses streaming tool-call identity and terminal-event deduplication to avoid treating argument events as extra calls.
- Correct tool-history truncation, budgets and read-result projection while preserving call/output associations and original records.
- Generate context-compaction summaries with the current model and improve cancellation, persistence and forked-history handling.
- Route conversation forks through the existing draft-scope navigation flow to keep parent and child drafts separate.
- Strengthen account isolation, failure handling and refresh behavior for plugin preferences; skills requiring Apps authorization remain gated.

### Improvements and Refactoring

- Consolidate remote plugin catalog, detail and installed-state facts while keeping local runtime configuration separate from remote account preferences.
- Replace legacy task-center tabs and the Activity panel with the shared header, tabs and summary, and remove unused home callbacks and derived state.
- Split context compaction, history normalization and Hook lifecycle logic into existing domain modules.

### Tests and Quality

- Extend regressions for workspace layout, summary pinning, plugin preferences, tool-call identity and history budgets, with related Electron and public JSON-RPC scenarios.
- Update interface resources in all five languages and align affected contracts and fixtures.

### Documentation

- Update architecture diagrams, desktop structure evidence and runtime/plugin execution plans while retaining open scope and validation limits.

### Other

- Align the application, CLI and Rust workspace versions to 1.162.0.

**Full changes**: `v1.161.0` -> `v1.162.0`
