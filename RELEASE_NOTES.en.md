## Lime v1.157.0

Simplified Chinese release notes are the primary version; this English companion summarizes the same release.

### Features

- Use one structured composer for skill, character, and capability mentions, preserving image, path, and rich input data through submission and restoration.
- Support links and code blocks with Markdown submission and preserved reference ranges; add dictation cancellation and isolate late results after conversation switches or IME composition.
- Preview, edit, delete, reorder, and start queued messages while idle; keep pending input separate from the public conversation history.
- Show pending approvals in the conversation with actions and status tied to each request.
- Reuse conversation changes and diff views in the Files panel, with file selection and navigation to the corresponding change.

### Fixes

- Prevent late notifications and conversation switches from applying queue state, title edits, model settings, or working directories to the wrong conversation.
- Correct browser tab and right panel state during restoration, closure, and switching.
- Preserve scroll position when expanding, collapsing, or copying long user messages, and stop copy feedback updates after unmount.
- Correct header toolbar overflow and message/composer placement in compact windows.

### Improvements and Refactoring

- Mount conversation Turns by viewport, retaining independent history pagination, dynamic height measurement, and reading position.
- Consolidate project, branch, and run location controls, structured submission, and input restoration around existing owners.
- Keep queue, approval, file, and settings behavior on the shared App Server and remove replaced components and duplicate projections.
- Consolidate desktop media and clipboard permissions while preserving main window and browser tab boundaries.

### Tests and Quality

- Extend regressions for queue history, search and cold recovery, approval responses, structured input, scrolling, copy lifecycle, and browser tab restoration.
- Update real Electron current fixtures, interaction selectors, and build asset checks, separating source, artifact, and platform evidence.
- Update UI text and regression coverage across five languages.

### Documentation

- Update GUI design, architecture, quality workflows, Codex Desktop research evidence, and alignment execution records.

### Other

- Align the desktop app, CLI npm package, and Rust workspace at `1.157.0`.

**Full Changelog**: `v1.156.0` -> `v1.157.0`
