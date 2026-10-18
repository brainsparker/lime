import assert from "node:assert/strict";
import { Script } from "node:vm";
import { JSDOM } from "jsdom";
import { it, onTestFinished } from "vitest";
import { createArtifactFrameDriver } from "./artifact-frame-driver.mjs";

// 仅模拟布局和 CDP 边界；实际 Chromium 命中检测由独立原生场景验收。
function fixture(hit) {
  const dom = new JSDOM('<iframe id="frame"></iframe>');
  onTestFinished(() => dom.window.close());
  const frame = dom.window.document.querySelector("iframe");
  const document = frame.contentDocument;
  document.body.innerHTML =
    '<button id="cell"><span>Cell</span></button><button id="handle">Resize</button>';
  const cell = document.getElementById("cell");
  const handle = document.getElementById("handle");
  const box = { x: 10, y: 20, width: 40, height: 40 };
  frame.getClientRects = () => [{ width: 400, height: 300 }];
  frame.getBoundingClientRect = () => ({ x: 100, y: 150 });
  cell.getBoundingClientRect = () => box;
  cell.scrollIntoView = () => {};
  document.elementFromPoint = (x, y) => hit({ x, y, cell, handle });
  dom.window.document.elementFromPoint = () => frame;
  const commands = [];
  const evaluate = (fn, input) =>
    new Script(`(${fn.toString()})(input)`).runInNewContext({
      window: dom.window,
      input,
    });
  const page = {
    evaluate,
    waitForFunction: async (fn, input) => assert.ok(evaluate(fn, input)),
    locator: () => ({ scrollIntoViewIfNeeded: async () => {} }),
    viewportSize: () => ({ width: 1000, height: 800 }),
    context: () => ({
      newCDPSession: async () => ({
        send: async (method, event) => commands.push({ method, event }),
        detach: async () => commands.push({ detached: true }),
      }),
    }),
  };
  return { driver: createArtifactFrameDriver(page, "#frame"), commands };
}

it("中心无遮挡时通过真实输入边界点击原中心，不调用 DOM click/focus", async () => {
  const { driver, commands } = fixture(({ cell }) => cell.firstChild);
  await driver.click("#cell");
  assert.deepEqual(
    commands.slice(0, 3).map(({ method, event }) => ({
      method,
      x: event.x,
      y: event.y,
      type: event.type,
    })),
    [
      {
        method: "Input.dispatchMouseEvent",
        x: 130,
        y: 190,
        type: "mouseMoved",
      },
      {
        method: "Input.dispatchMouseEvent",
        x: 130,
        y: 190,
        type: "mousePressed",
      },
      {
        method: "Input.dispatchMouseEvent",
        x: 130,
        y: 190,
        type: "mouseReleased",
      },
    ],
  );
  assert.equal(commands.at(-1).detached, true);
});

it("缩放手柄遮住格中心时只选中经命中检测可达的同一格内部位置", async () => {
  const { driver, commands } = fixture(({ x, y, cell, handle }) =>
    x >= 25 && y >= 35 ? handle : cell,
  );
  await driver.click("#cell");
  assert.equal(commands[1].event.x, 120);
  assert.equal(commands[1].event.y, 180);
  assert.equal(commands[1].event.type, "mousePressed");
});

it("目标完全被遮住时在发送任何输入前拒绝，不点击其他对象", async () => {
  const { driver, commands } = fixture(({ handle }) => handle);
  await assert.rejects(driver.click("#cell"), /target is obscured/);
  assert.deepEqual(commands, []);
});

it("没有命中元素或不支持命中 API 时明确拒绝", async () => {
  const { driver, commands } = fixture(() => null);
  await assert.rejects(driver.click("#cell"), /target is obscured/);
  assert.deepEqual(commands, []);
});

it("只读诊断保留每次原生输入的坐标与两层真实命中结果", async () => {
  const { driver, commands } = fixture(({ cell }) => cell);
  const receipt = await driver.click("#cell", undefined, { capture: true });
  assert.deepEqual(receipt.point, { x: 130, y: 190 });
  assert.deepEqual(
    receipt.observations.map(({ event }) => event.type),
    ["mouseMoved", "mousePressed", "mouseReleased"],
  );
  for (const observation of [
    ...receipt.observations,
    { elements: receipt.after },
  ]) {
    assert.equal(observation.elements[0].dispatchHit.frame, true);
    assert.equal(observation.elements[0].dispatchHit.target, true);
  }
  assert.equal(
    commands.filter(({ method }) => method === "Input.dispatchMouseEvent")
      .length,
    3,
  );
});
