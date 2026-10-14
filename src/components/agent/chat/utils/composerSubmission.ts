import type {
  ComposerSubmission,
  ComposerTextElement,
} from "@/components/input-kit/types";

const encoder = new TextEncoder();

function utf8Boundaries(text: string): Set<number> {
  const boundaries = new Set([0]);
  let offset = 0;
  for (const character of text) {
    offset += encoder.encode(character).length;
    boundaries.add(offset);
  }
  return boundaries;
}

function validateTextElements(
  text: string,
  elements: readonly ComposerTextElement[],
): void {
  const boundaries = utf8Boundaries(text);
  let previousEnd = 0;
  for (const { byteRange } of elements) {
    if (
      !byteRange ||
      !Number.isInteger(byteRange.start) ||
      !Number.isInteger(byteRange.end) ||
      byteRange.start < previousEnd ||
      byteRange.end < byteRange.start ||
      !boundaries.has(byteRange.start) ||
      !boundaries.has(byteRange.end)
    ) {
      throw new Error("Invalid Composer UTF8 text element range");
    }
    previousEnd = byteRange.end;
  }
}

/** 只有正文变换存在唯一、完整的映射时才保留原子范围。 */
export function remapComposerSubmission(
  submission: ComposerSubmission,
  text: string,
): ComposerSubmission {
  validateTextElements(submission.text, submission.textElements);
  const result = structuredClone(submission);
  result.text = text;
  if (text === submission.text || submission.textElements.length === 0) {
    return result;
  }

  let retainedText = submission.text;
  let removedPrefixBytes = 0;
  let index = text.indexOf(retainedText);
  if (index < 0) {
    retainedText = submission.text.trim();
    removedPrefixBytes = encoder.encode(
      submission.text.slice(
        0,
        submission.text.length - submission.text.trimStart().length,
      ),
    ).length;
    index = retainedText ? text.indexOf(retainedText) : -1;
  }
  if (index < 0 || text.indexOf(retainedText, index + 1) >= 0) {
    throw new Error(
      "Cannot map Composer text elements through this text transformation",
    );
  }

  const retainedEnd = removedPrefixBytes + encoder.encode(retainedText).length;
  const prefixBytes = encoder.encode(text.slice(0, index)).length;
  result.textElements = submission.textElements.map((element) => {
    if (
      element.byteRange.start < removedPrefixBytes ||
      element.byteRange.end > retainedEnd
    ) {
      throw new Error("Text transformation removes a Composer text element");
    }
    return {
      ...element,
      byteRange: {
        start: element.byteRange.start - removedPrefixBytes + prefixBytes,
        end: element.byteRange.end - removedPrefixBytes + prefixBytes,
      },
    };
  });
  validateTextElements(text, result.textElements);
  return result;
}
