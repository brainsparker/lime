import { describe, expect, it } from "vitest";
import { a, readXml } from "./presentationPackageXml";
import {
  presentationTextParagraphLineHeight,
  presentationTextParagraphList,
  presentationTextParagraphMarkers,
  presentationTextParagraphStyles,
} from "./presentationTextParagraphStyles";

const property = (content: string, attributes = "") =>
  readXml(`<a:pPr xmlns:a="${a}" ${attributes}>${content}</a:pPr>`)
    .documentElement;

describe("shared presentation paragraph projection", () => {
  it.each([
    ["spcPts", "0", "0pt"],
    ["spcPts", "2400", "24pt"],
    ["spcPts", "20116800", "201168pt"],
    ["spcPts", "20116801", undefined],
    ["spcPct", "0", "0"],
    ["spcPct", "175000", "1.75"],
    ["spcPct", "13200000", "132"],
    ["spcPct", "13200001", undefined],
    ["spcPct", "-1", undefined],
    ["spcPts", "1e3", undefined],
    ["spcPts", "1.5", undefined],
  ])("%s=%s行距使用固定pt或无单位倍数", (name, value, expected) => {
    const source = property(`<a:lnSpc><a:${name} val="${value}"/></a:lnSpc>`),
      xml = new XMLSerializer().serializeToString(source);
    expect(presentationTextParagraphLineHeight(source)).toBe(expected);
    expect(new XMLSerializer().serializeToString(source)).toBe(xml);
  });

  it("段距使用同源pt/lh，未知或超范围属性不注入CSS", () => {
    expect(
      presentationTextParagraphStyles(
        property(
          '<a:spcBef><a:spcPct val="125000"/></a:spcBef><a:spcAft><a:spcPts val="375"/></a:spcAft>',
          'algn="r" marL="12700" marR="25400" indent="-6350"',
        ),
      ),
    ).toEqual({
      "text-align": "right",
      "margin-left": "1pt",
      "margin-right": "2pt",
      "text-indent": "-0.5pt",
      "margin-top": "1.25lh",
      "margin-bottom": "3.75pt",
    });
    expect(
      presentationTextParagraphStyles(
        property(
          '<a:spcBef><a:spcPct val="13200001"/></a:spcBef><a:spcAft><a:spcPts val="-1"/></a:spcAft>',
          'algn="dist" marL="2147483648" marR="not-a-number" indent="1.1"',
        ),
      ),
    ).toEqual({});
    expect(presentationTextParagraphLineHeight(undefined)).toBeUndefined();
  });

  it.each([
    '<a:buAutoNum type="unknown"/>',
    '<a:buAutoNum type="arabicPeriod" startAt="0"/>',
    '<a:buAutoNum type="arabicPeriod" startAt="32768"/>',
    '<a:buAutoNum type="arabicPeriod" startAt="2.5"/>',
    '<a:buChar char="☞"/>',
    "<a:buBlip/>",
    "<a:buNone/>",
  ])("不猜测未知或不可表达的列表 %s", (content) => {
    const source = property(content),
      xml = new XMLSerializer().serializeToString(source);
    expect(presentationTextParagraphList(source)).toBeUndefined();
    expect(new XMLSerializer().serializeToString(source)).toBe(xml);
  });

  it("嵌套bullet不清外层编号，显式起点及普通段落重启，渲染间无共享状态", () => {
    const sources = [
      property('<a:buAutoNum type="arabicPeriod" startAt="4"/>'),
      property('<a:buChar char="•"/>', 'lvl="1"'),
      property('<a:buAutoNum type="arabicPeriod"/>'),
      property('<a:buAutoNum type="arabicPeriod" startAt="9"/>'),
      property('<a:buAutoNum type="arabicPeriod"/>'),
      undefined,
      property('<a:buAutoNum type="arabicPeriod"/>'),
    ];
    const project = () =>
      presentationTextParagraphMarkers(sources).map((list) => list?.ordinal);
    expect(project()).toEqual([4, undefined, 5, 9, 10, undefined, 1]);
    expect(project()).toEqual([4, undefined, 5, 9, 10, undefined, 1]);
  });
});
