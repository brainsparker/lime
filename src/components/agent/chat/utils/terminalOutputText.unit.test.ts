import { describe, expect, it } from "vitest";
import { stripTerminalControlSequences } from "./terminalOutputText";

describe("terminal output text projection", () => {
  it.each([
    ["PowerShell keypad", "\u001b[?1h\u001b=ready\r\n", "ready\r\n"],
    ["SGR and erase", "\u001b[31mfailed\u001b[0m\u001b[K", "failed"],
    ["OSC title", "a\u001b]0;private title\u0007b", "ab"],
    [
      "OSC link",
      "\u001b]8;;https://example.com\u001b\\link\u001b]8;;\u001b\\",
      "link",
    ],
    ["DCS", "before\u001bP1;2|private\u001b\\after", "beforeafter"],
    ["charset", "\u001b(Btext\u001b)0", "text"],
    ["C1", "\u009b?25l\u009d0;title\u009cvisible", "visible"],
    ["controls", "\u0000\u0007中\t文\r\nnext", "中\t文\r\nnext"],
    ["literal text", "[?1h = [31m ``` <tag> 😀", "[?1h = [31m ``` <tag> 😀"],
  ])("%s", (_name, raw, expected) => {
    expect(stripTerminalControlSequences(raw)).toBe(expected);
  });

  it.each([
    "\u001b[?1h",
    "\u001b=",
    "\u001b(B",
    "\u001b]0;title\u0007",
    "\u001bPdata\u001b\\",
  ])("按累计输出重投影，隐藏跨增量序列的未完成尾部 %j", (sequence) => {
    for (let boundary = 1; boundary <= sequence.length; boundary += 1) {
      const prefix = `head${sequence.slice(0, boundary)}`;
      expect(stripTerminalControlSequences(prefix)).toBe("head");
      expect(
        stripTerminalControlSequences(
          prefix + sequence.slice(boundary) + "tail",
        ),
      ).toBe("headtail");
    }
  });
});
