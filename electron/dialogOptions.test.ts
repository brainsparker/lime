import { describe, expect, it } from "vitest";
import { normalizeOpenDialogOptions } from "./dialogOptions";

describe("native file dialog options", () => {
  it.each(["darwin", "win32", "linux"] as const)(
    "%s 显式目录选择不混入文件，保留原有多选与包目录选项",
    (platform) => {
      expect(
        normalizeOpenDialogOptions(
          {
            directory: true,
            filesAndDirectories: true,
            multiple: true,
            recursive: true,
          },
          platform,
        ),
      ).toEqual({
        options: {
          title: undefined,
          defaultPath: undefined,
          filters: undefined,
          properties: [
            "openDirectory",
            "multiSelections",
            "treatPackageAsDirectory",
          ],
        },
        multipleSelection: true,
      });
    },
  );

  it.each([
    [
      "darwin",
      true,
      undefined,
      ["openFile", "openDirectory", "multiSelections"],
    ],
    ["win32", true, undefined, ["openFile", "multiSelections"]],
    ["linux", true, undefined, ["openFile", "multiSelections"]],
    ["darwin", false, undefined, ["openFile"]],
    [
      "darwin",
      true,
      [{ name: "Images", extensions: ["png"] }],
      ["openFile", "multiSelections"],
    ],
  ] as const)(
    "%s mixed=%s filters=%j",
    (platform, multiple, filters, expected) => {
      const result = normalizeOpenDialogOptions(
        {
          filesAndDirectories: true,
          multiple,
          filters: filters
            ? [...filters].map((filter) => ({
                ...filter,
                extensions: [...filter.extensions],
              }))
            : undefined,
        },
        platform,
      );
      expect(result.options.properties).toEqual(expected);
      expect(result.multipleSelection).toBe(multiple);
    },
  );

  it("普通打开与无参数继续只选单个文件", () => {
    expect(
      normalizeOpenDialogOptions(null, "darwin").options.properties,
    ).toEqual(["openFile"]);
    expect(
      normalizeOpenDialogOptions({ multiple: true }, "darwin").options
        .properties,
    ).toEqual(["openFile", "multiSelections"]);
  });
});
