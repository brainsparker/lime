type TerminalTheme = NonNullable<
  ConstructorParameters<typeof import("@xterm/xterm").Terminal>[0]
>["theme"];

/** xterm canvas 需要解析后的颜色，CSS var 本身不能作为画布颜色。 */
export function readTerminalTheme(element: HTMLElement): TerminalTheme {
  const style = getComputedStyle(element);
  const color = (name: string) =>
    style.getPropertyValue(name).trim() || undefined;
  const foreground = color("--lime-text");
  const background = color("--lime-surface");
  return {
    background,
    foreground,
    cursor: color("--lime-text-strong"),
    cursorAccent: background,
    selectionBackground: color("--lime-surface-hover"),
    selectionForeground: color("--lime-text-strong"),
    selectionInactiveBackground: color("--lime-surface-muted"),
    red: color("--lime-danger"),
    brightRed: color("--lime-danger"),
    green: color("--lime-brand"),
    brightGreen: color("--lime-brand"),
    yellow: color("--lime-warning"),
    brightYellow: color("--lime-warning"),
    blue: color("--lime-info"),
    brightBlue: color("--lime-info"),
    scrollbarSliderBackground: color("--lime-surface-border"),
    scrollbarSliderHoverBackground: color("--lime-surface-border-strong"),
    scrollbarSliderActiveBackground: color("--lime-text-muted"),
  };
}
