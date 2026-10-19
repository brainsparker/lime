type Terminal = Pick<
  import("@xterm/xterm").Terminal,
  "hasSelection" | "getSelection" | "paste"
>;

export function handleTerminalKeyEvent({
  event,
  terminal,
  sendText,
  onNewTerminalTab,
  clipboard = navigator.clipboard,
  pasteOnCtrlV = !/Mac/i.test(navigator.platform),
}: {
  event: KeyboardEvent;
  terminal: Terminal;
  sendText: (text: string) => void;
  onNewTerminalTab?: () => void;
  clipboard?: Pick<Clipboard, "readText" | "writeText">;
  pasteOnCtrlV?: boolean;
}): boolean {
  if (event.type !== "keydown") return true;
  const key = event.key.toLowerCase();
  const metaOnly =
    event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
  const ctrlOnly =
    event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  const ctrlShift =
    event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey;
  const shiftOnly =
    event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
  const handled = () => {
    event.preventDefault();
    event.stopPropagation();
    return false;
  };
  if (metaOnly && key === "t" && onNewTerminalTab) {
    onNewTerminalTab();
    return handled();
  }
  if (
    clipboard &&
    ((ctrlOnly && key === "c" && terminal.hasSelection()) ||
      (ctrlShift && key === "c") ||
      (ctrlOnly && key === "insert"))
  ) {
    const selection = terminal.getSelection();
    if (selection) void clipboard.writeText(selection).catch(() => undefined);
    return handled();
  }
  if (
    clipboard &&
    ((pasteOnCtrlV && ctrlOnly && key === "v") ||
      (ctrlShift && key === "v") ||
      (shiftOnly && key === "insert"))
  ) {
    void clipboard
      .readText()
      .then((text) => {
        if (text) terminal.paste(text);
      })
      .catch(() => undefined);
    return handled();
  }
  const sequence = metaOnly
    ? (
        {
          arrowleft: "\u0001",
          arrowup: "\u0001",
          arrowright: "\u0005",
          arrowdown: "\u0005",
          backspace: "\u0015",
          delete: "\u000b",
        } as Record<string, string>
      )[key]
    : undefined;
  if (!sequence) return true;
  sendText(sequence);
  return handled();
}
