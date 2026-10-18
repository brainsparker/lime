import { a, children, create, fail, one } from "./presentationPackageXml";
import {
  cloneElement,
  paragraphText,
  paragraphWithRuns,
  runText,
  textRun,
  textRuns,
  validateTextBody,
  validateTextInput,
  validTextBoundary,
} from "./presentationTextRangeXml";

export interface PresentationTextPosition {
  blockId: string;
  paraIndex: number;
  runIndex: number;
  /** UTF-16 code units，与 DOM Range 一致；不可落在 surrogate pair 中间。 */
  charIndex: number;
}

/** 原包内的 OOXML 片段；关系 ID 沿用源 part，不负责跨包 relationship 搬运。 */
export interface PresentationTextFragment {
  paragraphs: readonly Element[];
}

interface Boundary {
  position: PresentationTextPosition;
  paragraph: Element;
  runs: Element[];
  offset: number;
  paragraphOffset: number;
}

export interface PresentationTextRangeAdapter {
  getRangeFragment(
    start: PresentationTextPosition,
    end: PresentationTextPosition,
  ): PresentationTextFragment;
  replaceRangeWithFragment(
    start: PresentationTextPosition,
    end: PresentationTextPosition,
    fragment: PresentationTextFragment,
  ): PresentationTextPosition;
  replaceRange(
    start: PresentationTextPosition,
    end: PresentationTextPosition,
    text: string,
  ): PresentationTextPosition;
  insertText(
    caret: PresentationTextPosition,
    text: string,
  ): PresentationTextPosition;
  splitParagraph(caret: PresentationTextPosition): PresentationTextPosition;
  positionAtOffset(offset: number): PresentationTextPosition;
  offsetAtPosition(position: PresentationTextPosition): number;
}

/** shape 与 table cell 共用同一个 DrawingML text body owner。 */
export function createPresentationTextRangeAdapter(
  body: Element,
  blockId: string,
): PresentationTextRangeAdapter {
  if (typeof blockId !== "string" || !blockId) fail("text block identity");

  function paragraphs(): Element[] {
    validateTextBody(body);
    const items = children(body, a, "p");
    return items.length ? items : [create(body, a, "p")];
  }

  function boundary(
    position: PresentationTextPosition,
    items = paragraphs(),
  ): Boundary {
    if (
      !position ||
      position.blockId !== blockId ||
      !Number.isSafeInteger(position.paraIndex) ||
      position.paraIndex < 0 ||
      position.paraIndex >= items.length
    )
      fail("text position");
    const paragraph = items[position.paraIndex],
      runs = textRuns(paragraph);
    if (
      !Number.isSafeInteger(position.runIndex) ||
      position.runIndex < 0 ||
      position.runIndex >= Math.max(1, runs.length) ||
      !validTextBoundary(
        runs[position.runIndex] ? runText(runs[position.runIndex]) : "",
        position.charIndex,
      )
    )
      fail("text position or Unicode boundary");
    const paragraphOffset =
      runs
        .slice(0, position.runIndex)
        .reduce((sum, run) => sum + runText(run).length, 0) +
      position.charIndex;
    const offset =
      items
        .slice(0, position.paraIndex)
        .reduce((sum, item) => sum + paragraphText(item).length + 1, 0) +
      paragraphOffset;
    return { position, paragraph, runs, offset, paragraphOffset };
  }

  function range(
    start: PresentationTextPosition,
    end: PresentationTextPosition,
  ) {
    const items = paragraphs(),
      left = boundary(start, items),
      right = boundary(end, items);
    const ordered =
      start.paraIndex - end.paraIndex ||
      start.runIndex - end.runIndex ||
      start.charIndex - end.charIndex;
    return {
      items,
      start: ordered <= 0 ? left : right,
      end: ordered <= 0 ? right : left,
    };
  }

  function positionInParagraph(
    paragraph: Element,
    paraIndex: number,
    offset: number,
  ): PresentationTextPosition {
    const runs = textRuns(paragraph);
    for (let index = 0; index < runs.length; index++) {
      const value = runText(runs[index]);
      if (offset <= value.length) {
        if (!validTextBoundary(value, offset)) fail("text Unicode boundary");
        return { blockId, paraIndex, runIndex: index, charIndex: offset };
      }
      offset -= value.length;
    }
    if (!runs.length && offset === 0)
      return { blockId, paraIndex, runIndex: 0, charIndex: 0 };
    return fail("text offset");
  }

  function positionAtOffset(offset: number): PresentationTextPosition {
    if (!Number.isSafeInteger(offset) || offset < 0) fail("text offset");
    const items = paragraphs();
    for (let index = 0; index < items.length; index++) {
      const length = paragraphText(items[index]).length;
      if (offset <= length)
        return positionInParagraph(items[index], index, offset);
      offset -= length + 1;
    }
    return fail("text offset");
  }

  function sliceRuns(
    paragraph: Element,
    fromRun: number,
    fromChar: number,
    toRun: number,
    toChar: number,
  ): Element[] {
    const result: Element[] = [];
    const runs = textRuns(paragraph);
    for (let index = fromRun; index <= toRun; index++) {
      const run = runs[index];
      if (!run) continue;
      const value = runText(run),
        start = index === fromRun ? fromChar : 0,
        end = index === toRun ? toChar : value.length;
      if (start < end || value.length === 0)
        result.push(
          start === 0 && end === value.length
            ? cloneElement(run)
            : textRun(body, value.slice(start, end), run),
        );
    }
    return result;
  }

  function getRangeFragment(
    left: PresentationTextPosition,
    right: PresentationTextPosition,
  ): PresentationTextFragment {
    const { items, start, end } = range(left, right),
      result: Element[] = [];
    for (
      let index = start.position.paraIndex;
      index <= end.position.paraIndex;
      index++
    ) {
      const paragraph = items[index],
        runsInParagraph = textRuns(paragraph),
        first = index === start.position.paraIndex,
        last = index === end.position.paraIndex;
      const runs = sliceRuns(
        paragraph,
        first ? start.position.runIndex : 0,
        first ? start.position.charIndex : 0,
        last ? end.position.runIndex : runsInParagraph.length - 1,
        last
          ? end.position.charIndex
          : runText(runsInParagraph.at(-1) ?? textRun(body, "")).length,
      );
      if (!runs.length)
        runs.push(
          textRun(
            body,
            "",
            index === start.position.paraIndex
              ? start.runs[start.position.runIndex]
              : textRuns(paragraph)[0],
          ),
        );
      result.push(paragraphWithRuns(paragraph, runs));
    }
    return { paragraphs: result };
  }

  function validateFragment(fragment: PresentationTextFragment): Element[] {
    if (
      !fragment ||
      !Array.isArray(fragment.paragraphs) ||
      fragment.paragraphs.length > 10000
    )
      fail("text fragment");
    const wrapper = create(body, a, "txBody");
    wrapper.append(create(body, a, "bodyPr"));
    for (const paragraph of fragment.paragraphs) {
      if (
        !paragraph ||
        paragraph.namespaceURI !== a ||
        paragraph.localName !== "p"
      )
        fail("text fragment paragraph");
      wrapper.append(cloneElement(paragraph));
    }
    validateTextBody(wrapper);
    validateTextInput(children(wrapper, a, "p").map(paragraphText).join("\n"));
    return children(wrapper, a, "p");
  }

  function replaceRangeWithFragment(
    left: PresentationTextPosition,
    right: PresentationTextPosition,
    fragment: PresentationTextFragment,
  ): PresentationTextPosition {
    const { items, start, end } = range(left, right),
      incoming = validateFragment(fragment);
    const originalText = items.map(paragraphText).join("\n"),
      incomingText = incoming.map(paragraphText).join("\n");
    validateTextInput(
      originalText.slice(0, start.offset) +
        incomingText +
        originalText.slice(end.offset),
    );
    const startRun = start.runs[start.position.runIndex],
      endRun = end.runs[end.position.runIndex];
    const prefix = start.runs
        .slice(0, start.position.runIndex)
        .map(cloneElement),
      suffix = end.runs.slice(end.position.runIndex + 1).map(cloneElement);
    if (startRun && start.position.charIndex > 0)
      prefix.push(
        start.position.charIndex === runText(startRun).length
          ? cloneElement(startRun)
          : textRun(
              body,
              runText(startRun).slice(0, start.position.charIndex),
              startRun,
            ),
      );
    if (endRun && end.position.charIndex < runText(endRun).length)
      suffix.unshift(
        end.position.charIndex === 0
          ? cloneElement(endRun)
          : textRun(
              body,
              runText(endRun).slice(end.position.charIndex),
              endRun,
            ),
      );
    const content = incoming.length
        ? incoming
        : [paragraphWithRuns(start.paragraph, [])],
      replacement: Element[] = [];
    let caretOffset = 0;
    for (let index = 0; index < content.length; index++) {
      const first = index === 0,
        last = index === content.length - 1,
        paragraph = content[index];
      let source = paragraph;
      if (first && start.paragraphOffset > 0) source = start.paragraph;
      if (
        last &&
        end.paragraphOffset < paragraphText(end.paragraph).length &&
        (!first || start.paragraphOffset === 0)
      )
        source = end.paragraph;
      const inserted = textRuns(paragraph).map(cloneElement);
      const runs = [
        ...(first ? prefix : []),
        ...inserted,
        ...(last ? suffix : []),
      ];
      if (last)
        caretOffset =
          (first ? start.paragraphOffset : 0) + paragraphText(paragraph).length;
      const nonempty = runs.filter((run) => runText(run).length > 0);
      const retained = nonempty.length
        ? runs.filter(
            (run) => runText(run).length > 0 || !inserted.includes(run),
          )
        : [
            inserted[0] ??
              prefix.at(-1) ??
              suffix[0] ??
              textRun(body, "", start.runs[start.position.runIndex]),
          ];
      replacement.push(paragraphWithRuns(source, retained));
    }
    const caret = positionInParagraph(
      replacement[replacement.length - 1],
      start.position.paraIndex + replacement.length - 1,
      caretOffset,
    );
    // 所有输入及分片已验证；只在完成离线构建后替换受影响的段落。
    const original = children(body, a, "p"),
      before = original[start.position.paraIndex] ?? null;
    for (const paragraph of replacement) body.insertBefore(paragraph, before);
    for (
      let index = start.position.paraIndex;
      index <= end.position.paraIndex;
      index++
    )
      original[index]?.remove();
    return caret;
  }

  function replaceRange(
    left: PresentationTextPosition,
    right: PresentationTextPosition,
    value: string,
  ): PresentationTextPosition {
    const text = validateTextInput(value),
      { items, start, end } = range(left, right);
    const original = items.map(paragraphText).join("\n");
    validateTextInput(
      original.slice(0, start.offset) + text + original.slice(end.offset),
    );
    if (!text && start.offset === end.offset) return { ...start.position };
    const run = start.runs[start.position.runIndex];
    if (
      run?.localName === "r" &&
      start.position.paraIndex === end.position.paraIndex &&
      start.position.runIndex === end.position.runIndex &&
      !text.includes("\n")
    ) {
      const value = runText(run),
        replacement =
          value.slice(0, start.position.charIndex) +
          text +
          value.slice(end.position.charIndex);
      const target = one(run, a, "t")!;
      target.setAttributeNS(
        "http://www.w3.org/XML/1998/namespace",
        "xml:space",
        "preserve",
      );
      target.textContent = replacement;
      return {
        ...start.position,
        charIndex: start.position.charIndex + text.length,
      };
    }
    const fragment = {
      paragraphs: text
        .split("\n")
        .map((line) =>
          paragraphWithRuns(start.paragraph, [textRun(body, line, run)]),
        ),
    };
    return replaceRangeWithFragment(start.position, end.position, fragment);
  }

  return {
    getRangeFragment,
    replaceRangeWithFragment,
    replaceRange,
    insertText: (caret, text) => replaceRange(caret, caret, text),
    splitParagraph: (caret) => replaceRange(caret, caret, "\n"),
    positionAtOffset,
    offsetAtPosition: (position) => boundary(position).offset,
  };
}
