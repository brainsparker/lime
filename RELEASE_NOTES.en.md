## Lime v1.164.0

Simplified Chinese release notes are the primary version. This English companion summarizes the same release scope.

### Features

- Add an asynchronous user-input panel with question drafts, answer editing, submission recovery and cross-turn state projection.
- Add thread goals and goal attachments for new-thread submission, draft restoration and attachment association.
- Improve the workspace file tree, file menus, context actions and text-editor entry points with shared file targets and side-panel behavior.
- Improve sidebar conversation sections, pagination, profile, help and keyboard-shortcut entry points with consistent navigation state.
- Add memory status, citations and staged-output capabilities across the App Server and GUI projections.

### Fixes

- Correct Thread/Turn/Item identity and terminal states across asynchronous input, cancellation, continuation, completion and cold recovery.
- Correct persistence and rendering of message, reasoning, web-search and tool history across deltas, snapshots, compaction, forks and model switches.
- Correct parsing, submission, preview-close and navigation recovery for file, skill, command and message references.
- Correct Electron file-shell, IPC, main-process quit, window-target and workspace-operation boundaries.
- Wait for durable history receipts before publishing Stop Hook prompts and continuing sampling, preventing duplicate inputs during cold recovery and forks.
- Wire trusted root-thread and tool configuration into asynchronous questions, and correct draft restoration and interrupted tool states.
- Handle synchronous questions through the Composer without duplicate submission forms; cancel memory consolidation sampling after lease loss and recheck ownership before writing artifacts.
- Retry R2 multipart completion failures within a fixed limit and publish updater feeds after all payloads pass verification.
- Remove retired conversation-import, legacy OEM cloud-referral and duplicate command paths so production no longer depends on deprecated owners.

### Improvements and Refactoring

- Split composer, goal input, request-user-input, file-tree and sidebar interactions into focused modules while reusing current runtime, App Server and tool-execution boundaries.
- Consolidate canonical history, runtime snapshots, memory-store and projection flows to reduce duplicate conversions and compatibility branches.
- Update protocol schemas, client contracts, command catalogs, governance rules and cross-platform release scripts so generated artifacts and consumers stay aligned.

### Tests and Quality

- Extend targeted regressions for asynchronous user input, thread goals, message history, snapshot recovery, file trees, sidebars, composers, Electron IPC and the App Server.
- Update five-language resources, GUI fixtures, protocol contracts, Rust owner tests, real Electron smoke coverage and release-workflow guards.
- Preserve release evidence, REA records and execution plans while documenting live-provider and packaged-platform coverage boundaries.

### Documentation

- Update architecture, governance, Codex GUI-alignment, runtime-snapshot, composer, sidebar, file-operation and asynchronous-input plans and research ledgers.

### Other

- Align the application, CLI and Rust workspace versions to 1.164.0.

**Full changes**: `v1.163.0` -> `v1.164.0`
