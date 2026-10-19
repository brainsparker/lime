import { describe, expect, it, vi } from "vitest";
import { handleTerminalKeyEvent } from "./terminalKeyboard";

function fixture() {
  return {
    terminal: {
      hasSelection: vi.fn(() => false),
      getSelection: vi.fn(() => "selected"),
      paste: vi.fn(),
    },
    clipboard: {
      readText: vi.fn(async () => "pasted"),
      writeText: vi.fn(async () => undefined),
    },
    sendText: vi.fn(),
  };
}
describe("Terminal keyboard behavior", () => {
  it("keeps Ctrl+C for process interruption without selection, copies with selection", () => {
    const options = fixture();
    expect(
      handleTerminalKeyEvent({
        ...options,
        event: new KeyboardEvent("keydown", { key: "c", ctrlKey: true }),
      }),
    ).toBe(true);
    expect(options.clipboard.writeText).not.toHaveBeenCalled();
    options.terminal.hasSelection.mockReturnValue(true);
    expect(
      handleTerminalKeyEvent({
        ...options,
        event: new KeyboardEvent("keydown", { key: "c", ctrlKey: true }),
      }),
    ).toBe(false);
    expect(options.clipboard.writeText).toHaveBeenCalledWith("selected");
    expect(options.sendText).not.toHaveBeenCalled();
  });
  it("pastes through xterm so bracketed paste and input processing remain active", async () => {
    const options = fixture();
    expect(
      handleTerminalKeyEvent({
        ...options,
        event: new KeyboardEvent("keydown", {
          key: "v",
          ctrlKey: true,
          shiftKey: true,
        }),
      }),
    ).toBe(false);
    await Promise.resolve();
    expect(options.terminal.paste).toHaveBeenCalledWith("pasted");
    expect(options.sendText).not.toHaveBeenCalled();
  });
  it.each([
    ["ArrowLeft", "\u0001"],
    ["ArrowRight", "\u0005"],
    ["Backspace", "\u0015"],
    ["Delete", "\u000b"],
  ])("maps Meta+%s to the shell control sequence", (key, sequence) => {
    const options = fixture();
    expect(
      handleTerminalKeyEvent({
        ...options,
        event: new KeyboardEvent("keydown", { key, metaKey: true }),
      }),
    ).toBe(false);
    expect(options.sendText).toHaveBeenCalledExactlyOnceWith(sequence);
  });
});
