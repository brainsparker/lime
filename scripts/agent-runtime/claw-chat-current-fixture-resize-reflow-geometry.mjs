export function readResizeReflowHeaderGeometry({ label }) {
  const threadHeader = document.querySelector(
    '[data-testid="thread-workspace-header"]',
  );
  const threadHeaderContext = document.querySelector(
    '[data-testid="thread-workspace-header-context"]',
  );
  const threadHeaderTitle = document.querySelector(
    '[data-testid="thread-workspace-header-title"]',
  );
  const threadHeaderStatus = document.querySelector(
    '[data-testid="thread-workspace-header-status"]',
  );
  const threadHeaderActions = document.querySelector(
    '[data-testid="thread-workspace-header-actions"]',
  );
  const taskCenterUtilityToolbar = document.querySelector(
    '[data-testid="task-center-utility-toolbar"]',
  );
  const taskCenterChromeShell = document.querySelector(
    '[data-testid="task-center-chrome-shell"]',
  );
  const taskCenterTabStrip = document.querySelector(
    '[data-testid="task-center-tab-strip"]',
  );
  const taskCenterWorkspaceBar = document.querySelector(
    '[data-testid="task-center-workspace-bar"]',
  );
  const compactModeBar = document.querySelector(
    '[data-testid="layout-compact-mode-bar"]',
  );
  const threadHeaderInfo = visibleInfo(threadHeader);
  const threadHeaderContextInfo = visibleInfo(threadHeaderContext);
  const threadHeaderTitleInfo = visibleInfo(threadHeaderTitle);
  const threadHeaderStatusInfo = visibleInfo(threadHeaderStatus);
  const threadHeaderActionsInfo = visibleInfo(threadHeaderActions);
  const taskCenterUtilityToolbarInfo = visibleInfo(taskCenterUtilityToolbar);
  const taskCenterUtilityToolbarVisualRect = visualBounds(
    taskCenterUtilityToolbar,
  );
  const taskCenterChromeShellInfo = visibleInfo(taskCenterChromeShell);
  const taskCenterTabStripInfo = visibleInfo(taskCenterTabStrip);
  const taskCenterWorkspaceBarInfo = visibleInfo(taskCenterWorkspaceBar);
  const compactModeBarInfo = visibleInfo(compactModeBar);
  const compactModeBarVisualRect = visualBounds(compactModeBar);
  const headerContextRect = threadHeaderContextInfo.rect;
  const headerActionsRect = taskCenterUtilityToolbarVisualRect;
  const noHeaderContextActionsOverlap = Boolean(
    headerContextRect &&
    headerActionsRect &&
    !rectsOverlap(headerContextRect, headerActionsRect),
  );
  const headerChildrenContained = Boolean(
    threadHeaderInfo.rect &&
    headerContextRect &&
    headerActionsRect &&
    rectContains(threadHeaderInfo.rect, headerContextRect, 1) &&
    rectContains(threadHeaderInfo.rect, headerActionsRect, 1) &&
    verticalContains(threadHeaderInfo.rect, threadHeaderActionsInfo.rect, 1) &&
    verticalContains(
      threadHeaderInfo.rect,
      taskCenterUtilityToolbarInfo.rect,
      1,
    ),
  );
  const compactModeBarExpectedVisible = label === "compact";
  const noHeaderCompactModeBarOverlap = Boolean(
    threadHeaderInfo.rect &&
    (!compactModeBarInfo.visible ||
      (compactModeBarVisualRect &&
        !rectsOverlap(threadHeaderInfo.rect, compactModeBarVisualRect))),
  );
  const compactModeBarPositionStable = compactModeBarExpectedVisible
    ? Boolean(
        compactModeBarInfo.visible &&
        compactModeBarVisualRect &&
        threadHeaderInfo.rect &&
        compactModeBarVisualRect.top >= threadHeaderInfo.rect.bottom - 1 &&
        compactModeBarVisualRect.left >= threadHeaderInfo.rect.left - 1 &&
        compactModeBarVisualRect.right <= threadHeaderInfo.rect.right + 1,
      )
    : compactModeBarInfo.visible === false;
  const activeThreadHeaderStable =
    threadHeaderInfo.visible === true &&
    threadHeaderTitleInfo.visible === true &&
    threadHeaderContextInfo.visible === true &&
    threadHeaderActionsInfo.visible === true &&
    taskCenterUtilityToolbarInfo.visible === true &&
    taskCenterChromeShellInfo.visible === false &&
    taskCenterTabStripInfo.visible === false &&
    taskCenterWorkspaceBarInfo.visible === false &&
    noHeaderContextActionsOverlap &&
    headerChildrenContained &&
    noHeaderCompactModeBarOverlap &&
    compactModeBarPositionStable;

  return {
    stable: activeThreadHeaderStable,
    header: threadHeaderInfo,
    context: threadHeaderContextInfo,
    title: threadHeaderTitleInfo,
    status: threadHeaderStatusInfo,
    actions: threadHeaderActionsInfo,
    toolbar: {
      ...taskCenterUtilityToolbarInfo,
      visualRect: taskCenterUtilityToolbarVisualRect,
    },
    taskCenterChromeShell: taskCenterChromeShellInfo,
    taskCenterTabStrip: taskCenterTabStripInfo,
    taskCenterWorkspaceBar: taskCenterWorkspaceBarInfo,
    compactModeBar: {
      ...compactModeBarInfo,
      visualRect: compactModeBarVisualRect,
      expectedVisible: compactModeBarExpectedVisible,
      positionStable: compactModeBarPositionStable,
    },
    noContextActionsOverlap: noHeaderContextActionsOverlap,
    childrenContained: headerChildrenContained,
    noCompactModeBarOverlap: noHeaderCompactModeBarOverlap,
  };
  function visibleInfo(node) {
    const rect = safeRect(node);
    const paint = paintRect(node);
    return {
      exists: Boolean(node),
      visible: Boolean(
        rect &&
        rect.width > 8 &&
        rect.height > 8 &&
        paint &&
        paint.width > 0 &&
        paint.height > 0,
      ),
      rect: rect ? rectToJson(rect) : null,
    };
  }

  function visualBounds(node) {
    if (!node) {
      return null;
    }
    const visibleRects = [node, ...node.querySelectorAll("*")]
      .map(paintRect)
      .filter(Boolean);
    const bounds = visibleRects.reduce(
      (bounds, rect) => unionRects(bounds, rect),
      null,
    );
    return bounds ? rectToJson(bounds) : null;
  }

  function safeRect(node) {
    const rect = node?.getBoundingClientRect();
    if (
      !rect ||
      !["x", "y", "width", "height", "top", "left", "right", "bottom"].every(
        (key) => typeof rect[key] === "number" && Number.isFinite(rect[key]),
      ) ||
      rect.width < 0 ||
      rect.height < 0 ||
      rect.right < rect.left ||
      rect.bottom < rect.top
    )
      return null;
    return rect;
  }

  function paintRect(element) {
    const source = safeRect(element);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (
      !source ||
      source.width <= 0 ||
      source.height <= 0 ||
      !Number.isFinite(viewportWidth) ||
      !Number.isFinite(viewportHeight) ||
      viewportWidth <= 0 ||
      viewportHeight <= 0
    )
      return null;
    let left = Math.max(0, source.left);
    let top = Math.max(0, source.top);
    let right = Math.min(viewportWidth, source.right);
    let bottom = Math.min(viewportHeight, source.bottom);
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const style = window.getComputedStyle(ancestor);
      if (
        style.display === "none" ||
        ["hidden", "collapse"].includes(style.visibility) ||
        !(Number(style.opacity || "1") > 0)
      )
        return null;
      if (ancestor === element) continue;
      const clips = (value) =>
        ["auto", "scroll", "hidden", "clip", "overlay"].includes(value);
      const clipsX = clips(style.overflowX || style.overflow);
      const clipsY = clips(style.overflowY || style.overflow);
      if (!clipsX && !clipsY) continue;
      const bounds = safeRect(ancestor);
      if (!bounds) return null;
      if (clipsX) {
        const offset = ancestor.clientLeft;
        const size = ancestor.clientWidth;
        if (!Number.isFinite(offset) || !Number.isFinite(size) || size <= 0)
          return null;
        left = Math.max(left, bounds.left + offset);
        right = Math.min(right, bounds.left + offset + size);
      }
      if (clipsY) {
        const offset = ancestor.clientTop;
        const size = ancestor.clientHeight;
        if (!Number.isFinite(offset) || !Number.isFinite(size) || size <= 0)
          return null;
        top = Math.max(top, bounds.top + offset);
        bottom = Math.min(bottom, bounds.top + offset + size);
      }
    }
    if (right <= left || bottom <= top) return null;
    return {
      x: left,
      y: top,
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  function verticalContains(outer, inner, tolerance) {
    return Boolean(
      inner &&
      inner.top >= outer.top - tolerance &&
      inner.bottom <= outer.bottom + tolerance,
    );
  }

  function unionRects(left, right) {
    if (!left) return right;
    if (!right) return left;
    const top = Math.min(left.top, right.top);
    const leftEdge = Math.min(left.left, right.left);
    const rightEdge = Math.max(left.right, right.right);
    const bottom = Math.max(left.bottom, right.bottom);
    return {
      x: leftEdge,
      y: top,
      width: rightEdge - leftEdge,
      height: bottom - top,
      top,
      left: leftEdge,
      right: rightEdge,
      bottom,
    };
  }

  function rectsOverlap(left, right) {
    return !(
      left.right <= right.left ||
      right.right <= left.left ||
      left.bottom <= right.top ||
      right.bottom <= left.top
    );
  }

  function rectContains(outer, inner, tolerance = 0) {
    return (
      inner.left >= outer.left - tolerance &&
      inner.top >= outer.top - tolerance &&
      inner.right <= outer.right + tolerance &&
      inner.bottom <= outer.bottom + tolerance
    );
  }

  function rectToJson(rect) {
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
    };
  }
}
