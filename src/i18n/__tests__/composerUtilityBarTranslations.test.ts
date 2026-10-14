import { describe, expect, it } from "vitest";
import { loadNamespaceResource } from "../loadNamespace";
import { SUPPORTED_LOCALES } from "../locales";

describe("ComposerUtilityBar localization", () => {
  it("Git readiness、失败与重试文案覆盖五种支持语言", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const resource = loadNamespaceResource(locale, "agentInputbar");
      for (const key of [
        "gitStatusLoading",
        "gitStatusFailed",
        "retryGitStatus",
      ]) {
        expect(resource).toHaveProperty(
          `agentChat.inputbar.core.projectContext.${key}`,
        );
      }
    }
  });
});
