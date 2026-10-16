import { describe, expect, it } from "vitest";
import type { Config } from "@/lib/api/appConfig";
import {
  mergeEnvironmentDraft,
  normalizeEnvironmentConfig,
  readEnvironmentDraft,
} from "./environmentConfig";

function config(): Config {
  return {
    default_provider: "openai",
    environment: {
      shell_import: {
        enabled: true,
        timeout_ms: 1800,
      },
      variables: [
        {
          key: "OPENAI_BASE_URL",
          value: "https://old.example.com",
          enabled: true,
        },
      ],
    },
    image_gen: {
      image_search_pexels_api_key: "keep-image-key",
    },
  } as Config;
}

describe("environmentConfig", () => {
  it("只投影环境配置并给缺失字段稳定默认值", () => {
    expect(
      normalizeEnvironmentConfig({ default_provider: "openai" } as Config),
    ).toEqual({
      shell_import: { enabled: false, timeout_ms: 1500 },
      variables: [],
    });
  });

  it("保存环境覆盖项时保留并发配置字段", () => {
    const current = config();
    const snapshot = readEnvironmentDraft(current);
    const draft = {
      ...snapshot,
      variables: [
        {
          key: "OPENAI_API_BASE",
          value: "https://new.example.com",
          enabled: true,
        },
      ],
    };

    const next = mergeEnvironmentDraft(current, draft, snapshot);

    expect(next.environment).toEqual({
      shell_import: {
        enabled: true,
        timeout_ms: 1800,
      },
      variables: [
        {
          key: "OPENAI_API_BASE",
          value: "https://new.example.com",
          enabled: true,
        },
      ],
    });
    expect(next.image_gen).toEqual(current.image_gen);
  });

  it("只保存被编辑的 shell_import 字段", () => {
    const current = config();
    const snapshot = readEnvironmentDraft(current);
    const next = mergeEnvironmentDraft(
      current,
      {
        ...snapshot,
        shellImportEnabled: false,
        shellImportTimeout: "3200",
      },
      snapshot,
    );

    expect(next.environment?.shell_import).toEqual({
      enabled: false,
      timeout_ms: 3200,
    });
    expect(next.environment?.variables).toEqual(snapshot.variables);
  });

  it("编辑超时保留后来更新的开关与变量", () => {
    const original = config();
    const snapshot = readEnvironmentDraft(original);
    const current = structuredClone(original);
    current.environment!.shell_import.enabled = false;
    current.environment!.variables = [
      { key: "LATER", value: "later", enabled: true },
    ];
    const next = mergeEnvironmentDraft(
      current,
      { ...snapshot, shellImportTimeout: "2400" },
      snapshot,
    );
    expect(next.environment).toEqual({
      shell_import: { enabled: false, timeout_ms: 2400 },
      variables: [{ key: "LATER", value: "later", enabled: true }],
    });
  });

  it.each([
    ["", 1500],
    ["50", 100],
    ["40000", 30000],
  ])("保存时归一化超时 %s 为 %s，输入投影保持原值", (input, expected) => {
    const current = config();
    const snapshot = readEnvironmentDraft(current);
    const draft = { ...snapshot, shellImportTimeout: input };
    expect(
      mergeEnvironmentDraft(current, draft, snapshot).environment?.shell_import
        .timeout_ms,
    ).toBe(expected);
    expect(draft.shellImportTimeout).toBe(input);
  });
});
