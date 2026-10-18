import palette from "./presentationColorPalette.json";
import { a, fail, create, one } from "./presentationPackageXml";

interface Color {
  theme: boolean;
  value: string;
  transforms?: Record<string, number>;
}

const themes = new Set([
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "bg1",
  "bg2",
  "tx1",
  "tx2",
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "hlink",
  "folHlink",
]);
const aliases: Record<string, string> = {
  background1: "bg1",
  background2: "bg2",
  text1: "tx1",
  text2: "tx2",
  dark1: "dk1",
  dark2: "dk2",
  light1: "lt1",
  light2: "lt2",
};
const clamp = (value: number, max = 1) =>
  Number.isNaN(value) ? 0 : Math.max(0, Math.min(max, value));
const opacity = (value: number) => clamp(value > 1 ? value / 100 : value);

function baseColor(value: string): Color | undefined {
  const text = value.trim(),
    lower = text.toLowerCase(),
    theme = aliases[lower] ?? lower;
  if (themes.has(theme)) return { theme: true, value: theme };
  if (lower === "transparent")
    return { theme: false, value: "000000", transforms: { alpha: 0 } };
  const hex = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text)?.[1];
  if (hex) {
    const expanded =
      hex.length < 5 ? [...hex].map((part) => part + part).join("") : hex;
    return {
      theme: false,
      value: expanded.slice(0, 6).toUpperCase(),
      ...(expanded.length === 8
        ? {
            transforms: {
              alpha: Math.round(
                (parseInt(expanded.slice(6), 16) / 255) * 100000,
              ),
            },
          }
        : {}),
    };
  }
  const rgb =
    /^rgba?\(\s*(\d{1,3})\s*(?:,\s*|\s+)(\d{1,3})\s*(?:,\s*|\s+)(\d{1,3})(?:\s*(?:\/|,)\s*([\d.]+%?))?\s*\)$/i.exec(
      text,
    );
  if (rgb) {
    const alpha =
      rgb[4] === undefined
        ? undefined
        : rgb[4].endsWith("%")
          ? Number(rgb[4].slice(0, -1)) / 100
          : opacity(Number(rgb[4]));
    return {
      theme: false,
      value: rgb
        .slice(1, 4)
        .map((channel) =>
          Math.min(255, Number(channel)).toString(16).padStart(2, "0"),
        )
        .join("")
        .toUpperCase(),
      ...(alpha === undefined || Number.isNaN(alpha)
        ? {}
        : { transforms: { alpha: Math.round(clamp(alpha) * 100000) } }),
    };
  }
  const slash = lower.indexOf("/");
  const name = (slash < 0 ? lower : lower.slice(0, slash)).trim();
  const alpha = slash < 0 ? undefined : lower.slice(slash + 1).trim();
  const number =
    alpha === undefined || !alpha ? undefined : Number(alpha.replace(/%$/, ""));
  const named = (palette.authoring as Record<string, string>)[name];
  return named
    ? {
        theme: false,
        value: named.slice(1),
        ...(number === undefined || Number.isNaN(number)
          ? {}
          : {
              transforms: {
                alpha: Math.round(
                  (alpha?.endsWith("%")
                    ? clamp(number / 100)
                    : opacity(number)) * 100000,
                ),
              },
            }),
      }
    : undefined;
}

/** 复现已绑定 authoring color constructor 的字符串语义，不套用 CSS named colors。 */
function parseColor(value: string): Color {
  if (typeof value !== "string") fail("table border color");
  const text = value.trim();
  if (/^var\b/i.test(text))
    fail("table border palette reference requires authoring context");
  if (!text.includes("(")) {
    let base = text,
      alpha: number | undefined,
      lighten: number | undefined,
      darken: number | undefined;
    const slash = /^(.*)\/([\d.]+%?)$/.exec(base);
    if (slash) {
      base = slash[1].trim();
      alpha = Number(slash[2].replace(/%$/, ""));
    }
    const light = /^(.*?)([+-])([\d.]+%?)$/.exec(base);
    if (light) {
      base = light[1].trim();
      if (light[2] === "+") lighten = Number(light[3].replace(/%$/, ""));
      else darken = Number(light[3].replace(/%$/, ""));
    }
    const parsed = baseColor(base);
    if (
      parsed &&
      [alpha, lighten, darken].some((part) => part !== undefined) &&
      [alpha, lighten, darken].every(
        (part) => part === undefined || Number.isFinite(part),
      )
    ) {
      const transforms = { ...parsed.transforms };
      if (alpha !== undefined)
        transforms.alpha = Math.round(
          (transforms.alpha ?? 100000) * opacity(alpha),
        );
      if (lighten !== undefined && lighten !== 0) {
        transforms.lumMod = Math.round((1 - opacity(lighten)) * 100000);
        transforms.lumOff = Math.round(opacity(lighten) * 100000);
      }
      if (darken !== undefined && darken !== 0)
        transforms.lumMod = Math.round((1 - opacity(darken)) * 100000);
      return { ...parsed, transforms };
    }
  }
  return baseColor(text) ?? { theme: false, value: "000000" };
}

/** 参考先构造 color 做边界校验，真正赋值时才解析 fill 简写。 */
export function validateTableBorderColor(value: string): void {
  parseColor(value);
}

function solidFill(parent: Element, value: string): Element {
  const parsed = parseColor(value),
    solid = create(parent, a, "solidFill"),
    color = create(parent, a, parsed.theme ? "schemeClr" : "srgbClr");
  color.setAttribute("val", parsed.value);
  for (const [name, amount] of Object.entries(parsed.transforms ?? {})) {
    const transform = create(parent, a, name);
    transform.setAttribute("val", String(amount));
    color.append(transform);
  }
  solid.append(color);
  return solid;
}

/** authoring line.color 的字符串实际交给 fill constructor，包含 none 和渐变简写。 */
export function colorFill(parent: Element, value: string): Element {
  if (typeof value !== "string") fail("table border color");
  if (value.trim().toLowerCase() === "none") return create(parent, a, "noFill");
  const gradient = /^(linear|gradient|path|radial)\s*\(([\s\S]*)\)$/i.exec(
    value.trim(),
  );
  if (!gradient) return solidFill(parent, value);
  const parts: string[] = [];
  let depth = 0,
    start = 0;
  for (let index = 0; index < gradient[2].length; index++) {
    const char = gradient[2][index];
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(gradient[2].slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(gradient[2].slice(start).trim());
  const linear = ["linear", "gradient"].includes(gradient[1].toLowerCase());
  const angle =
    linear && /^-?\d+(?:\.\d+)?deg$/i.test(parts[0])
      ? Number(parts.shift()!.slice(0, -3))
      : undefined;
  if (parts.length < 2 || parts.some((part) => !part))
    fail("table border gradient stops");
  const stops = parts.map((part) => {
    const offset = /\s+(-?\d+(?:\.\d+)?)%$/.exec(part);
    return {
      color: offset ? part.slice(0, offset.index).trim() : part,
      offset: offset ? Number(offset[1]) : undefined,
    };
  });
  const complete = stops.every((stop) => stop.offset !== undefined),
    fill = create(parent, a, "gradFill"),
    list = create(parent, a, "gsLst");
  stops.forEach((stop, index) => {
    const node = create(parent, a, "gs");
    node.setAttribute(
      "pos",
      String(
        Math.round(
          clamp(
            (complete ? stop.offset! : (index * 100) / (stops.length - 1)) /
              100,
          ) * 100000,
        ),
      ),
    );
    node.append(solidFill(parent, stop.color).firstElementChild!);
    list.append(node);
  });
  fill.append(list);
  if (linear) {
    const line = create(parent, a, "lin");
    if (angle !== undefined)
      line.setAttribute(
        "ang",
        String(Math.round((((angle % 360) + 360) % 360) * 60000)),
      );
    fill.append(line);
  } else {
    const path = create(parent, a, "path");
    path.setAttribute("path", "circle");
    fill.append(path);
  }
  return fill;
}

export function lineColor(line: Element): Element | undefined {
  const solid = one(line, a, "solidFill"),
    pattern = one(line, a, "pattFill");
  const parent = solid ?? (pattern && one(pattern, a, "fgClr"));
  return (
    parent &&
    Array.from(parent.children).find(
      (child) =>
        child.namespaceURI === a &&
        [
          "srgbClr",
          "schemeClr",
          "sysClr",
          "prstClr",
          "scrgbClr",
          "hslClr",
        ].includes(child.localName),
    )
  );
}

type Channels = [number, number, number];
function hsl([red, green, blue]: Channels): Channels {
  const r = red / 255,
    g = green / 255,
    b = blue / 255,
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    light = (max + min) / 2,
    difference = max - min;
  if (!difference) return [0, 0, light];
  const hue =
    max === r
      ? (g - b) / difference + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / difference + 2
        : (r - g) / difference + 4;
  return [
    hue / 6,
    light > 0.5 ? difference / (2 - max - min) : difference / (max + min),
    light,
  ];
}
function fromHsl([hue, saturation, light]: Channels): Channels {
  if (!saturation)
    return [light, light, light].map((part) =>
      Math.round(part * 255),
    ) as Channels;
  const upper =
      light < 0.5
        ? light * (1 + saturation)
        : light + saturation - light * saturation,
    lower = 2 * light - upper;
  return [hue + 1 / 3, hue, hue - 1 / 3].map((part) => {
    const t = (part + 1) % 1;
    return Math.round(
      255 *
        (t < 1 / 6
          ? lower + (upper - lower) * 6 * t
          : t < 1 / 2
            ? upper
            : t < 2 / 3
              ? lower + (upper - lower) * (2 / 3 - t) * 6
              : lower),
    );
  }) as Channels;
}

/** snapshot 的 hex 去掉 alpha，采用参考 DrawingML cRGB 的亮度/饱和度与 gamma tint/shade。 */
export function colorHex(
  color: Element,
  theme: ReadonlyMap<string, Element>,
  colorMap: ReadonlyMap<string, string>,
  visited = new Set<string>(),
): string {
  const value = color.getAttribute("val") ?? "",
    kind = color.localName;
  let hex = "000000";
  if (kind === "schemeClr") {
    const key =
      colorMap.get(value) ??
      (
        { tx1: "dk1", tx2: "dk2", bg1: "lt1", bg2: "lt2" } as Record<
          string,
          string
        >
      )[value] ??
      value;
    if (visited.has(key)) fail("table border theme color cycle");
    const reference = theme.get(key);
    if (!reference) fail("unresolved table border theme color");
    hex = colorHex(reference, theme, colorMap, new Set([...visited, key]));
  } else if (kind === "srgbClr") hex = value.replace(/^#/, "");
  else if (kind === "sysClr") hex = color.getAttribute("lastClr") ?? hex;
  else if (kind === "prstClr")
    hex =
      (palette.preset as Record<string, string>)[value.toLowerCase()]?.slice(
        1,
      ) ?? hex;
  else if (kind === "scrgbClr") {
    hex = ["r", "g", "b"]
      .map((name) => {
        const channel = clamp(Number(color.getAttribute(name)) / 100000);
        return Math.round(
          255 *
            (channel <= 0.0031308
              ? channel * 12.92
              : 1.055 * channel ** (1 / 2.4) - 0.055),
        )
          .toString(16)
          .padStart(2, "0");
      })
      .join("");
  } else if (kind !== "hslClr") fail("unsupported table border color");
  if (!/^[0-9A-F]{6}$/i.test(hex)) hex = "000000";
  let channels = (
    kind === "hslClr"
      ? fromHsl([
          Number(color.getAttribute("hue")) / 21600000,
          Number(color.getAttribute("sat")) / 100000,
          Number(color.getAttribute("lum")) / 100000,
        ])
      : [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  ) as Channels;
  const transformations = new Map(
    Array.from(color.children)
      .filter((child) => child.namespaceURI === a)
      .map((child) => [child.localName, Number(child.getAttribute("val"))]),
  );
  if (
    [...transformations.keys()].some(
      (name) =>
        ![
          "alpha",
          "alphaMod",
          "alphaOff",
          "satMod",
          "lumMod",
          "lumOff",
          "tint",
          "shade",
        ].includes(name),
    )
  )
    fail("unsupported table border color transform");
  if (
    ["satMod", "lumMod", "lumOff"].some((name) => transformations.has(name))
  ) {
    const parts = hsl(channels);
    parts[1] = clamp(
      (parts[1] * (transformations.get("satMod") ?? 100000)) / 100000,
    );
    parts[2] = clamp(
      clamp((parts[2] * (transformations.get("lumMod") ?? 100000)) / 100000) +
        (transformations.get("lumOff") ?? 0) / 100000,
    );
    channels = fromHsl(parts);
  }
  for (const name of ["tint", "shade"]) {
    const amount = transformations.get(name);
    if (amount === undefined) continue;
    const factor = clamp(
      (name === "tint" && amount < 0 ? 100000 + amount : amount) / 100000,
    );
    channels = channels.map((channel) => {
      const linear = Math.round(
        (Math.floor((channel * 100000) / 255) / 100000) ** 2.3 * 100000,
      );
      const transformed = Math.floor(
        name === "tint" && amount >= 0
          ? 100000 - (100000 - linear) * factor
          : linear * factor,
      );
      return Math.floor(
        (Math.round((transformed / 100000) ** (1 / 2.3) * 100000) * 255) /
          100000,
      );
    }) as Channels;
  }
  return channels
    .map((part) => Math.round(clamp(part, 255)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
