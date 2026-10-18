import { fail } from "./presentationPackageXml";

export type TextHtmlStyles = Readonly<Record<string, string>>;
const properties = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "font-size",
  "color",
  "font-family",
  "white-space",
  "text-align",
  "margin-left",
  "margin-right",
  "text-indent",
  "margin-top",
  "margin-bottom",
]);

export function textHtmlPoints(value: string): number {
  const match = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(px|pt|in|cm|mm)?$/i.exec(value);
  if (!match || (!match[2] && Number(match[1]) !== 0)) fail("HTML length");
  const factor = { px: 0.75, pt: 1, in: 72, cm: 72 / 2.54, mm: 72 / 25.4 };
  const points =
    Number(match[1]) *
    (factor[match[2]?.toLowerCase() as keyof typeof factor] ?? 1);
  if (!Number.isFinite(points)) fail("HTML length range");
  return points;
}

export function textHtmlColor(value: string): string {
  const named: Record<string, string> = {
    black: "000000",
    silver: "C0C0C0",
    gray: "808080",
    white: "FFFFFF",
    maroon: "800000",
    red: "FF0000",
    purple: "800080",
    fuchsia: "FF00FF",
    green: "008000",
    lime: "00FF00",
    olive: "808000",
    yellow: "FFFF00",
    navy: "000080",
    blue: "0000FF",
    teal: "008080",
    aqua: "00FFFF",
    orange: "FFA500",
    rebeccapurple: "663399",
  };
  if (named[value.toLowerCase()]) return named[value.toLowerCase()];
  const hex = /^#([a-f\d]{3}|[a-f\d]{6})$/i.exec(value);
  if (hex)
    return (
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1]
    ).toUpperCase();
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(value);
  if (!rgb || rgb.slice(1).some((part) => Number(part) > 255)) fail("HTML RGB");
  return rgb
    .slice(1)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** 不解析任意 CSS；资源、转义和依赖页面样式的值明确交给调用方 plain fallback。 */
export function parseTextHtmlStyles(source: string): TextHtmlStyles {
  if (/[\\{}@]|\/\*|\*\//.test(source)) fail("HTML CSS syntax");
  const styles: Record<string, string> = {};
  for (const declaration of source.split(";")) {
    if (!declaration.trim()) continue;
    const colon = declaration.indexOf(":");
    const property = declaration.slice(0, colon).trim().toLowerCase();
    let value = declaration
      .slice(colon + 1)
      .trim()
      .replace(/\s*!important\s*$/i, "");
    if (colon < 0 || !properties.has(property) || !value)
      fail("HTML CSS property");
    const lower = value.toLowerCase();
    if (property === "font-weight") {
      if (!/^(bold|normal|[1-9]00)$/.test(lower)) fail("HTML font weight");
      value = lower === "bold" || Number(lower) >= 600 ? "bold" : "normal";
    } else if (property === "font-style") {
      if (!["normal", "italic", "oblique"].includes(lower))
        fail("HTML font style");
      value = lower === "normal" ? "normal" : "italic";
    } else if (property.startsWith("text-decoration")) {
      if (
        !lower
          .split(/\s+/)
          .every((part) => ["none", "underline", "line-through"].includes(part))
      )
        fail("HTML text decoration");
      value = lower;
    } else if (property === "font-size") {
      const size = Math.round(textHtmlPoints(lower) * 100);
      if (size < 1 || size > 400000) fail("HTML font size");
      value = `${size / 100}pt`;
    } else if (property === "color") {
      value = `#${textHtmlColor(value)}`;
    } else if (property === "font-family") {
      value = value.split(",")[0].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      if (
        !value ||
        value.length > 256 ||
        /[<>"'()]/u.test(value) ||
        Array.from(value).some((character) => character.codePointAt(0)! < 32)
      )
        fail("HTML font family");
    } else if (property === "white-space") {
      if (
        !["normal", "nowrap", "pre", "pre-wrap", "break-spaces"].includes(lower)
      )
        fail("HTML white space");
      value = lower;
    } else if (property === "text-align") {
      if (!["left", "center", "right", "justify"].includes(lower))
        fail("HTML paragraph alignment");
      value = lower;
    } else if (
      ["margin-top", "margin-bottom"].includes(property) &&
      lower.endsWith("lh")
    ) {
      const lines = Number(lower.slice(0, -2));
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)lh$/.test(lower) || lines > 132)
        fail("HTML paragraph spacing");
      value = `${Math.round(lines * 100000) / 100000}lh`;
    } else {
      const points = textHtmlPoints(lower);
      if (property !== "text-indent" && points < 0)
        fail("HTML negative margin");
      if (
        ["margin-left", "margin-right", "text-indent"].includes(property) &&
        Math.abs(Math.round(points * 12700)) > 51206400
      )
        fail("HTML DrawingML indent range");
      if (
        ["margin-top", "margin-bottom"].includes(property) &&
        Math.round(points * 100) > 20116800
      )
        fail("HTML DrawingML spacing range");
      value = `${points}pt`;
    }
    styles[
      property.startsWith("text-decoration") ? "text-decoration-line" : property
    ] = value;
  }
  return styles;
}

export function safePresentationHyperlink(value: string): string | undefined {
  if (
    !value ||
    value.length > 8192 ||
    Array.from(value).some(
      (character) =>
        character.codePointAt(0)! <= 32 || character.codePointAt(0) === 127,
    ) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  )
    return;
  try {
    const url = new URL(value);
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      /^https?:\/\//i.test(value) &&
      url.hostname
    )
      return url.href;
    if (url.protocol === "mailto:" && url.pathname) return url.href;
  } catch {
    /* 非绝对 URL 使用 plain fallback，不依赖页面 base。 */
  }
}

export function escapeTextHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}
