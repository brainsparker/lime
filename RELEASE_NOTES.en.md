## Lime v1.159.0

Simplified Chinese release notes are the primary version; this English companion summarizes the same release.

### Features

- Protect unsaved changes in memory, web search, environment, execution policy, profile, and provider settings, with options to keep editing or discard before leaving.

### Fixes

- Merge only edited fields when saving settings; preserve input after failures, edits made during saving, and language changes.
- Restore the composer when returning from settings and retain initial skill forms during navigation resets.
- Use shared navigation for settings sections, Back, and Home, restoring the actual conversation without replaying one-time launch intents.

### Improvements and Refactoring

- Separate settings draft lifecycles, configuration merging, and presentation while sharing navigation protection and safe error messages.
- Focus local profile editing on display name and bio, with input limits and newline normalization; remove retired tags, completion, avatar, email presentation, and unused fields.
- Reuse existing configuration and App Server boundaries, preserving ownership of conversations, runtime behavior, and persistence.

### Tests and Quality

- Extend coverage for unsaved navigation, field merging, failed saves, edits during saving, conversation recovery, and five languages.
- Strengthen real Electron settings navigation, persistence, cold reads, normal shutdown checks, build freshness, and evidence guards.
- Add Rust profile serialization coverage to prevent retired fields from being written back.

### Documentation

- Update settings navigation, configuration drafts, profile architecture diagrams, research records, and validation evidence, distinguishing local profile editing from future public identity capabilities.

### Other

- Align the desktop app, CLI npm package, and Rust workspace at `1.159.0`.

**Full Changelog**: `v1.158.0` -> `v1.159.0`
