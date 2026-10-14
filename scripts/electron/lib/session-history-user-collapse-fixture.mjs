import { createHash } from "node:crypto";

export function createLongListUserMessageProbe(fixture, options = {}) {
  const ordinal = options.ordinal ?? fixture.turns.length - 8;
  if (
    !Number.isInteger(ordinal) ||
    ordinal < 2 ||
    ordinal > fixture.turns.length - 2
  ) {
    throw new Error("collapse probe 必须是有前后邻居的非尾部 canonical Turn");
  }
  const turn = fixture.turns[ordinal - 1];
  const visibleLabel = `COLLAPSE_VISIBLE_LINK_${ordinal}`;
  const hiddenLabel = `COLLAPSE_HIDDEN_LINK_${ordinal}`;
  const startMarker = `COLLAPSE_LONG_USER_START_${ordinal}`;
  const tailMarker = `COLLAPSE_LONG_USER_TAIL_${ordinal}`;
  const visibleHref = `https://example.com/lime-collapse/visible/${ordinal}`;
  const hiddenHref = `https://example.com/lime-collapse/hidden/${ordinal}`;
  const rows = Array.from({ length: 140 }, (_, index) => [
    `第 ${index + 1} 段：长 Markdown 的完整 canonical 用户正文。😀 𠮷 e\u0301 👩‍💻 日本語 한국어 繁體中文。`,
    "",
  ]).flat();
  // 代码块放在 20 行阈值以外，不把代码块裁剪合同混入本几何场景。
  rows.splice(
    140,
    0,
    "```text",
    "Unicode: 😀 𠮷 e\u0301 👩‍💻",
    "canonical complete source",
    "```",
    "",
  );
  const text = [
    startMarker,
    "",
    `[${visibleLabel}](${visibleHref})`,
    "",
    ...rows,
    `[${hiddenLabel}](${hiddenHref})`,
    "",
    tailMarker,
  ].join("\n");
  return {
    ordinal,
    totalTurnCount: fixture.turns.length,
    tailTurnId: fixture.turns.at(-1).turnId,
    turnId: turn.turnId,
    itemId: `item_user-${turn.turnId}`,
    clientId: `client-${turn.turnId}`,
    previousTurnId: fixture.turns[ordinal - 2].turnId,
    nextTurnId: fixture.turns[ordinal].turnId,
    text,
    textUtf16Length: text.length,
    textUtf8Length: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
    visibleLabel,
    hiddenLabel,
    visibleHref,
    hiddenHref,
    startMarker,
    tailMarker,
  };
}

// 只用于受控 fixture 定义，必须在 seedCanonicalHistoryThread 之前调用。
export function applyLongListUserMessageProbe(fixture, probe) {
  const turn = fixture.turns[probe.ordinal - 1];
  if (turn?.turnId !== probe.turnId)
    throw new Error("fixture Turn identity 已变化");
  turn.userText = probe.text;
  turn.userInputs = [{ type: "text", text: probe.text }];
  return fixture;
}

export function bindLongListUserMessageProbe(fixture, probe) {
  if (!fixture.sessionId || !fixture.threadId) {
    throw new Error(
      "必须在真实 thread/start 与 canonical seed 完成后绑定 session/thread",
    );
  }
  return { ...probe, sessionId: fixture.sessionId, threadId: fixture.threadId };
}

export function summarizeLongListUserMessageProbe(probe) {
  const { text: _text, ...summary } = probe;
  return summary;
}
