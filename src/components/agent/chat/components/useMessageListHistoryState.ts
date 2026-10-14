import { useEffect, useState } from "react";
import { scheduleMinimumDelayIdleTask } from "@/lib/utils/scheduleMinimumDelayIdleTask";

/** Data availability and hydration are independent of the DOM viewport. */
export function useMessageListHistoryState(
  isRestoringSession: boolean,
  hasMore: boolean,
) {
  const isRestoredHistoryWindow = isRestoringSession || hasMore;
  const [restoredPromptCacheNoticeReady, setReady] = useState(
    !isRestoredHistoryWindow,
  );
  useEffect(() => {
    if (!isRestoredHistoryWindow) {
      setReady(true);
      return;
    }
    setReady(false);
    return scheduleMinimumDelayIdleTask(() => setReady(true), {
      minimumDelayMs: 1500,
      idleTimeoutMs: 3000,
    });
  }, [isRestoredHistoryWindow]);
  return {
    hasPersistedOlderHistory: hasMore,
    isRestoredHistoryWindow,
    restoredPromptCacheNoticeReady,
  };
}
