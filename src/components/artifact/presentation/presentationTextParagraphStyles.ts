import { a, one } from "./presentationPackageXml";

export const presentationTextAlignment = {
  left: "l",
  center: "ctr",
  right: "r",
  justify: "just",
};
const numbered = [
  ["arabicPeriod", "1", "decimal"],
  ["alphaLcPeriod", "a", "lower-alpha"],
  ["alphaUcPeriod", "A", "upper-alpha"],
  ["romanLcPeriod", "i", "lower-roman"],
  ["romanUcPeriod", "I", "upper-roman"],
] as const;
const bullets = [
  ["•", "disc"],
  ["○", "circle"],
  ["▪", "square"],
] as const;
export const presentationTextNumbering = Object.fromEntries(
  numbered.map(([drawingType, htmlType]) => [htmlType, drawingType]),
);
export const presentationTextBullets = Object.fromEntries(
  bullets.map(([character, htmlType]) => [htmlType, character]),
);

function paragraphSpacing(
  property: Element,
  name: string,
  percentUnit: "lh" | "",
): string | undefined {
  const space = one(property, a, name);
  if (!space) return;
  const points = one(space, a, "spcPts")?.getAttribute("val"),
    percent = one(space, a, "spcPct")?.getAttribute("val");
  if (points && /^\d+$/.test(points) && Number(points) <= 20116800)
    return `${Number(points) / 100}pt`;
  if (percent && /^\d+$/.test(percent) && Number(percent) <= 13200000)
    return `${Number(percent) / 100000}${percentUnit}`;
}

/** HTML 与编辑投影共享明确的单位转换；百分比段距按行高计，不能使用 CSS %。 */
export function presentationTextParagraphStyles(
  property: Element | undefined,
): Record<string, string> {
  if (!property) return {};
  const styles: Record<string, string> = {};
  const align = Object.entries(presentationTextAlignment).find(
    ([, value]) => property.getAttribute("algn") === value,
  )?.[0];
  if (align) styles["text-align"] = align;
  for (const [attribute, css] of [
    ["marL", "margin-left"],
    ["marR", "margin-right"],
    ["indent", "text-indent"],
  ]) {
    const value = property.getAttribute(attribute);
    if (
      value !== null &&
      /^-?\d+$/.test(value) &&
      Math.abs(Number(value)) <= 2147483647
    )
      styles[css] = `${Number(value) / 12700}pt`;
  }
  for (const [name, css] of [
    ["spcBef", "margin-top"],
    ["spcAft", "margin-bottom"],
  ]) {
    const value = paragraphSpacing(property, name, "lh");
    if (value !== undefined) styles[css] = value;
  }
  return styles;
}

/** 行距百分比是当前字号的无单位倍数；固定行距与段距共享 spcPts 转换。 */
export function presentationTextParagraphLineHeight(
  property: Element | undefined,
): string | undefined {
  return property && paragraphSpacing(property, "lnSpc", "");
}

export type PresentationTextParagraphList =
  | {
      kind: "number";
      htmlType: (typeof numbered)[number][1];
      cssType: (typeof numbered)[number][2];
      level: number;
      start?: number;
    }
  | {
      kind: "bullet";
      htmlType: (typeof bullets)[number][1];
      cssType: (typeof bullets)[number][1];
      level: number;
    };

/** 仅映射已确认的列表方案；未知编号和符号不猜测。 */
export function presentationTextParagraphList(
  property: Element | undefined,
): PresentationTextParagraphList | undefined {
  if (!property || one(property, a, "buNone")) return;
  const value = property.getAttribute("lvl"),
    level = value && /^[0-8]$/.test(value) ? Number(value) : 0,
    auto = one(property, a, "buAutoNum");
  if (auto) {
    const type = numbered.find(([name]) => name === auto.getAttribute("type"));
    const start = auto.getAttribute("startAt");
    if (
      !type ||
      (start !== null &&
        (!/^\d+$/.test(start) || Number(start) < 1 || Number(start) > 32767))
    )
      return;
    return {
      kind: "number",
      htmlType: type[1],
      cssType: type[2],
      level,
      ...(start !== null ? { start: Number(start) } : {}),
    };
  }
  const bullet = one(property, a, "buChar"),
    type = bullets.find(
      ([character]) => character === bullet?.getAttribute("char"),
    );
  if (type)
    return { kind: "bullet", htmlType: type[1], cssType: type[1], level };
}

/** 编号仅从本轮源段落派生；显式起点、级别和方案切换决定连续性。 */
export function presentationTextParagraphMarkers(
  properties: readonly (Element | undefined)[],
): readonly (
  | (PresentationTextParagraphList & { ordinal?: number })
  | undefined
)[] {
  const counters = new Map<number, { type: string; ordinal: number }>();
  return properties.map((property) => {
    const list = presentationTextParagraphList(property);
    if (!list) {
      counters.clear();
      return;
    }
    for (const level of counters.keys())
      if (
        level > list.level ||
        (list.kind === "bullet" && level === list.level)
      )
        counters.delete(level);
    if (list.kind === "bullet") return list;
    const previous = counters.get(list.level),
      ordinal =
        list.start ??
        (previous?.type === list.cssType ? previous.ordinal + 1 : 1);
    counters.set(list.level, { type: list.cssType, ordinal });
    return { ...list, ordinal };
  });
}
