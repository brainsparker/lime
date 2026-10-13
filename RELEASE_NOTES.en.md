## Lime v1.156.0

Simplified Chinese release notes are the primary version; this English companion summarizes the same release.

### Features

- Keep background commands streaming and completing after the model turn ends, with running output, terminal interactions, and final status in GUI and TUI; resumed conversations continue receiving notifications for the original command.
- Search conversation content from the sidebar, merge it with title matches, and load additional results; retain title matches with a clear message if content search is unavailable.
- Enable or disable skills through the shared protocol and access Skills from Settings.
- Show conversation patches and workspace Git changes in the Files panel, with refresh and file-opening actions.

### Fixes

- Preserve background command output and completion across Renderer reload, conversation resume, and continuation from another turn, retaining command identity and the input draft.
- Correct CLI interruption and shutdown by cancelling the original turn and draining command output before releasing subscriptions and the App Server connection, preserving the interrupt exit code and durable terminal state.
- Preserve pending input and queue order when the connection closes so multimodal tasks remain available after a cold restart.
- Avoid false dangerous-command matches in Bash/POSIX and PowerShell strings, comments, and file names; inspect literal invocations and paths for the actual shell, and route dynamic syntax through the existing approval flow.
- Clean terminal control sequences from command text and make running command output visible.

### Improvements and Refactoring

- Consolidate background execution, cancellation, output draining, and Command lifecycle across live notifications, reads, pagination, and cold recovery using one canonical projection.
- Split large execution, recovery, projection, and event persistence modules while retaining the shared GUI/CLI/TUI App Server, RuntimeCore, permission, and tool owners.
- Consolidate native shell tool configuration around shared unified execution and remove duplicate tool surfaces and unused helpers.

### Tests and Quality

- Add unit, protocol, and real stdio/PTY/Electron regressions for background output, resumed notification consumption, cross-turn stdin, cancellation, and transport shutdown.
- Extend shell literal parsing, conversation search, skill toggles, and five-language UI coverage, and improve local test resumption and generated-artifact exclusions.
- Validate fixed release source and build identities, recording evidence for the platforms and interaction paths actually exercised.

### Documentation

- Update architecture, command boundaries, quality workflows, TUI/CLI inventories, and global alignment execution plans.

### Other

- Align the desktop app, CLI npm package, and Rust workspace at `1.156.0`.

**Full Changelog**: `v1.155.0` -> `v1.156.0`
