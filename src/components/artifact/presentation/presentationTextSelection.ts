import { a, children } from "./presentationPackageXml";
import {
  createPresentationTextRangeAdapter,
  type PresentationTextPosition,
} from "./presentationTextRange";
import {
  presentationTextContent,
  runText,
  textRuns,
} from "./presentationTextRangeXml";

export interface PresentationTextRunSelection {
  paraIndex: number;
  runIndex: number;
  start: number;
  end: number;
}

export interface PresentationTextSelection {
  anchor: PresentationTextPosition;
  caret: PresentationTextPosition;
  selection: readonly PresentationTextRunSelection[];
  selectedPlainText: string;
}

/** 保留 anchor/caret 方向；相交区间使用源 run 的 UTF-16 坐标。 */
export function presentationTextSelection(
  body: Element,
  blockId: string,
  anchor: PresentationTextPosition,
  caret: PresentationTextPosition,
): PresentationTextSelection {
  const adapter = createPresentationTextRangeAdapter(body, blockId),
    anchorOffset = adapter.offsetAtPosition(anchor),
    caretOffset = adapter.offsetAtPosition(caret),
    start = Math.min(anchorOffset, caretOffset),
    end = Math.max(anchorOffset, caretOffset),
    selection: PresentationTextRunSelection[] = [];
  let offset = 0;
  for (const [paraIndex, paragraph] of children(body, a, "p").entries()) {
    for (const [runIndex, run] of textRuns(paragraph).entries()) {
      const length = runText(run).length,
        from = Math.max(0, start - offset),
        to = Math.min(length, end - offset);
      if (from < to)
        selection.push({ paraIndex, runIndex, start: from, end: to });
      offset += length;
    }
    offset++;
  }
  return {
    anchor: { ...anchor },
    caret: { ...caret },
    selection,
    selectedPlainText: presentationTextContent(body).slice(start, end),
  };
}
