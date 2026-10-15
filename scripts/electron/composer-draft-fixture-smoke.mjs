import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseComposerDraftFixtureArgs,
  runComposerDraftGuiFixture,
} from "./lib/composer-draft-fixture-driver.mjs";

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const options = parseComposerDraftFixtureArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Composer rich draft real Electron GUI fixture

node scripts/electron/composer-draft-fixture-smoke.mjs \\
  --run-id <fresh-id> --evidence-dir <directory> \\
  --verification-packet <current-persisted-atom-packet.json>

Requires fresh formal product artifacts; never builds product assets.
Uses real GUI edits, native preload IPC, App Server, three workspaces,
and three same-profile Main processes with public app.quit.
Pure protocol/records parsing owners are compiled into the evidence directory.
No browser Gate substitution, Host-only GUI claim or renderer mock fallback.`);
  } else {
    runComposerDraftGuiFixture(options).then(
      ({ summaryPath }) =>
        console.log(`[composer-draft-gui] pass evidence=${summaryPath}`),
      (error) => {
        console.error(error.message);
        process.exitCode = 1;
      },
    );
  }
}
