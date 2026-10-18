const SELECTED_TEXT_MAX_LENGTH = 320;

export function appendSelectedText(
  basePrompt: string,
  selectedText?: string,
  appendSelectedText = true,
): string {
  const normalizedPrompt = basePrompt.trim();
  if (!appendSelectedText) {
    return normalizedPrompt;
  }

  const normalizedSelected = (selectedText || "").trim();

  if (!normalizedSelected) {
    return normalizedPrompt;
  }

  const clippedSelected =
    normalizedSelected.length > SELECTED_TEXT_MAX_LENGTH
      ? `${normalizedSelected.slice(0, SELECTED_TEXT_MAX_LENGTH).trim()}…`
      : normalizedSelected;

  return `${normalizedPrompt}\n\n[参考选中内容]\n${clippedSelected}`;
}
