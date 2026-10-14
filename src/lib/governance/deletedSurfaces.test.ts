import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import catalog from "./legacySurfaceCatalog.json";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

it("dead surface 不得在没有引用时悄悄恢复到工作树", () => {
  const restored = catalog.imports
    .filter((monitor) => monitor.classification === "dead")
    .flatMap((monitor) => monitor.targets)
    .filter((target) => existsSync(resolve(repositoryRoot, target)));
  expect(restored).toEqual([]);
});
