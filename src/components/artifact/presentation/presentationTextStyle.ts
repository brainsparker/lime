import { a, children, create, fail, one } from "./presentationPackageXml";
import {
  applyTextStyle,
  replaceFill,
  type PresentationTextStyle,
} from "./presentationTextPackage";
import {
  createPresentationTextRangeAdapter,
  type PresentationTextPosition,
} from "./presentationTextRange";
import { cloneElement, textRuns } from "./presentationTextRangeXml";
import { presentationTextSelection } from "./presentationTextSelection";

const styleKeys = new Set(["fontSize", "bold", "italic", "color"]);

function validatedStyle(
  body: Element,
  style: PresentationTextStyle,
): PresentationTextStyle {
  if (
    !style ||
    typeof style !== "object" ||
    Array.isArray(style) ||
    Reflect.ownKeys(style).some(
      (key) => typeof key !== "string" || !styleKeys.has(key),
    )
  )
    fail("text style");
  const result: PresentationTextStyle = {
    fontSize: style.fontSize,
    bold: style.bold,
    italic: style.italic,
    color: style.color,
  };
  // 复用现有单位、颜色与取值校验；验证不接触原正文。
  applyTextStyle(create(body, a, "txBody"), result);
  return result;
}

function styledRun(
  body: Element,
  run: Element,
  style: PresentationTextStyle,
): Element {
  const wrapper = create(body, a, "txBody"),
    paragraph = create(body, a, "p"),
    target = create(body, a, "r"),
    result = cloneElement(run);
  wrapper.append(paragraph);
  paragraph.append(target);
  applyTextStyle(wrapper, style);
  const generated = one(target, a, "rPr")!;
  let properties = one(result, a, "rPr");
  if (!properties) {
    properties = create(result, a, "rPr");
    result.insertBefore(properties, result.firstChild);
  }
  // 仅合入直接 run 属性；扩展 payload 内的同名节点不属于样式目标。
  for (const attribute of Array.from(generated.attributes))
    properties.setAttribute(attribute.name, attribute.value);
  const fill = one(generated, a, "solidFill");
  if (fill)
    replaceFill(properties, one(fill, a, "srgbClr")!.getAttribute("val")!);
  return result;
}

/** 只修改选中文字；段落默认、软换行和未相交内容不承接范围样式。 */
export function applyPresentationTextRangeStyle(
  body: Element,
  blockId: string,
  anchor: PresentationTextPosition,
  caret: PresentationTextPosition,
  style: PresentationTextStyle,
): boolean {
  const valid = validatedStyle(body, style),
    { selection } = presentationTextSelection(body, blockId, anchor, caret);
  if (!selection.length || Object.values(valid).every((v) => v === undefined))
    return false;
  const original = children(body, a, "p"),
    staged = cloneElement(body),
    adapter = createPresentationTextRangeAdapter(staged, blockId),
    changed = new Set<number>();
  // 从后向前拆分，前面的源 runIndex 不受后续 run 拆分影响。
  for (const range of [...selection].reverse()) {
    if (textRuns(original[range.paraIndex])[range.runIndex].localName !== "r")
      continue;
    const start = {
        blockId,
        paraIndex: range.paraIndex,
        runIndex: range.runIndex,
        charIndex: range.start,
      },
      end = { ...start, charIndex: range.end },
      fragment = adapter.getRangeFragment(start, end),
      run = textRuns(fragment.paragraphs[0])[0],
      replacement = styledRun(staged, run, valid);
    if (run.isEqualNode(replacement)) continue;
    run.replaceWith(replacement);
    adapter.replaceRangeWithFragment(start, end, fragment);
    changed.add(range.paraIndex);
  }
  // 所有片段先离线验证和构建；仅提交受影响段落，不重置整个 body。
  const replacements = children(staged, a, "p");
  for (const index of changed)
    body.replaceChild(replacements[index], original[index]);
  return changed.size > 0;
}
