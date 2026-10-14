// Serialized fixture observation. Export geometry and structural relationships,
// never text, URLs, arbitrary attributes, class names or native error messages.
export function readCopyActionDom(button, expected) {
  const choose = (value, choices) =>
    choices.includes(value) ? value : "unknown";
  const number = (value) => (Number.isFinite(value) ? value : null);
  const dimension = (value) =>
    /^(?:auto|none|content|min-content|max-content|fit-content|-?\d+(?:\.\d+)?(?:px|%))$/.test(
      value,
    )
      ? value
      : "unknown";
  const tag = (node) =>
    choose(node?.tagName, [
      "DIV",
      "BUTTON",
      "SPAN",
      "SVG",
      "svg",
      "PATH",
      "path",
      "BODY",
      "HTML",
      "A",
      "IMG",
    ]);
  const rect = (node) => {
    if (!node) return null;
    const value = node.getBoundingClientRect();
    return Object.fromEntries(
      ["x", "y", "top", "left", "right", "bottom", "width", "height"].map(
        (key) => [key, number(value[key])],
      ),
    );
  };
  const measure = (node) => {
    if (!node) return null;
    const style = getComputedStyle(node);
    return {
      tag: tag(node),
      rect: rect(node),
      layout: {
        display: choose(style.display, [
          "none",
          "block",
          "inline",
          "inline-block",
          "flex",
          "inline-flex",
          "grid",
          "inline-grid",
          "contents",
        ]),
        position: choose(style.position, [
          "static",
          "relative",
          "absolute",
          "fixed",
          "sticky",
        ]),
        flexDirection: choose(style.flexDirection, [
          "row",
          "row-reverse",
          "column",
          "column-reverse",
        ]),
        flexWrap: choose(style.flexWrap, ["nowrap", "wrap", "wrap-reverse"]),
        flexGrow: number(Number.parseFloat(style.flexGrow)),
        flexShrink: number(Number.parseFloat(style.flexShrink)),
        flexBasis: dimension(style.flexBasis),
        overflowX: choose(style.overflowX, [
          "visible",
          "hidden",
          "clip",
          "auto",
          "scroll",
        ]),
        overflowY: choose(style.overflowY, [
          "visible",
          "hidden",
          "clip",
          "auto",
          "scroll",
        ]),
        pointerEvents: choose(style.pointerEvents, ["auto", "none"]),
        opacity: number(Number.parseFloat(style.opacity)),
        visibility: choose(style.visibility, ["visible", "hidden", "collapse"]),
        height: dimension(style.height),
        minHeight: dimension(style.minHeight),
        maxHeight: dimension(style.maxHeight),
        width: dimension(style.width),
        minWidth: dimension(style.minWidth),
        maxWidth: dimension(style.maxWidth),
        boxSizing: choose(style.boxSizing, ["border-box", "content-box"]),
        transformed: style.transform !== "none" && style.transform !== "",
      },
    };
  };
  const footer = button.closest('[data-testid="user-message-footer"]');
  const container = footer?.parentElement;
  const candidates = [
    ...(container?.querySelectorAll('[data-message-role="user"]') ?? []),
  ].filter(
    (node) =>
      node.dataset.threadItemId === expected.itemId &&
      node.dataset.runtimeTurnId === expected.turnId,
  );
  const bubble = candidates.length === 1 ? candidates[0] : null;
  const group = bubble?.closest('[data-testid="message-turn-group"]');
  const buttonRect = rect(button);
  const center =
    buttonRect && buttonRect.width > 0 && buttonRect.height > 0
      ? {
          x: (buttonRect.left + buttonRect.right) / 2,
          y: (buttonRect.top + buttonRect.bottom) / 2,
        }
      : null;
  const hit = center ? document.elementFromPoint(center.x, center.y) : null;
  const relation = !hit
    ? "none"
    : hit === button
      ? "copy-button"
      : button.contains(hit)
        ? "copy-button-descendant"
        : hit === bubble
          ? "user-bubble"
          : bubble?.contains(hit)
            ? "user-bubble-descendant"
            : hit === footer
              ? "footer"
              : footer?.contains(hit)
                ? "footer-descendant"
                : "other";
  const path = [];
  let current = hit;
  while (current && path.length < 8) {
    path.push({
      tag: tag(current),
      isButton: current === button,
      isBubble: current === bubble,
      isFooter: current === footer,
      insideButton: button.contains(current),
      insideBubble: bubble?.contains(current) === true,
      insideFooter: footer?.contains(current) === true,
      isSpaceStack: current.classList?.contains("space-y-2") === true,
      testId: choose(current.dataset?.testid, [
        "user-message-footer",
        "message-turn-group",
        "collapsible-user-message-content",
        "user-message-content-viewport",
        "user-message-content-full",
        "user-message-content-toggle",
      ]),
    });
    current = current.parentElement;
  }
  return {
    schemaVersion: 1,
    source: "renderer-elementFromPoint",
    bubbleCount: candidates.length,
    identityMatches:
      !!bubble &&
      bubble.dataset.messageId === expected.clientId &&
      footer?.contains(button) === true,
    entryKind: choose(group?.dataset.renderEntryKind, [
      "canonical_turn",
      "message_group",
    ]),
    bubble: measure(bubble),
    footer: measure(footer),
    button: measure(button),
    container: measure(container),
    group: measure(group),
    center: center
      ? {
          ...center,
          insideViewport:
            center.x >= 0 &&
            center.y >= 0 &&
            center.x < window.innerWidth &&
            center.y < window.innerHeight,
        }
      : null,
    hit: {
      relation,
      acceptsButton:
        relation === "copy-button" || relation === "copy-button-descendant",
      path,
      pathTruncated: !!current,
    },
  };
}

export function summarizeCopyActionGeometry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const number = (input) => (Number.isFinite(input) ? input : null);
  const count = (input) =>
    Number.isSafeInteger(input) && input >= 0 ? input : null;
  const choose = (input, choices) =>
    choices.includes(input) ? input : "unknown";
  const dimension = (input) =>
    typeof input === "string" &&
    /^(?:auto|none|content|min-content|max-content|fit-content|-?\d+(?:\.\d+)?(?:px|%))$/.test(
      input,
    )
      ? input
      : "unknown";
  const tag = (input) =>
    choose(input, [
      "DIV",
      "BUTTON",
      "SPAN",
      "SVG",
      "svg",
      "PATH",
      "path",
      "BODY",
      "HTML",
      "A",
      "IMG",
    ]);
  const measure = (input) => {
    if (!input || typeof input !== "object") return null;
    const layout = input.layout ?? {};
    return {
      tag: tag(input.tag),
      rect: input.rect
        ? Object.fromEntries(
            ["x", "y", "top", "left", "right", "bottom", "width", "height"].map(
              (key) => [key, number(input.rect[key])],
            ),
          )
        : null,
      layout: {
        display: choose(layout.display, [
          "none",
          "block",
          "inline",
          "inline-block",
          "flex",
          "inline-flex",
          "grid",
          "inline-grid",
          "contents",
        ]),
        position: choose(layout.position, [
          "static",
          "relative",
          "absolute",
          "fixed",
          "sticky",
        ]),
        flexDirection: choose(layout.flexDirection, [
          "row",
          "row-reverse",
          "column",
          "column-reverse",
        ]),
        flexWrap: choose(layout.flexWrap, ["nowrap", "wrap", "wrap-reverse"]),
        flexGrow: number(layout.flexGrow),
        flexShrink: number(layout.flexShrink),
        flexBasis: dimension(layout.flexBasis),
        overflowX: choose(layout.overflowX, [
          "visible",
          "hidden",
          "clip",
          "auto",
          "scroll",
        ]),
        overflowY: choose(layout.overflowY, [
          "visible",
          "hidden",
          "clip",
          "auto",
          "scroll",
        ]),
        pointerEvents: choose(layout.pointerEvents, ["auto", "none"]),
        opacity: number(layout.opacity),
        visibility: choose(layout.visibility, [
          "visible",
          "hidden",
          "collapse",
        ]),
        height: dimension(layout.height),
        minHeight: dimension(layout.minHeight),
        maxHeight: dimension(layout.maxHeight),
        width: dimension(layout.width),
        minWidth: dimension(layout.minWidth),
        maxWidth: dimension(layout.maxWidth),
        boxSizing: choose(layout.boxSizing, ["border-box", "content-box"]),
        transformed: layout.transformed === true,
      },
    };
  };
  const relation = choose(value.hit?.relation, [
    "none",
    "copy-button",
    "copy-button-descendant",
    "user-bubble",
    "user-bubble-descendant",
    "footer",
    "footer-descendant",
    "other",
  ]);
  return {
    schemaVersion: 1,
    source: "renderer-elementFromPoint",
    unavailable: value.unavailable === true,
    bubbleCount: count(value.bubbleCount),
    identityMatches: value.identityMatches === true,
    entryKind: choose(value.entryKind, ["canonical_turn", "message_group"]),
    ...Object.fromEntries(
      ["bubble", "footer", "button", "container", "group"].map((key) => [
        key,
        measure(value[key]),
      ]),
    ),
    center: value.center
      ? {
          x: number(value.center.x),
          y: number(value.center.y),
          insideViewport: value.center.insideViewport === true,
        }
      : null,
    hit: {
      relation,
      acceptsButton:
        value.hit?.acceptsButton === true &&
        ["copy-button", "copy-button-descendant"].includes(relation),
      path: Array.isArray(value.hit?.path)
        ? value.hit.path.slice(0, 8).map((entry) => ({
            tag: tag(entry?.tag),
            ...Object.fromEntries(
              [
                "isButton",
                "isBubble",
                "isFooter",
                "insideButton",
                "insideBubble",
                "insideFooter",
                "isSpaceStack",
              ].map((key) => [key, entry?.[key] === true]),
            ),
            testId: choose(entry?.testId, [
              "user-message-footer",
              "message-turn-group",
              "collapsible-user-message-content",
              "user-message-content-viewport",
              "user-message-content-full",
              "user-message-content-toggle",
            ]),
          }))
        : [],
      pathTruncated:
        value.hit?.pathTruncated === true || value.hit?.path?.length > 8,
    },
  };
}

export function summarizeCopyActionPreparation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    input: "locator-hover",
    bubbleHoverCompleted: value.bubbleHoverCompleted === true,
    buttonHoverCompleted: value.buttonHoverCompleted === true,
    observations: Object.fromEntries(
      ["beforeHover", "afterBubbleHover", "ready", "failure"].flatMap((key) => {
        const observation = summarizeCopyActionGeometry(
          value.observations?.[key],
        );
        return observation ? [[key, observation]] : [];
      }),
    ),
  };
}

export function summarizeCopyActionPhases(phases, error, stage) {
  let failed;
  try {
    if (error && Object.hasOwn(error, "copyActionGeometryEvidence"))
      failed = error.copyActionGeometryEvidence;
  } catch {}
  const failedPhase = {
    "copy-collapsed": "collapsed",
    "copy-expanded": "expanded",
  }[stage];
  return Object.fromEntries(
    ["collapsed", "expanded"].flatMap((phase) => {
      const value = summarizeCopyActionPreparation(
        phase === failedPhase && failed ? failed : phases?.[phase],
      );
      return value ? [[phase, value]] : [];
    }),
  );
}

export async function prepareCopyAction({
  bubble,
  copyButton,
  expected,
  ensureVisible,
}) {
  const evidence = { observations: {} };
  const capture = async (key) => {
    try {
      evidence.observations[key] = summarizeCopyActionGeometry(
        await copyButton.evaluate(readCopyActionDom, {
          itemId: expected.itemId,
          turnId: expected.turnId,
          clientId: expected.clientId,
        }),
      );
    } catch {
      evidence.observations[key] = summarizeCopyActionGeometry({
        unavailable: true,
      });
    }
  };
  try {
    await capture("beforeHover");
    await bubble.hover();
    evidence.bubbleHoverCompleted = true;
    await capture("afterBubbleHover");
    await ensureVisible(copyButton);
    await copyButton.hover();
    evidence.buttonHoverCompleted = true;
    await capture("ready");
    return summarizeCopyActionPreparation(evidence);
  } catch (error) {
    await capture("failure");
    try {
      Object.defineProperty(error, "copyActionGeometryEvidence", {
        value: summarizeCopyActionPreparation(evidence),
        configurable: true,
      });
    } catch {}
    throw error;
  }
}
