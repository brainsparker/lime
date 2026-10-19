import type { OpenDialogOptions as ElectronOpenDialogOptions } from "./electronRuntime";
import type { OpenDialogOptions } from "../src/lib/desktop-host/dialogOptions";
import { platform as hostPlatform } from "node:process";

export function normalizeOpenDialogOptions(
  value: unknown,
  platform: string = hostPlatform,
): { options: ElectronOpenDialogOptions; multipleSelection: boolean } {
  const input: OpenDialogOptions =
    value && typeof value === "object" ? (value as OpenDialogOptions) : {};
  const properties: ElectronOpenDialogOptions["properties"] = [];
  if (input.directory) {
    properties.push("openDirectory");
  } else {
    properties.push("openFile");
    if (
      input.filesAndDirectories &&
      input.multiple &&
      !input.filters?.length &&
      platform === "darwin"
    ) {
      properties.push("openDirectory");
    }
  }
  if (input.multiple) properties.push("multiSelections");
  if (input.recursive) properties.push("treatPackageAsDirectory");
  return {
    options: {
      title: input.title,
      defaultPath: input.defaultPath,
      filters: input.filters,
      properties,
    },
    multipleSelection: Boolean(input.multiple),
  };
}
