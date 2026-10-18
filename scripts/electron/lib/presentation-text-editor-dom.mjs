/** 自包含父页面观察函数，可直接序列化给 Playwright；不在 iframe 安装脚本或写入 DOM。 */
export function presentationTextEditorMatches({
  selector,
  value,
  ready = false,
  uncommittedSlideId,
}) {
  const panel = document.querySelector('[data-testid="presentation-panel"]');
  if (ready && panel?.getAttribute("data-status") !== "ready") return false;
  const content = document.querySelector(selector)?.contentDocument;
  const editor = content?.querySelector("[data-presentation-text-editor]");
  if (!editor || content.activeElement !== editor) return false;
  const blocks = new Set(["div", "p", "li"]);
  // 与 current 编辑器一致：段边界与软换行占一个 UTF-16 单位，占位 br 不计入文字。
  const text = (node) => {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType === 1) {
      if (node.hasAttribute("data-text-placeholder")) return "";
      if (node.localName === "br") return "\n";
    }
    let result = "",
      seen = false;
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1 && blocks.has(child.localName) && seen)
        result += "\n";
      result += text(child);
      seen = true;
    }
    return result;
  };
  if (text(editor) !== value) return false;
  if (uncommittedSlideId !== undefined) {
    // contenteditable 草稿自身含文字；投影不变断言只读取编辑器以外的原 renderer。
    const projectedText = (node) => {
      if (!node || node === editor) return "";
      if (node.nodeType === 3) return node.textContent ?? "";
      return Array.from(node.childNodes, projectedText).join("");
    };
    const slide = content.querySelector(
      `[data-slide-id="${uncommittedSlideId}"]`,
    );
    if (projectedText(slide).includes(value)) return false;
  }
  return true;
}
