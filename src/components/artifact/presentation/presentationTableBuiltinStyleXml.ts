/*
 * SPDX-License-Identifier: MPL-2.0
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Adapted from @aiden0z/pptx-renderer 1.3.0, commit
 * 0cf5c194b4db2cf9f2531b6a7e24a61338caabf1,
 * src/renderer/predefinedTableStyles.ts. Upstream identifies derivation
 * from LibreOffice predefined-table-styles.cxx (MPL-2.0).
 * Source, changes and upstream package license: presentationTableBuiltinStyle.SOURCES.md.
 */

// ---------------------------------------------------------------------------
// XML helpers — reduce boilerplate in style generators
// ---------------------------------------------------------------------------

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

/** Solid fill with a scheme color and optional transform */
function fillSolid(scheme: string, transform?: string): string {
  const mod = transform ? `<a:${transform}/>` : "";
  return `<a:fill><a:solidFill><a:schemeClr val="${scheme}">${mod}</a:schemeClr></a:solidFill></a:fill>`;
}

/** A border <a:ln> element with scheme color */
function borderLn(scheme: string, transform?: string): string {
  const mod = transform ? `<a:${transform}/>` : "";
  return `<a:ln w="12700"><a:solidFill><a:schemeClr val="${scheme}">${mod}</a:schemeClr></a:solidFill></a:ln>`;
}

/** Text color element within tcTxStyle */
function tcTxStyle(scheme: string, bold?: boolean): string {
  const bAttr = bold ? ' b="on"' : "";
  const colorEl = scheme ? `<a:schemeClr val="${scheme}"/>` : "";
  return `<a:tcTxStyle${bAttr}>${colorEl}</a:tcTxStyle>`;
}

/** Style part with optional fill, borders, and text style */
function stylePart(
  tag: string,
  opts: {
    textColor?: string;
    bold?: boolean;
    fill?: string;
    borders?: Record<string, string>;
  },
): string {
  if (!opts.textColor && !opts.bold && !opts.fill && !opts.borders) return "";
  const parts: string[] = [`<a:${tag}>`];
  if (opts.textColor || opts.bold)
    parts.push(tcTxStyle(opts.textColor ?? "", opts.bold));
  parts.push("<a:tcStyle>");
  if (opts.fill) parts.push(opts.fill);
  if (opts.borders) {
    parts.push("<a:tcBdr>");
    for (const [side, ln] of Object.entries(opts.borders)) {
      parts.push(`<a:${side}>${ln}</a:${side}>`);
    }
    parts.push("</a:tcBdr>");
  }
  parts.push("</a:tcStyle>");
  parts.push(`</a:${tag}>`);
  return parts.join("");
}

// ---------------------------------------------------------------------------
// Style group XML generators
// ---------------------------------------------------------------------------

function themedStyle1(accent: string, styleId: string): string {
  const hasAccent = accent !== "";
  const accentVal = hasAccent ? accent : "tx1";
  const parts: string[] = [];

  if (hasAccent) {
    // wholeTbl: text=dk1, borders=accent on all sides
    const allBorders: Record<string, string> = {
      left: borderLn(accentVal),
      right: borderLn(accentVal),
      top: borderLn(accentVal),
      bottom: borderLn(accentVal),
      insideH: borderLn(accentVal),
      insideV: borderLn(accentVal),
    };
    parts.push(
      stylePart("wholeTbl", { textColor: "dk1", borders: allBorders }),
    );

    // band1H/V: accent + alpha(40000)
    const bandFill = fillSolid(accentVal, `alpha val="40000"`);
    parts.push(stylePart("band1H", { fill: bandFill }));
    parts.push(stylePart("band1V", { fill: bandFill }));

    // firstRow: text=lt1, bold, fill=accent, borders=accent (+ bottom=lt1)
    parts.push(
      stylePart("firstRow", {
        textColor: "lt1",
        bold: true,
        fill: fillSolid(accentVal),
        borders: {
          left: borderLn(accentVal),
          right: borderLn(accentVal),
          top: borderLn(accentVal),
          bottom: borderLn("lt1"),
        },
      }),
    );

    // lastRow: bold, borders=accent
    parts.push(
      stylePart("lastRow", {
        bold: true,
        borders: {
          left: borderLn(accentVal),
          right: borderLn(accentVal),
          top: borderLn(accentVal),
          bottom: borderLn(accentVal),
        },
      }),
    );

    // firstCol/lastCol: bold, borders=accent (+ insideH)
    const colBorders: Record<string, string> = {
      left: borderLn(accentVal),
      right: borderLn(accentVal),
      top: borderLn(accentVal),
      bottom: borderLn(accentVal),
      insideH: borderLn(accentVal),
    };
    parts.push(stylePart("firstCol", { bold: true, borders: colBorders }));
    parts.push(stylePart("lastCol", { bold: true, borders: colBorders }));
  } else {
    // No accent: text=tx1, band with alpha
    parts.push(stylePart("wholeTbl", { textColor: "tx1" }));
    const bandFill = fillSolid("tx1", `alpha val="40000"`);
    parts.push(stylePart("band1H", { fill: bandFill }));
    parts.push(stylePart("band1V", { fill: bandFill }));
  }

  return wrapTblStyle(styleId, "Themed-Style-1", parts.join(""));
}

function themedStyle2(accent: string, styleId: string): string {
  const hasAccent = accent !== "";
  const parts: string[] = [];

  if (hasAccent) {
    const accentVal = accent;
    // tblBg: accent fill
    const tblBg = `<a:tblBg><a:fillRef idx="1"><a:schemeClr val="${accentVal}"/></a:fillRef></a:tblBg>`;

    // wholeTbl: text=lt1, outer borders=accent+tint(50000)
    const outerBorders: Record<string, string> = {
      left: borderLn(accentVal, `tint val="50000"`),
      right: borderLn(accentVal, `tint val="50000"`),
      top: borderLn(accentVal, `tint val="50000"`),
      bottom: borderLn(accentVal, `tint val="50000"`),
    };
    parts.push(
      stylePart("wholeTbl", { textColor: "lt1", borders: outerBorders }),
    );

    // band1H/V: lt1 + alpha(20000)
    const bandFill = fillSolid("lt1", `alpha val="20000"`);
    parts.push(stylePart("band1H", { fill: bandFill }));
    parts.push(stylePart("band1V", { fill: bandFill }));

    // firstRow: text=lt1, bold, bottom border=lt1
    parts.push(
      stylePart("firstRow", {
        textColor: "lt1",
        bold: true,
        borders: { bottom: borderLn("lt1") },
      }),
    );
    // lastRow: bold, top border=lt1
    parts.push(
      stylePart("lastRow", { bold: true, borders: { top: borderLn("lt1") } }),
    );
    // firstCol: bold, right border=lt1
    parts.push(
      stylePart("firstCol", {
        bold: true,
        borders: { right: borderLn("lt1") },
      }),
    );
    // lastCol: bold, left border=lt1
    parts.push(
      stylePart("lastCol", { bold: true, borders: { left: borderLn("lt1") } }),
    );

    return wrapTblStyle(styleId, "Themed-Style-2", tblBg + parts.join(""));
  } else {
    // No accent: text=tx1 (implicit), outer borders=tx1+tint(50000), inside borders=tx1
    const outerBorders: Record<string, string> = {
      left: borderLn("tx1", `tint val="50000"`),
      right: borderLn("tx1", `tint val="50000"`),
      top: borderLn("tx1", `tint val="50000"`),
      bottom: borderLn("tx1", `tint val="50000"`),
      insideH: borderLn("tx1"),
      insideV: borderLn("tx1"),
    };
    parts.push(stylePart("wholeTbl", { borders: outerBorders }));

    const bandFill = fillSolid("tx1", `alpha val="20000"`);
    parts.push(stylePart("band1H", { fill: bandFill }));
    parts.push(stylePart("band1V", { fill: bandFill }));

    return wrapTblStyle(styleId, "Themed-Style-2", parts.join(""));
  }
}

function lightStyle1(accent: string, styleId: string): string {
  const accentVal = accent || "tx1";
  const parts: string[] = [];

  // wholeTbl: text=tx1, top/bottom borders
  parts.push(
    stylePart("wholeTbl", {
      textColor: "tx1",
      borders: {
        top: borderLn(accentVal),
        bottom: borderLn(accentVal),
      },
    }),
  );

  // band1H/V: accent + alpha(20000)
  const bandFill = fillSolid(accentVal, `alpha val="20000"`);
  parts.push(stylePart("band1H", { fill: bandFill }));
  parts.push(stylePart("band1V", { fill: bandFill }));

  // firstRow: text=tx1, bold, bottom border
  parts.push(
    stylePart("firstRow", {
      textColor: "tx1",
      bold: true,
      borders: { bottom: borderLn(accentVal) },
    }),
  );

  // lastRow: bold, top border
  parts.push(
    stylePart("lastRow", { bold: true, borders: { top: borderLn(accentVal) } }),
  );

  // firstCol: bold text
  parts.push(stylePart("firstCol", { textColor: "tx1", bold: true }));
  // lastCol: bold text
  parts.push(stylePart("lastCol", { textColor: "tx1", bold: true }));

  return wrapTblStyle(styleId, "Light-Style-1", parts.join(""));
}

function lightStyle2(accent: string, styleId: string): string {
  const accentVal = accent || "tx1";
  const parts: string[] = [];

  // wholeTbl: text=tx1, all 4 outer borders
  parts.push(
    stylePart("wholeTbl", {
      textColor: "tx1",
      borders: {
        left: borderLn(accentVal),
        right: borderLn(accentVal),
        top: borderLn(accentVal),
        bottom: borderLn(accentVal),
      },
    }),
  );

  // band1H: top+bottom borders
  parts.push(
    stylePart("band1H", {
      borders: {
        top: borderLn(accentVal),
        bottom: borderLn(accentVal),
      },
    }),
  );

  // band1V/band2V: left+right borders
  parts.push(
    stylePart("band1V", {
      borders: { left: borderLn(accentVal), right: borderLn(accentVal) },
    }),
  );
  parts.push(
    stylePart("band2V", {
      borders: { left: borderLn(accentVal), right: borderLn(accentVal) },
    }),
  );

  // firstRow: text=bg1, bold, fill=accent
  parts.push(
    stylePart("firstRow", {
      textColor: "bg1",
      bold: true,
      fill: fillSolid(accentVal),
    }),
  );

  // lastRow: bold, top border
  parts.push(
    stylePart("lastRow", { bold: true, borders: { top: borderLn(accentVal) } }),
  );

  // firstCol: bold
  parts.push(stylePart("firstCol", { bold: true }));
  // lastCol: bold
  parts.push(stylePart("lastCol", { bold: true }));

  return wrapTblStyle(styleId, "Light-Style-2", parts.join(""));
}

function lightStyle3(accent: string, styleId: string): string {
  const accentVal = accent || "tx1";
  const parts: string[] = [];

  // wholeTbl: text=tx1, all 6 borders
  parts.push(
    stylePart("wholeTbl", {
      textColor: "tx1",
      borders: {
        left: borderLn(accentVal),
        right: borderLn(accentVal),
        top: borderLn(accentVal),
        bottom: borderLn(accentVal),
        insideH: borderLn(accentVal),
        insideV: borderLn(accentVal),
      },
    }),
  );

  // band1H/V: accent + alpha(20000)
  const bandFill = fillSolid(accentVal, `alpha val="20000"`);
  parts.push(stylePart("band1H", { fill: bandFill }));
  parts.push(stylePart("band1V", { fill: bandFill }));

  // firstRow: text=accent, bold, bottom border
  parts.push(
    stylePart("firstRow", {
      textColor: accentVal,
      bold: true,
      borders: { bottom: borderLn(accentVal) },
    }),
  );

  // lastRow: bold, top border
  parts.push(
    stylePart("lastRow", { bold: true, borders: { top: borderLn(accentVal) } }),
  );

  // firstCol: bold
  parts.push(stylePart("firstCol", { bold: true }));
  // lastCol: bold
  parts.push(stylePart("lastCol", { bold: true }));

  return wrapTblStyle(styleId, "Light-Style-3", parts.join(""));
}

function mediumStyle1(accent: string, styleId: string): string {
  const accentVal = accent || "dk1";
  const parts: string[] = [];

  // wholeTbl: text=dk1, fill=lt1, borders (left/right/top/bottom/insideH)
  parts.push(
    stylePart("wholeTbl", {
      textColor: "dk1",
      fill: fillSolid("lt1"),
      borders: {
        left: borderLn(accentVal),
        right: borderLn(accentVal),
        top: borderLn(accentVal),
        bottom: borderLn(accentVal),
        insideH: borderLn(accentVal),
      },
    }),
  );

  // band1H/V: accent + tint(20000)
  const bandFill = fillSolid(accentVal, `tint val="20000"`);
  parts.push(stylePart("band1H", { fill: bandFill }));
  parts.push(stylePart("band1V", { fill: bandFill }));

  // firstRow: text=lt1, bold, fill=accent
  parts.push(
    stylePart("firstRow", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(accentVal),
    }),
  );

  // lastRow: bold, fill=lt1, top border
  parts.push(
    stylePart("lastRow", {
      bold: true,
      fill: fillSolid("lt1"),
      borders: { top: borderLn(accentVal) },
    }),
  );

  // firstCol: bold
  parts.push(stylePart("firstCol", { bold: true }));
  // lastCol: bold
  parts.push(stylePart("lastCol", { bold: true }));

  return wrapTblStyle(styleId, "Medium-Style-1", parts.join(""));
}

function mediumStyle2(accent: string, styleId: string): string {
  const accentVal = accent || "dk1";
  const parts: string[] = [];

  // wholeTbl: text=dk1, fill=accent+tint(20000), all borders=lt1
  parts.push(
    stylePart("wholeTbl", {
      textColor: "dk1",
      fill: fillSolid(accentVal, `tint val="20000"`),
      borders: {
        left: borderLn("lt1"),
        right: borderLn("lt1"),
        top: borderLn("lt1"),
        bottom: borderLn("lt1"),
        insideH: borderLn("lt1"),
        insideV: borderLn("lt1"),
      },
    }),
  );

  // band1H/V: accent + tint(40000)
  const bandFill = fillSolid(accentVal, `tint val="40000"`);
  parts.push(stylePart("band1H", { fill: bandFill }));
  parts.push(stylePart("band1V", { fill: bandFill }));

  // firstRow: text=lt1, bold, fill=accent, bottom border=lt1
  parts.push(
    stylePart("firstRow", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(accentVal),
      borders: { bottom: borderLn("lt1") },
    }),
  );

  // lastRow: text=lt1, bold, fill=accent, top border=lt1
  parts.push(
    stylePart("lastRow", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(accentVal),
      borders: { top: borderLn("lt1") },
    }),
  );

  // firstCol: text=lt1, bold, fill=accent
  parts.push(
    stylePart("firstCol", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(accentVal),
    }),
  );

  // lastCol: text=lt1, bold, fill=accent
  parts.push(
    stylePart("lastCol", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(accentVal),
    }),
  );

  return wrapTblStyle(styleId, "Medium-Style-2", parts.join(""));
}

function mediumStyle3(accent: string, styleId: string): string {
  const accentVal = accent || "dk1";
  const parts: string[] = [];

  // wholeTbl: text=dk1, fill=lt1, top/bottom borders=dk1
  parts.push(
    stylePart("wholeTbl", {
      textColor: "dk1",
      fill: fillSolid("lt1"),
      borders: {
        top: borderLn("dk1"),
        bottom: borderLn("dk1"),
      },
    }),
  );

  // band1H/V: dk1 + tint(20000)
  const bandFill = fillSolid("dk1", `tint val="20000"`);
  parts.push(stylePart("band1H", { fill: bandFill }));
  parts.push(stylePart("band1V", { fill: bandFill }));

  // firstRow: text=lt1, bold, fill=accent, bottom border=dk1
  parts.push(
    stylePart("firstRow", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(accentVal),
      borders: { bottom: borderLn("dk1") },
    }),
  );

  // lastRow: bold, fill=lt1, top border=dk1
  parts.push(
    stylePart("lastRow", {
      bold: true,
      fill: fillSolid("lt1"),
      borders: { top: borderLn("dk1") },
    }),
  );

  // firstCol: text=lt1, bold, fill=accent
  parts.push(
    stylePart("firstCol", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(accentVal),
    }),
  );

  // lastCol: text=lt1, bold, fill=accent
  parts.push(
    stylePart("lastCol", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(accentVal),
    }),
  );

  return wrapTblStyle(styleId, "Medium-Style-3", parts.join(""));
}

function mediumStyle4(accent: string, styleId: string): string {
  const accentVal = accent || "dk1";
  const parts: string[] = [];

  // wholeTbl: text=dk1, fill=accent+tint(20000), all 6 borders=accent
  parts.push(
    stylePart("wholeTbl", {
      textColor: "dk1",
      fill: fillSolid(accentVal, `tint val="20000"`),
      borders: {
        left: borderLn(accentVal),
        right: borderLn(accentVal),
        top: borderLn(accentVal),
        bottom: borderLn(accentVal),
        insideH: borderLn(accentVal),
        insideV: borderLn(accentVal),
      },
    }),
  );

  // band1H/V: accent + tint(40000)
  const bandFill = fillSolid(accentVal, `tint val="40000"`);
  parts.push(stylePart("band1H", { fill: bandFill }));
  parts.push(stylePart("band1V", { fill: bandFill }));

  // firstRow: text=accent, bold, fill=accent+tint(20000)
  parts.push(
    stylePart("firstRow", {
      textColor: accentVal,
      bold: true,
      fill: fillSolid(accentVal, `tint val="20000"`),
    }),
  );

  // lastRow: bold, fill=dk1+tint(20000), top border=dk1
  parts.push(
    stylePart("lastRow", {
      bold: true,
      fill: fillSolid("dk1", `tint val="20000"`),
      borders: { top: borderLn("dk1") },
    }),
  );

  // firstCol: bold
  parts.push(stylePart("firstCol", { bold: true }));
  // lastCol: bold
  parts.push(stylePart("lastCol", { bold: true }));

  return wrapTblStyle(styleId, "Medium-Style-4", parts.join(""));
}

function darkStyle1(accent: string, styleId: string): string {
  const hasAccent = accent !== "";
  const accentVal = hasAccent ? accent : "dk1";
  const transformType = hasAccent ? "shade" : "tint";
  const parts: string[] = [];

  // wholeTbl: text=dk1, fill=accent+shade/tint(20000)
  parts.push(
    stylePart("wholeTbl", {
      textColor: "dk1",
      fill: fillSolid(accentVal, `${transformType} val="20000"`),
    }),
  );

  // band1H/V: accent + shade/tint(40000)
  const bandFill = fillSolid(accentVal, `${transformType} val="40000"`);
  parts.push(stylePart("band1H", { fill: bandFill }));
  parts.push(stylePart("band1V", { fill: bandFill }));

  // firstRow: text=lt1, bold, fill=dk1, bottom border=lt1
  parts.push(
    stylePart("firstRow", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid("dk1"),
      borders: { bottom: borderLn("lt1") },
    }),
  );

  // lastRow: bold, fill=accent+shade/tint(20000), top border=lt1
  parts.push(
    stylePart("lastRow", {
      bold: true,
      fill: fillSolid(accentVal),
      borders: { top: borderLn("lt1") },
    }),
  );

  // firstCol: bold, fill=accent+shade/tint(60000), right border=lt1
  parts.push(
    stylePart("firstCol", {
      bold: true,
      fill: fillSolid(accentVal, `${transformType} val="60000"`),
      borders: { right: borderLn("lt1") },
    }),
  );

  // lastCol: bold, fill=accent+shade/tint(60000), left border=lt1
  parts.push(
    stylePart("lastCol", {
      bold: true,
      fill: fillSolid(accentVal, `${transformType} val="60000"`),
      borders: { left: borderLn("lt1") },
    }),
  );

  return wrapTblStyle(styleId, "Dark-Style-1", parts.join(""));
}

function darkStyle2(accent: string, styleId: string): string {
  const accentVal = accent || "dk1";
  const parts: string[] = [];

  // Determine firstRow fill: accent-shift logic
  let firstRowFillColor: string;
  if (accent === "") firstRowFillColor = "dk1";
  else if (accent === "accent1") firstRowFillColor = "accent2";
  else if (accent === "accent3") firstRowFillColor = "accent4";
  else if (accent === "accent5") firstRowFillColor = "accent6";
  else firstRowFillColor = accentVal;

  // wholeTbl: text=dk1, fill=accent+tint(20000)
  parts.push(
    stylePart("wholeTbl", {
      textColor: "dk1",
      fill: fillSolid(accentVal, `tint val="20000"`),
    }),
  );

  // band1H/V: accent + tint(40000)
  const bandFill = fillSolid(accentVal, `tint val="40000"`);
  parts.push(stylePart("band1H", { fill: bandFill }));
  parts.push(stylePart("band1V", { fill: bandFill }));

  // firstRow: text=lt1, bold, fill=firstRowFillColor
  parts.push(
    stylePart("firstRow", {
      textColor: "lt1",
      bold: true,
      fill: fillSolid(firstRowFillColor),
    }),
  );

  // lastRow: bold, fill=accent+tint(20000), top border=dk1
  parts.push(
    stylePart("lastRow", {
      bold: true,
      fill: fillSolid(accentVal, `tint val="20000"`),
      borders: { top: borderLn("dk1") },
    }),
  );

  // firstCol: bold
  parts.push(stylePart("firstCol", { bold: true }));
  // lastCol: bold
  parts.push(stylePart("lastCol", { bold: true }));

  return wrapTblStyle(styleId, "Dark-Style-2", parts.join(""));
}

// ---------------------------------------------------------------------------
// XML wrapper
// ---------------------------------------------------------------------------

function wrapTblStyle(
  styleId: string,
  styleName: string,
  innerXml: string,
): string {
  return `<a:tblStyle ${NS} styleId="${styleId}" styleName="${styleName}">${innerXml}</a:tblStyle>`;
}

// ---------------------------------------------------------------------------
// Style generator dispatch
// ---------------------------------------------------------------------------

export const builtinTableStyleGenerators: Readonly<
  Record<string, (accent: string, styleId: string) => string>
> = {
  "Themed-Style-1": themedStyle1,
  "Themed-Style-2": themedStyle2,
  "Light-Style-1": lightStyle1,
  "Light-Style-2": lightStyle2,
  "Light-Style-3": lightStyle3,
  "Medium-Style-1": mediumStyle1,
  "Medium-Style-2": mediumStyle2,
  "Medium-Style-3": mediumStyle3,
  "Medium-Style-4": mediumStyle4,
  "Dark-Style-1": darkStyle1,
  "Dark-Style-2": darkStyle2,
};
