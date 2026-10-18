import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LIME_COLOR_SCHEME_CHANGED_EVENT } from "@/lib/appearance/colorSchemes";
import { EmptyStateLayout } from "./EmptyStateLayout";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const heroCopy = {
  eyebrow: "创作",
  slogan: "青柠一下，灵感即来",
  description: "",
  supportingDescription: "",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  host = null;
  localStorage.clear();
});

function renderLayout() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root?.render(
      <EmptyStateLayout
        heroCopy={heroCopy}
        composer={<div data-testid="home-composer">输入区</div>}
      />,
    );
  });

  return host;
}

describe("EmptyStateLayout", () => {
  it("首屏应展示 Dream Blossom 主视觉并保留原生输入区", () => {
    const container = renderLayout();
    const firstScreen = container.querySelector(
      '[data-testid="empty-state-first-screen"]',
    ) as HTMLElement | null;
    const artwork = container.querySelector(
      '[data-testid="dream-blossom-home-artwork"]',
    );
    const composer = container.querySelector('[data-testid="home-composer"]');

    expect(firstScreen).toBeTruthy();
    expect(artwork).toBeTruthy();
    expect(firstScreen?.textContent).toContain("青柠一下，灵感即来");
    expect(firstScreen?.contains(composer)).toBe(true);
    expect(artwork?.contains(composer)).toBe(false);
    expect(artwork?.querySelector("img")?.getAttribute("src")).toContain(
      "home-hero-v3.webp",
    );
  });

  it("全局深色文字不得覆盖浅色 Banner 素材的文字配色", () => {
    const appStyle = document.documentElement.style;
    const previousTitle = appStyle.getPropertyValue("--lime-text-strong");
    const previousText = appStyle.getPropertyValue("--lime-text");
    appStyle.setProperty("--lime-text-strong", "#fff1f5");
    appStyle.setProperty("--lime-text", "#f1dce4");

    try {
      const container = renderLayout();
      const artwork = container.querySelector<HTMLElement>(
        '[data-testid="dream-blossom-home-artwork"]',
      );
      expect(artwork?.style.getPropertyValue("--home-hero-title-color")).toBe(
        "#402530",
      );
      expect(
        artwork?.style.getPropertyValue("--home-hero-description-color"),
      ).toBe("#654652");
    } finally {
      if (previousTitle) appStyle.setProperty("--lime-text-strong", previousTitle);
      else appStyle.removeProperty("--lime-text-strong");
      if (previousText) appStyle.setProperty("--lime-text", previousText);
      else appStyle.removeProperty("--lime-text");
    }
  });

  it("切换皮肤时应实时更换首页 hero 图片", () => {
    const container = renderLayout();
    const artworkStage = container.querySelector(
      '[data-testid="dream-blossom-home-artwork"]',
    ) as HTMLElement | null;
    const artwork = artworkStage?.querySelector("img");

    expect(artwork?.getAttribute("src")).toContain("home-hero-v3.webp");
    expect(
      artworkStage
        ?.querySelector('[data-testid="home-hero-foreground"] img')
        ?.getAttribute("src"),
    ).toContain("home-character-v3.png");
    expect(
      artworkStage
        ?.querySelector('[data-testid="home-hero-foreground"]')
        ?.getAttribute("data-home-hero-motion"),
    ).toBe("portrait-breathe");
    expect(
      artworkStage?.style.getPropertyValue("--home-hero-motion-duration"),
    ).toBe("4.8s");
    expect(
      artworkStage?.style.getPropertyValue("--home-hero-stage-height-wide"),
    ).toBe("430px");
    expect(
      artworkStage?.style.getPropertyValue("--home-hero-foreground-top"),
    ).toBe("auto");
    expect(
      artworkStage?.style.getPropertyValue("--home-hero-stage-z-index"),
    ).toBe("40");
    expect(artworkStage?.getAttribute("data-home-hero-breakout-layer")).toBe(
      "above-chrome",
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(LIME_COLOR_SCHEME_CHANGED_EVENT, {
          detail: { colorSchemeId: "lime-ocean" },
        }),
      );
    });

    expect(artwork?.getAttribute("src")).toContain("lime-ocean-hero.png");
    expect(
      artworkStage?.querySelector(
        '[data-testid="home-hero-foreground"] img[src*="lime-ocean-foreground.png"]',
      ),
    ).toBeTruthy();
    expect(artworkStage?.getAttribute("data-home-skin-tone")).toBe("dark");
    expect(
      artworkStage
        ?.querySelector('[data-testid="home-hero-foreground"]')
        ?.getAttribute("data-home-hero-foreground-skin"),
    ).toBe("lime-ocean");
    expect(
      artworkStage
        ?.querySelector('[data-testid="home-hero-foreground"]')
        ?.getAttribute("data-home-hero-motion"),
    ).toBe("power-pulse");
    expect(
      artworkStage?.style.getPropertyValue("--home-hero-art-blend-width"),
    ).toBe("68%");
    expect(
      artworkStage?.style.getPropertyValue("--home-hero-art-blend-left"),
    ).toBe("");
  });
});
