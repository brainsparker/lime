import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { assertPresentationBorderWidth } from "./presentation-border-width.mjs";
import electronSamples from "./presentation-border-width.testFixtures.json" with { type: "json" };

const chromium = {
  userAgent: electronSamples[0].userAgent,
  devicePixelRatio: 1,
};
const line = {
  declaredWidth: "3.25px",
  declaredStyle: "solid",
  computedWidth: "3px",
  style: "solid",
  width: 3,
  ...chromium,
};

describe("presentation border declaration and computed width evidence", () => {
  for (const engine of electronSamples)
    for (const context of engine.contexts)
      it(`真实 hidden Electron DPR ${engine.devicePixelRatio}/${context} 的完整捕获样本符合断言`, () => {
        assert.equal(engine.source.electron, "42.3.3");
        assert.equal(engine.source.chrome, "148.0.7778.218");
        assert.equal(engine.zoomFactor, 1);
        for (const sample of engine.samples) {
          const evidence = assertPresentationBorderWidth(
            {
              ...sample,
              userAgent: engine.userAgent,
              devicePixelRatio: engine.devicePixelRatio,
              style: sample.computedStyle,
            },
            sample.input,
            `${context}/${sample.input}/${sample.borderStyle}`,
          );
          assert.equal(evidence.engine, "chromium-device-pixel-floor");
        }
      });

  it("3.25 原声明和量化后的3必须同时正确，不能只断 computed", () => {
    assertPresentationBorderWidth(line, 3.25);
    assert.throws(
      () =>
        assertPresentationBorderWidth({ ...line, declaredWidth: "3px" }, 3.25),
      /inline declaredWidth/,
    );
    assert.throws(
      () =>
        assertPresentationBorderWidth(
          { ...line, computedWidth: "3.25px", width: 3.25 },
          3.25,
        ),
      /Chromium device-pixel quantization/,
    );
    assert.throws(
      () => assertPresentationBorderWidth({ ...line, width: 2 }, 3.25),
      /numeric computed width/,
    );
  });

  it("只容许1e-4内的声明序列化，computed仍须精确且DPR影响小数边", () => {
    const inherited = {
      ...line,
      declaredWidth: "1.33333px",
      computedWidth: "1px",
      width: 1,
    };
    assertPresentationBorderWidth(inherited, 4 / 3);
    assert.throws(
      () =>
        assertPresentationBorderWidth(
          { ...inherited, declaredWidth: "1.333px" },
          4 / 3,
        ),
      /inline declaredWidth/,
    );
    assert.throws(
      () =>
        assertPresentationBorderWidth(
          { ...line, computedWidth: "3.00001px", width: 3.00001 },
          3.25,
        ),
      /quantization/,
    );
    const half = {
      ...line,
      declaredWidth: "1.5px",
      computedWidth: "1.5px",
      width: 1.5,
      devicePixelRatio: 2,
    };
    assertPresentationBorderWidth(half, 1.5);
    assert.throws(
      () =>
        assertPresentationBorderWidth({ ...half, devicePixelRatio: 1 }, 1.5),
      /quantization/,
    );
  });

  it("JSDOM只认可未量化CSSOM，不把真实Chromium量化值伪装成domain成功", () => {
    const jsdom = {
      ...line,
      userAgent: "Mozilla/5.0 jsdom/22.1.0",
      computedWidth: "3.25px",
      width: 3.25,
    };
    assert.equal(
      assertPresentationBorderWidth(jsdom, 3.25).engine,
      "jsdom-cssom",
    );
    assert.throws(
      () =>
        assertPresentationBorderWidth(
          { ...jsdom, computedWidth: "3px", width: 3 },
          3.25,
        ),
      /JSDOM unquantized/,
    );
    const noFill = {
      ...jsdom,
      declaredWidth: "",
      computedWidth: "",
      declaredStyle: "",
      style: "",
      width: 0,
    };
    assert.match(
      assertPresentationBorderWidth(noFill, 0).evidenceBoundary,
      /no native visibility evidence/,
    );
    assert.throws(
      () => assertPresentationBorderWidth({ ...noFill, ...chromium }, 0),
      /inline declaredWidth/,
    );
  });

  it("实际Chromium的none必须同时呈现明确none和computed0", () => {
    const noFill = {
      ...line,
      declaredWidth: "medium",
      declaredStyle: "none",
      computedWidth: "0px",
      style: "none",
      width: 0,
    };
    assertPresentationBorderWidth(noFill, 0);
    assert.throws(() =>
      assertPresentationBorderWidth({ ...noFill, declaredStyle: "solid" }, 0),
    );
    assert.throws(
      () =>
        assertPresentationBorderWidth(
          { ...noFill, computedWidth: "1px", width: 1 },
          0,
        ),
      /quantization/,
    );
  });

  it("未知引擎、版本或未实测DPR拒绝推断", () => {
    for (const userAgent of [
      "",
      "Firefox/150.0",
      "Chrome/149.0.0.0",
      "jsdom/99.0.0",
    ])
      assert.throws(
        () => assertPresentationBorderWidth({ ...line, userAgent }, 3.25),
        /unverified CSS engine/,
      );
    for (const devicePixelRatio of [undefined, 0, 1.25, 3])
      assert.throws(
        () =>
          assertPresentationBorderWidth({ ...line, devicePixelRatio }, 3.25),
        /unverified Chromium DPR/,
      );
  });
});
