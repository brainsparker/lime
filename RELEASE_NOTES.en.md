## Lime v1.161.0

Simplified Chinese release notes are the primary version; this English companion summarizes the same release.

### Features

- Preview original PDF, DOCX, workbook, and presentation files in the workspace, add location annotations, and send feedback to conversations; edit and save supported workbook and presentation content.
- Extend marketplace source management, remote plugin retrieval, plugin sharing, and access controls through shared desktop, CLI, and App Server contracts.
- Add App Server account and cloud request interfaces to unify desktop login, account state synchronization, and logout.

### Fixes

- Wait for App Server shutdown when quitting the desktop app.
- Fix file revision hashing failures that could prevent professional file previews or annotations from initializing.
- Improve state ownership, stale response handling, and file revision conflicts when switching workspaces, previewing files, and submitting annotations.
- Protect unsaved MCP, experimental, and media service settings, and improve search navigation to developer and media settings.
- Improve App Server request timeouts and diagnostics, plugin refresh and installation identity, and Hooks lifecycle handling.

### Improvements and Refactoring

- Unify home suggestions, sidebar and settings navigation, and improve worktree submission and execution scope handoff.
- Add plugin skill content previews through the shared App Server contract.
- Reorder queued messages with drag and drop or keyboard controls using the existing queue protocol and conversation state.
- Separate file format preview, editing, and annotation responsibilities while sharing file access, save, and conversation submission owners; remove replaced workspace preview paths.
- Keep account credentials in App Server, remove duplicate renderer session token and logout paths, and update all five interface languages.

### Tests and Quality

- Extend focused regressions and Electron scenarios for file parsing, editing, saving, annotations, queue ordering, settings navigation, accounts, and plugins.
- Synchronize protocol schemas, generated clients, command catalogs, CLI consumers, and boundary guards.
- Update runtime dependency preparation, capability scope, and validation records.

### Documentation

- Update architecture and execution plans for professional files, plugin reconstruction, settings drafts, queue interactions, and the shared backend; track remaining GUI alignment and unverified capabilities in their domain plans.

### Other

- Align the desktop app, CLI npm package, and Rust workspace at `1.161.0`.

**Full Changelog**: `v1.160.0` -> `v1.161.0`
