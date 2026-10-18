import assert from "node:assert/strict";

/** 以真实文件读取计数为终态；同一路径的投影刷新不要求卸载面板。 */
export async function waitForArtifactFileRead(
  readCount,
  before,
  timeout = 15_000,
) {
  const deadline = Date.now() + timeout;
  let actual = before;
  while (Date.now() < deadline) {
    actual = await readCount();
    if (actual > before) return actual;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(
    `real file read did not advance: before=${before}, actual=${actual}`,
  );
}

/** 从父文档读取同源 DOM；iframe 的 main world 不安装自动化脚本或事件监听器。 */
export function createArtifactFrameDriver(page, frameSelector) {
  const query = (target) =>
    typeof target === "string" ? { selector: target } : target;
  const read = (target, point) =>
    page.evaluate(
      ({ frameSelector, target, point }) => {
        const frame = [...window.document.querySelectorAll(frameSelector)].find(
          (frame) => frame.getClientRects().length > 0,
        );
        const document = frame?.contentDocument;
        if (!document) return [];
        const elements = target.button
          ? [...document.querySelectorAll("button")].filter(
              (element) =>
                (element.getAttribute("aria-label") ?? element.textContent) ===
                target.button,
            )
          : [...document.querySelectorAll(target.selector)];
        const frameRect = frame.getBoundingClientRect();
        return elements.map((element) => {
          const rect = element.getBoundingClientRect();
          const style = document.defaultView.getComputedStyle(element);
          const hitPoint = [
            [0.5, 0.5],
            [0.25, 0.25],
            [0.75, 0.25],
            [0.25, 0.75],
            [0.75, 0.75],
          ]
            .map(([x, y]) => ({
              x: rect.x + rect.width * x,
              y: rect.y + rect.height * y,
            }))
            .find(({ x, y }) => {
              const hit = document.elementFromPoint?.(x, y);
              return hit && element.contains(hit);
            });
          return {
            text: element.innerText ?? element.textContent ?? "",
            attributes: Object.fromEntries(
              [...element.attributes].map(({ name, value }) => [name, value]),
            ),
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== "hidden" &&
              style.display !== "none",
            box: {
              x: frameRect.x + frame.clientLeft + rect.x,
              y: frameRect.y + frame.clientTop + rect.y,
              width: rect.width,
              height: rect.height,
            },
            hitPoint: hitPoint
              ? {
                  x: frameRect.x + frame.clientLeft + hitPoint.x,
                  y: frameRect.y + frame.clientTop + hitPoint.y,
                }
              : null,
            ...(point
              ? {
                  dispatchHit: {
                    frame:
                      window.document.elementFromPoint?.(point.x, point.y) ===
                      frame,
                    target: element.contains(
                      document.elementFromPoint?.(
                        point.x - frameRect.x - frame.clientLeft,
                        point.y - frameRect.y - frame.clientTop,
                      ),
                    ),
                  },
                }
              : {}),
          };
        });
      },
      { frameSelector, target: query(target), point },
    );
  const visible = async (target) => {
    await page.waitForFunction(
      ({ frameSelector, target }) => {
        const document = [
          ...window.document.querySelectorAll(frameSelector),
        ].find((frame) => frame.getClientRects().length > 0)?.contentDocument;
        const element = target.button
          ? [...(document?.querySelectorAll("button") ?? [])].find(
              (element) =>
                (element.getAttribute("aria-label") ?? element.textContent) ===
                target.button,
            )
          : document?.querySelector(target.selector);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = document.defaultView.getComputedStyle(element);
        return (
          rect.width > 0 && rect.height > 0 && style.visibility !== "hidden"
        );
      },
      { frameSelector, target: query(target) },
    );
    const elements = await read(target);
    assert.equal(
      elements.length,
      1,
      `unique artifact element: ${JSON.stringify(target)}`,
    );
    assert.equal(elements[0].visible, true);
    return elements[0];
  };
  const scroll = async (target) => {
    await page.locator(`${frameSelector}:visible`).scrollIntoViewIfNeeded();
    await page.evaluate(
      ({ frameSelector, target }) => {
        const document = [
          ...window.document.querySelectorAll(frameSelector),
        ].find((frame) => frame.getClientRects().length > 0)?.contentDocument;
        const element = target.button
          ? [...(document?.querySelectorAll("button") ?? [])].find(
              (element) =>
                (element.getAttribute("aria-label") ?? element.textContent) ===
                target.button,
            )
          : document?.querySelector(target.selector);
        element?.scrollIntoView({ block: "nearest", inline: "nearest" });
      },
      { frameSelector, target: query(target) },
    );
    return visible(target);
  };
  const mouse = async (events, observe) => {
    const viewport = page.viewportSize();
    for (const event of events)
      assert.ok(
        event.x >= 0 &&
          event.y >= 0 &&
          event.x < viewport.width &&
          event.y < viewport.height,
        `artifact native input is inside viewport: ${JSON.stringify(event)}`,
      );
    const cdp = await page.context().newCDPSession(page);
    try {
      for (const event of events) {
        if (observe) await observe(event);
        await cdp.send("Input.dispatchMouseEvent", {
          button: "left",
          clickCount: 1,
          ...event,
        });
      }
    } finally {
      await cdp.detach();
    }
  };
  return {
    read,
    visible,
    box: async (target) => (await visible(target)).box,
    text: async (target) => {
      const elements = await read(target);
      assert.equal(elements.length, 1);
      return elements[0].text;
    },
    count: async (target) => (await read(target)).length,
    click: async (target, position, { capture = false } = {}) => {
      const { box, hitPoint } = await scroll(target);
      assert.ok(
        position || hitPoint,
        "artifact target is obscured; native click requires a real hit point",
      );
      const x = position ? box.x + (position.x ?? box.width / 2) : hitPoint.x;
      const y = position ? box.y + (position.y ?? box.height / 2) : hitPoint.y;
      const observations = [];
      await mouse(
        [
          { type: "mouseMoved", x, y, buttons: 0 },
          { type: "mousePressed", x, y, buttons: 1 },
          { type: "mouseReleased", x, y, buttons: 0 },
        ],
        capture
          ? async (event) => {
              observations.push({
                event,
                elements: await read(target, { x, y }),
              });
            }
          : undefined,
      );
      if (capture)
        return {
          target,
          box,
          point: { x, y },
          observations,
          after: await read(target, { x, y }),
        };
    },
    selectText: async (target) => {
      const { box } = await scroll(target);
      const y = box.y + box.height / 2;
      await mouse([
        { type: "mousePressed", x: box.x + 1, y, buttons: 1 },
        ...Array.from({ length: 12 }, (_, index) => ({
          type: "mouseMoved",
          x: box.x + 1 + ((box.width - 2) * (index + 1)) / 12,
          y,
          buttons: 1,
        })),
        { type: "mouseReleased", x: box.x + box.width - 1, y, buttons: 0 },
      ]);
    },
  };
}
