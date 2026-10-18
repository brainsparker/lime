import assert from "node:assert/strict";

const cssPixel = (value, label) => {
  assert.match(value, /^\d+(?:\.\d+)?px$/, `${label}: CSS px value`);
  return Number.parseFloat(value);
};

/**
 * Electron 42.3.3 / Chromium 148.0.7778.218 hidden-window probe，DPR 1/2。
 * 声明精度与设备像素量化分别验收；JSDOM 22 只提供未量化 CSSOM 证据。
 */
export function assertPresentationBorderWidth(
  { declaredWidth, computedWidth, declaredStyle, style, width, ...environment },
  expectedPixels,
  label = "presentation border",
) {
  const { userAgent, devicePixelRatio } = environment;
  assert.equal(typeof userAgent, "string", `${label}: genuine renderer UA`);
  const jsdom = /\bjsdom\/22\.1\.0\b/.test(userAgent),
    chromium = /\bChrome\/148\.0\.7778\.218\b/.test(userAgent);
  assert.ok(jsdom || chromium, `${label}: unverified CSS engine ${userAgent}`);
  assert.ok(Number.isFinite(expectedPixels) && expectedPixels >= 0);
  if (chromium)
    assert.ok(
      [1, 2].includes(devicePixelRatio),
      `${label}: unverified Chromium DPR ${devicePixelRatio}`,
    );
  const emptyJsdomNone =
    jsdom &&
    expectedPixels === 0 &&
    [declaredWidth, computedWidth, declaredStyle, style].every(
      (value) => value === "",
    );
  const resetNone =
    chromium &&
    expectedPixels === 0 &&
    declaredWidth === "medium" &&
    declaredStyle === "none" &&
    style === "none";
  const declared =
    emptyJsdomNone || resetNone
      ? 0
      : cssPixel(declaredWidth, `${label}: inline declaredWidth`);
  assert.ok(
    Math.abs(declared - expectedPixels) <= 1e-4,
    `${label}: inline declaredWidth ${declaredWidth} matches exact source ${expectedPixels}px`,
  );
  const computed = emptyJsdomNone
    ? 0
    : cssPixel(computedWidth, `${label}: computedWidth`);
  if (width !== undefined)
    assert.equal(width, computed, `${label}: numeric computed width agrees`);
  const hidden = ["none", "hidden"].includes(style);
  assert.ok(
    emptyJsdomNone ||
      ["none", "hidden", "solid", "dashed", "dotted", "double"].includes(style),
    `${label}: observed border style`,
  );
  const expectedComputed = jsdom
    ? emptyJsdomNone || hidden
      ? 0
      : declared
    : expectedPixels === 0 || hidden
      ? 0
      : Math.max(1, Math.floor(expectedPixels * devicePixelRatio)) /
        devicePixelRatio;
  assert.equal(
    computed,
    expectedComputed,
    `${label}: ${jsdom ? "JSDOM unquantized CSSOM" : "Chromium device-pixel quantization"} computed width`,
  );
  return {
    engine: jsdom ? "jsdom-cssom" : "chromium-device-pixel-floor",
    expectedComputed,
    evidenceBoundary: emptyJsdomNone
      ? "JSDOM clears shorthand none; no native visibility evidence"
      : jsdom
        ? "unquantized CSSOM; no native raster evidence"
        : "real computed CSS width; no screenshot/raster thickness measurement",
  };
}
