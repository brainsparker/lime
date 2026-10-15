## Lime v1.158.0

Simplified Chinese release notes are the primary version; this English companion summarizes the same release.

### Features

- Persist composer drafts across restarts, keeping home, workspace, and conversation scopes isolated while restoring rich text and resource references.
- Add code block language selection, search, automatic detection, and syntax highlighting while preserving structured editing and Markdown submission.

### Fixes

- Prevent incorrect draft bindings, stale content restoration, and accidental clearing of new edits during new conversation navigation, first sends, and conversation switches.
- Settle input using runtime acceptance: preserve rejected drafts, restore interrupted input, and prevent late receipts from overwriting newer drafts.
- Navigate skill trial submissions to the actual conversation and restore the editor to an editable state after sending.

### Improvements and Refactoring

- Consolidate draft coordination, desktop persistence, and sidebar draft projections; remove replaced draft events, duplicate state, and navigation implementations.
- Use one settings section definition for menus, loading, and categorization; return to the conversation that opened settings while keeping Home navigation separate, and share notification lifecycle handling across media settings.
- Keep conversation history on the shared App Server and draft persistence on the existing Electron Host.

### Tests and Quality

- Extend coverage for draft saving, cold recovery, first sends, stop restoration, navigation, and input acceptance.
- Strengthen real Electron fixture teardown, build freshness, and resource byte verification.
- Update code block and settings text and regressions across five languages.

### Documentation

- Update GUI architecture, draft and code block research, settings navigation audits, and structural alignment records, distinguishing delivered behavior from remaining work.

### Other

- Align the desktop app, CLI npm package, and Rust workspace at `1.158.0`.

**Full Changelog**: `v1.157.0` -> `v1.158.0`
