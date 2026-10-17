## Lime v1.160.0

Simplified Chinese release notes are the primary version; this English companion summarizes the same release.

### Features

- Search settings content and navigate to fields and inner tabs in web search, memory, appearance, and other sections while preserving unsaved changes protection.
- Use shared marketplace and plugin identities across catalog, details, installation, and CLI commands; share configuration and installation state with Skills, MCP, and Apps.
- Improve working directory, service tier, and approvals reviewer propagation and persistence when starting, resuming, and forking conversations.

### Fixes

- Reset dynamic tool host state after connection loss and restore host ownership when resuming conversations.
- Strengthen Skills root watching, plugin configuration persistence, and installation state consistency across entry points.
- Recover macOS release packaging from temporary ticket stapling network failures after notarization acceptance, retaining signing and notarization diagnostics.

### Improvements and Refactoring

- Continue sharing App Server protocols, runtime behavior, and conversation projections across CLI, TUI, and desktop; separate connection, history, resume, and working directory responsibilities.
- Replace retired plugin protocols and direct directory installation entry points; remove old mocks and outdated documentation without parallel implementations.
- Separate memory and appearance presentation components while reusing search, navigation, drafts, and configuration owners; update all five interface languages.

### Tests and Quality

- Extend protocol and runtime coverage for plugin marketplaces, approvals, service tiers, remote working directories, dynamic tools, and Skills.
- Add settings search, inner tab targeting, unsaved navigation, and five language coverage, and update real Electron scenarios.
- Synchronize protocol schemas, generated clients, command catalogs, and retired entry point guards.

### Documentation

- Update architecture diagrams, capability maps, and validation records for the shared backend, plugin reconstruction, and settings search; complete remote marketplace support and overall GUI alignment remain in progress.

### Other

- Align the desktop app, CLI npm package, and Rust workspace at `1.160.0`.

**Full Changelog**: `v1.159.0` -> `v1.160.0`
