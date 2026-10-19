import { useEffect, useRef } from "react";
import { ConversationListMoreButton } from "./AppSidebarConversationShelf.styles";

interface AppSidebarLoadMoreProps {
  itemCount: number;
  label: string;
  onLoadMore: () => void;
  mode: "button" | "infiniteScroll";
}

export function AppSidebarLoadMore({
  itemCount,
  label,
  onLoadMore,
  mode,
}: AppSidebarLoadMoreProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinelRef.current;
    if (mode !== "infiniteScroll" || !target) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      onLoadMore();
      return;
    }
    let requested = false;
    const observer = new IntersectionObserver((entries) => {
      if (!requested && entries.some((entry) => entry.isIntersecting)) {
        requested = true;
        observer.disconnect();
        onLoadMore();
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [itemCount, mode, onLoadMore]);

  if (mode === "infiniteScroll") {
    return (
      <div
        ref={sentinelRef}
        className="min-h-px w-full"
        data-testid="app-sidebar-pagination-sentinel"
      />
    );
  }

  return (
    <ConversationListMoreButton
      type="button"
      onClick={onLoadMore}
      data-testid="app-sidebar-load-more"
    >
      {label}
    </ConversationListMoreButton>
  );
}
