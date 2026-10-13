// Transcript projection only: always consume accumulated output so a sequence
// split across deltas is re-parsed without changing the canonical/raw transcript.
export function stripTerminalControlSequences(value: string): string {
  const text: string[] = [];
  let index = 0;
  while (index < value.length) {
    const code = value.charCodeAt(index++);
    let introducer = code;
    if (code === 0x1b) {
      if (index === value.length) break;
      introducer = value.charCodeAt(index++);
    }

    if ((code === 0x1b && introducer === 0x5b) || code === 0x9b) {
      // CSI parameters/intermediates end at a final byte, including private modes.
      while (index < value.length) {
        const next = value.charCodeAt(index);
        if (next >= 0x40 && next <= 0x7e) {
          index++;
          break;
        }
        if (next < 0x20 || next > 0x3f) break;
        index++;
      }
      continue;
    }

    const isOsc = (code === 0x1b && introducer === 0x5d) || code === 0x9d;
    const isControlString =
      isOsc ||
      (code === 0x1b && [0x50, 0x58, 0x5e, 0x5f].includes(introducer)) ||
      [0x90, 0x98, 0x9e, 0x9f].includes(code);
    if (isControlString) {
      while (index < value.length) {
        const next = value.charCodeAt(index++);
        if (next === 0x9c || (isOsc && next === 0x07)) break;
        if (next === 0x1b && value.charCodeAt(index) === 0x5c) {
          index++;
          break;
        }
      }
      continue;
    }

    if (code === 0x1b) {
      // ESC =, ESC >, charset designation and other single escape functions.
      while (introducer >= 0x20 && introducer <= 0x2f && index < value.length) {
        introducer = value.charCodeAt(index++);
      }
      if (introducer < 0x20 || introducer > 0x7e) index--;
      continue;
    }
    if (code < 0x20 && ![0x09, 0x0a, 0x0d].includes(code)) continue;
    if (code >= 0x7f && code <= 0x9f) continue;
    text.push(value[index - 1]);
  }
  return text.join("");
}
