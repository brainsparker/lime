## Lime v1.163.0

Simplified Chinese release notes are the primary version. This English companion summarizes the same release scope.

### Features

- Unify home and conversation composers, with native file, folder and image selection and a Sources panel for conversation materials.
- Consolidate context suggestions through `+`, `@` and skill references for files, skills and commands, retaining structured references and draft restoration.
- Add workspace file browsing and text editing to the shared side panel, with multiple tabs, syntax highlighting, search, saving and unsaved-change protection.
- Integrate background terminal lists and terminal tabs to switch between conversation terminals and inspect ongoing output.

### Fixes

- Correct conversation input commits and queuing, and improve explicit continuation, cancellation, normal completion and their history records.
- Correct tool-history associations and budgets during truncation, context compaction and conversation forks while retaining traceable calls and outputs.
- Correct streaming tool-call identity and argument parsing across protocols, including Gemini and Responses history conversion.
- Preserve native Responses reasoning summaries, encrypted content and ordering across cold recovery, and continue interrupted responses within the same turn.
- Preserve native message phases and correct streaming item completion and turn projection without treating an unknown phase as a final answer.
- Correct completed-message snapshots in public notifications and persistence so live views and cold recovery retain full text after missing or partial deltas.
- Apply completed reasoning snapshots consistently, distinguishing missing text from explicit empty content across summaries, reasoning text and restored views.
- Improve file, skill and command references in messages and navigation restoration after closing preview tabs.
- Correct native file opening, attachment draft restoration, sidebar navigation and panel-resize interactions.

### Improvements and Refactoring

- Consolidate composer layout, commands and attachments, removing the old toolbar, separate image-attachment implementation and duplicate file-management entry points.
- Unify side-panel tabs and lifecycle for file editing, previews, terminals and summaries through existing App Server and tool-execution boundaries.
- Consolidate tool and native response history within the existing model-history boundary, and split call arguments and input commits into focused modules to reduce duplication.

### Tests and Quality

- Extend regressions and public JSON-RPC scenarios for continuation, interruption, completion, tool history, native attachments, file editing and background terminals.
- Update interface resources in all five languages, command contracts and Electron fixtures.
- Correct shared-sidebar and external-process streaming fixtures, and improve release validation for transient macOS notarization ticket failures and Windows updater navigation.

### Documentation

- Update architecture, desktop behavior evidence and GUI, runtime and plugin execution plans while retaining open alignment scope and validation limits.

### Other

- Align the application, CLI and Rust workspace versions to 1.163.0.

**Full changes**: `v1.162.0` -> `v1.163.0`
