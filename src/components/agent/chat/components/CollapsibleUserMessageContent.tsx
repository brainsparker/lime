import React, {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

export interface CollapsibleUserMessageContentProps {
  children: React.ReactNode;
  /** 仅触发正文重测；完整内容与消息身份仍由调用方持有。 */
  content: string;
  collapsedLineCount?: number;
  /** 手动切换前由现有列表 owner 暂停跟随尾部。 */
  onBeforeToggle?: () => void;
  /** 仅传入匹配正文的请求；同一组件实例中使用递增的正整数。 */
  revealRequestKey?: number | null;
}

interface ContentMeasurement {
  fullHeight: number;
  lineHeight: number;
  collapsedHeight: number;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[tabindex]",
  '[contenteditable]:not([contenteditable="false"])',
].join(",");

function sameMeasurement(
  previous: ContentMeasurement | null,
  next: ContentMeasurement | null,
): boolean {
  return (
    previous === next ||
    (previous !== null &&
      next !== null &&
      previous.fullHeight === next.fullHeight &&
      previous.lineHeight === next.lineHeight &&
      previous.collapsedHeight === next.collapsedHeight)
  );
}

export function CollapsibleUserMessageContent({
  children,
  content,
  collapsedLineCount = 20,
  onBeforeToggle,
  revealRequestKey,
}: CollapsibleUserMessageContentProps) {
  const { t } = useTranslation("agent");
  const viewportId = `user-message-content-${useId()}`;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fullContentRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const [measurement, setMeasurement] = useState<ContentMeasurement | null>(
    null,
  );
  const measurementRef = useRef<ContentMeasurement | null>(null);
  const [userExpanded, setUserExpanded] = useState<boolean | undefined>();
  const lastRevealRequestRef = useRef(0);
  const managedInertRef = useRef(new Map<HTMLElement, string | null>());

  const isLong = Boolean(
    measurement && measurement.fullHeight > measurement.collapsedHeight + 1,
  );
  const isExpanded = isLong && userExpanded === true;
  const isCollapsed = isLong && !isExpanded;
  const collapsedRef = useRef(isCollapsed);
  useLayoutEffect(() => {
    collapsedRef.current = isCollapsed;
  }, [isCollapsed]);
  const state = !measurement
    ? "unmeasured"
    : !isLong
      ? "short"
      : isExpanded
        ? "expanded"
        : "collapsed";

  const restoreInteractions = useCallback(() => {
    for (const [element, original] of managedInertRef.current) {
      if (original === null) element.removeAttribute("inert");
      else element.setAttribute("inert", original);
    }
    managedInertRef.current.clear();
  }, []);

  const updateInteractions = useCallback(() => {
    // 每次重测先恢复，再按当前几何重新判定，允许 resize 后的链接重新可达。
    restoreInteractions();
    if (!collapsedRef.current) return;
    const viewport = viewportRef.current;
    const fullContent = fullContentRef.current;
    if (!viewport || !fullContent) return;
    const clip = viewport.getBoundingClientRect();
    if (clip.width <= 0 || clip.height <= 0) return;

    for (const element of fullContent.querySelectorAll<HTMLElement>(
      INTERACTIVE_SELECTOR,
    )) {
      const rectangles = Array.from(element.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );
      // display:none 等既有不可见状态不由本组件改写。
      if (rectangles.length === 0) continue;
      const isFullyVisible = rectangles.every(
        (rect) =>
          rect.top >= clip.top &&
          rect.bottom <= clip.bottom &&
          rect.left >= clip.left &&
          rect.right <= clip.right,
      );
      if (isFullyVisible) continue;

      const focused = element.ownerDocument.activeElement;
      if (focused && (element === focused || element.contains(focused))) {
        toggleRef.current?.focus({ preventScroll: true });
      }
      managedInertRef.current.set(element, element.getAttribute("inert"));
      element.setAttribute("inert", "");
    }
  }, [restoreInteractions]);

  const measure = useCallback(() => {
    const fullContent = fullContentRef.current;
    if (!fullContent) return;
    const rect = fullContent.getBoundingClientRect();
    const computedLineHeight = window.getComputedStyle(fullContent).lineHeight;
    // 浏览器的有效 computed lineHeight 应为像素；normal 或无布局时展示全文。
    const lineHeight = computedLineHeight.endsWith("px")
      ? Number.parseFloat(computedLineHeight)
      : Number.NaN;
    const collapsedHeight = collapsedLineCount * lineHeight;
    const valid =
      Number.isFinite(lineHeight) &&
      lineHeight > 0 &&
      Number.isFinite(collapsedLineCount) &&
      collapsedLineCount > 0 &&
      Number.isFinite(collapsedHeight) &&
      Number.isFinite(rect.height) &&
      rect.height > 0 &&
      Number.isFinite(rect.width) &&
      rect.width > 0;
    const next = valid
      ? { fullHeight: rect.height, lineHeight, collapsedHeight }
      : null;
    // commit 中的同值 updater 仍可能入队；几何未变化时不触发 React 更新。
    if (!sameMeasurement(measurementRef.current, next)) {
      measurementRef.current = next;
      setMeasurement(next);
    }
    // RO 也可能只改变宽度或互动位置，此时没有新的 measurement state。
    updateInteractions();
  }, [collapsedLineCount, updateInteractions]);

  useLayoutEffect(() => {
    if (
      revealRequestKey == null ||
      !Number.isSafeInteger(revealRequestKey) ||
      revealRequestKey <= lastRevealRequestRef.current
    ) {
      return;
    }
    lastRevealRequestRef.current = revealRequestKey;
    setUserExpanded(true);
  }, [revealRequestKey]);

  useLayoutEffect(() => {
    measure();
    // 列表 renderEntry 会不断创建新的 JSX；实际子树变化由下面的 MO/RO 重测。
  }, [content, measure]);

  useLayoutEffect(() => {
    const fullContent = fullContentRef.current;
    if (!fullContent) return;
    let active = true;
    const onContentChange = () => {
      if (active) measure();
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(onContentChange);
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(onContentChange);
    // 观察保留自然高度的完整内容，不观察受 maxHeight 限制的 viewport。
    resizeObserver?.observe(fullContent);
    // Markdown 异步替换互动节点可能不改变高度；不观察本组件写入的 inert 属性。
    mutationObserver?.observe(fullContent, { childList: true, subtree: true });
    return () => {
      active = false;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [measure]);

  useLayoutEffect(() => {
    updateInteractions();
  }, [measurement, isCollapsed, content, children, updateInteractions]);

  useLayoutEffect(() => restoreInteractions, [restoreInteractions]);

  const toggle = () => {
    onBeforeToggle?.();
    setUserExpanded((current) => current !== true);
  };

  return (
    <div
      data-testid="collapsible-user-message-content"
      data-user-message-content-state={state}
      style={{ minWidth: 0 }}
    >
      <div
        ref={viewportRef}
        id={viewportId}
        data-testid="user-message-content-viewport"
        style={{
          maxHeight: isCollapsed ? measurement?.collapsedHeight : undefined,
          overflow: isCollapsed ? "hidden" : undefined,
        }}
      >
        <div
          ref={fullContentRef}
          data-testid="user-message-content-full"
          style={{ display: "flow-root" }}
        >
          {children}
        </div>
      </div>
      {isLong ? (
        <button
          ref={toggleRef}
          type="button"
          data-testid="user-message-content-toggle"
          aria-controls={viewportId}
          aria-expanded={isExpanded}
          className="mt-2 rounded text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={toggle}
        >
          {t(
            isExpanded
              ? "agentChat.messageList.userMessage.showLess"
              : "agentChat.messageList.userMessage.showMore",
          )}
        </button>
      ) : null}
    </div>
  );
}
