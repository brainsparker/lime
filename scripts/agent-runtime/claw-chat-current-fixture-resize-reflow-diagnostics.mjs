function boolean(value) {
  return typeof value === "boolean" ? value : null;
}

function expectedBoolean(value, expected) {
  return typeof value === "boolean" ? value === expected : null;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rect(value) {
  if (value == null) return null;
  return Object.fromEntries(
    ["x", "y", "width", "height", "top", "left", "right", "bottom"].map(
      (key) => [key, finiteNumber(value[key])],
    ),
  );
}

function nodeGeometry(node) {
  return {
    exists: boolean(node?.exists),
    visible: boolean(node?.visible),
    rect: rect(node?.rect),
  };
}

export function formatResizeReflowFailure(label, snapshot) {
  const safeLabel = ["wide", "compact", "restored"].includes(label)
    ? label
    : "unknown";
  const header = snapshot?.activeThreadHeader;
  const headerChecks = {
    headerVisible: expectedBoolean(header?.header?.visible, true),
    titleVisible: expectedBoolean(header?.title?.visible, true),
    contextVisible: expectedBoolean(header?.context?.visible, true),
    actionsVisible: expectedBoolean(header?.actions?.visible, true),
    toolbarVisible: expectedBoolean(header?.toolbar?.visible, true),
    taskCenterChromeShellHidden: expectedBoolean(
      header?.taskCenterChromeShell?.visible,
      false,
    ),
    taskCenterTabStripHidden: expectedBoolean(
      header?.taskCenterTabStrip?.visible,
      false,
    ),
    taskCenterWorkspaceBarHidden: expectedBoolean(
      header?.taskCenterWorkspaceBar?.visible,
      false,
    ),
    noContextActionsOverlap: boolean(header?.noContextActionsOverlap),
    childrenContained: boolean(header?.childrenContained),
    noCompactModeBarOverlap: boolean(header?.noCompactModeBarOverlap),
    compactModeBarPositionStable: boolean(
      header?.compactModeBar?.positionStable,
    ),
  };
  const failedHeaderChecks = Object.keys(headerChecks).filter(
    (key) => headerChecks[key] !== true,
  );
  const headerStable = {
    snapshot: boolean(snapshot?.activeThreadHeaderStable),
    header: boolean(header?.stable),
  };
  const headerGeometry = {
    viewport: {
      width: finiteNumber(snapshot?.viewport?.width),
      height: finiteNumber(snapshot?.viewport?.height),
    },
    header: nodeGeometry(header?.header),
    context: nodeGeometry(header?.context),
    title: nodeGeometry(header?.title),
    status: nodeGeometry(header?.status),
    actions: nodeGeometry(header?.actions),
    toolbar: {
      ...nodeGeometry(header?.toolbar),
      visualRect: rect(header?.toolbar?.visualRect),
    },
    compactModeBar: {
      ...nodeGeometry(header?.compactModeBar),
      visualRect: rect(header?.compactModeBar?.visualRect),
      expectedVisible: boolean(header?.compactModeBar?.expectedVisible),
      positionStable: boolean(header?.compactModeBar?.positionStable),
    },
  };

  return (
    `Electron resize/reflow snapshot 未稳定: ${safeLabel}; ` +
    `failedHeaderChecks=${JSON.stringify(failedHeaderChecks)}; ` +
    `headerChecks=${JSON.stringify(headerChecks)}; ` +
    `headerStable=${JSON.stringify(headerStable)}; ` +
    `headerGeometry=${JSON.stringify(headerGeometry)}`
  );
}
