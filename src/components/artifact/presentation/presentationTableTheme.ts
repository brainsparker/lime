import {
  buildPresentation,
  type PptxFiles,
  type PresentationData,
  type SlideData,
  type SlideNode,
} from "@aiden0z/pptx-renderer";
import {
  a,
  p,
  r,
  relationships,
  children,
  one,
  fail,
  resolvePartTarget,
} from "./presentationPackageXml";
import { materializeTableStyleLines } from "./presentationTableLine";
import { colorHex } from "./presentationTableColor";
import { presentationTableStyleProjection } from "./presentationTableStyleDefinition";

const sources = new WeakMap<PresentationData, ReadonlyMap<string, string>>();
const colors = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
];
const components = ["clrScheme", "fontScheme", "fmtScheme"] as const;

/** 只投影不可变源 XML；不保留 zip、媒体或另一个可变业务模型。 */
export function registerPresentationTableThemeSources(
  model: PresentationData,
  files: PptxFiles,
): void {
  sources.set(
    model,
    new Map([...files.themes, ...(files.themeOverrides ?? [])]),
  );
}

function xmlRoot(source: string): Element {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) fail("table theme XML declaration");
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror")) fail("table theme XML");
  return document.documentElement;
}
function required(parent: Element, name: string): Element {
  const child = one(parent, a, name);
  if (!child) fail(`missing table theme ${name}`);
  return child;
}

function validateComponent(component: Element): void {
  const names =
    component.localName === "clrScheme"
      ? [...colors, "extLst"]
      : component.localName === "fontScheme"
        ? ["majorFont", "minorFont", "extLst"]
        : ["fillStyleLst", "lnStyleLst", "effectStyleLst", "bgFillStyleLst"];
  if (
    Array.from(component.children).some(
      (child) => child.namespaceURI !== a || !names.includes(child.localName),
    )
  )
    fail("unsupported table theme component");
  if (component.localName === "clrScheme") {
    for (const name of colors) {
      const color = required(component, name);
      const values = Array.from(color.children).filter(
        (child) => child.namespaceURI === a,
      );
      if (
        values.length !== 1 ||
        ![
          "srgbClr",
          "scrgbClr",
          "hslClr",
          "sysClr",
          "schemeClr",
          "prstClr",
        ].includes(values[0].localName)
      )
        fail("unsupported table theme color scheme");
    }
  } else if (component.localName === "fontScheme") {
    for (const name of ["majorFont", "minorFont"]) {
      const fonts = required(component, name);
      for (const kind of ["latin", "ea", "cs"]) {
        const font = required(fonts, kind);
        if (!font.hasAttribute("typeface"))
          fail("missing table theme font typeface");
      }
      if (
        Array.from(fonts.children).some(
          (child) =>
            child.namespaceURI !== a ||
            !["latin", "ea", "cs", "font", "extLst"].includes(child.localName),
        )
      )
        fail("unsupported table theme font scheme");
    }
  } else {
    for (const [name, kinds] of [
      [
        "fillStyleLst",
        ["noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill"],
      ],
      ["lnStyleLst", ["ln"]],
      ["effectStyleLst", ["effectStyle"]],
      [
        "bgFillStyleLst",
        ["noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill"],
      ],
    ] as const) {
      const list = required(component, name),
        entries = Array.from(list.children);
      if (
        entries.length < 3 ||
        entries.some(
          (entry) =>
            entry.namespaceURI !== a ||
            !(kinds as readonly string[]).includes(entry.localName),
        )
      )
        fail("unsupported table theme format scheme");
    }
  }
}

/** Theme override 以可选的完整组件替换，缺失组件继承；不逐色/逐line拼接。 */
export function mergePresentationTheme(
  base: Element | undefined,
  overrides: readonly Element[],
): Element | undefined {
  if (!overrides.length) return base;
  if (!base || base.namespaceURI !== a || base.localName !== "theme")
    fail("missing base table theme");
  const clone = base.cloneNode(true) as Element,
    elements = required(clone, "themeElements");
  for (const override of overrides) {
    if (
      override.namespaceURI !== a ||
      override.localName !== "themeOverride" ||
      Array.from(override.children).some(
        (child) =>
          child.namespaceURI !== a ||
          !components.includes(child.localName as (typeof components)[number]),
      )
    )
      fail("unsupported table theme override");
    for (const name of components) {
      const component = one(override, a, name);
      if (!component) continue;
      validateComponent(component);
      const previous = one(elements, a, name),
        replacement = clone.ownerDocument.importNode(component, true);
      if (previous) previous.replaceWith(replacement);
      else elements.append(replacement);
    }
  }
  validateThemeColors(clone);
  return clone;
}

function validateThemeColors(root: Element): Map<string, string> {
  const { theme } = presentationThemeContext(root),
    result = new Map<string, string>();
  for (const [name, color] of theme) {
    if (
      Array.from(color.children).some(
        (child) =>
          child.namespaceURI === a &&
          ["alpha", "alphaMod", "alphaOff"].includes(child.localName),
      )
    )
      fail("unsupported table theme color alpha");
    result.set(name, colorHex(color, theme, new Map()));
  }
  return result;
}

export function presentationThemeContext(root: Element | undefined): {
  theme: Map<string, Element>;
  lineStyles: Element[];
} {
  const elements = root && one(root, a, "themeElements"),
    scheme = elements && one(elements, a, "clrScheme"),
    theme = new Map<string, Element>();
  for (const entry of Array.from(scheme?.children ?? [])) {
    const values = Array.from(entry.children).filter(
      (child) => child.namespaceURI === a,
    );
    if (values.length > 1) fail("ambiguous table theme color");
    if (values[0]) theme.set(entry.localName, values[0]);
  }
  const format = elements && one(elements, a, "fmtScheme"),
    lines = format && one(format, a, "lnStyleLst");
  return { theme, lineStyles: lines ? children(lines, a, "ln") : [] };
}

function overridePath(
  sourcePath: string,
  rels: ReadonlyMap<
    string,
    { type: string; target: string; targetMode?: string }
  >,
): string | undefined {
  const matches = [...rels.values()].filter(
    (entry) => entry.type === `${r}/themeOverride`,
  );
  if (matches.length > 1) fail("ambiguous table theme override relationship");
  const entry = matches[0];
  if (!entry) return undefined;
  if ((entry.targetMode ?? "Internal").toLowerCase() !== "internal")
    fail("external table theme override relationship");
  return resolvePartTarget(sourcePath, entry.target);
}

export function modelPresentationTheme(
  model: PresentationData,
  slide: SlideData,
): {
  root?: Element;
  basePath?: string;
  overridden: boolean;
  masterPath?: string;
} {
  const layoutPath = model.slideToLayout.get(slide.index) ?? slide.layoutIndex,
    masterPath = model.layoutToMaster.get(layoutPath);
  const layout = model.layouts.get(layoutPath),
    master = masterPath ? model.masters.get(masterPath) : undefined;
  const basePath = masterPath
    ? model.masterToTheme.get(masterPath)
    : model.themes.size === 1
      ? [...model.themes.keys()][0]
      : undefined;
  const paths: string[] = [];
  for (const [path, source] of [
    [masterPath, master],
    [layoutPath, layout],
    [slide.slidePath, slide],
  ] as const) {
    if (!path || !source) continue;
    const target = overridePath(path, source.rels);
    if (target) paths.push(target);
  }
  const registered = sources.get(model);
  const parse = (path: string) => {
    const source = registered?.get(path);
    if (source === undefined) fail("missing registered table theme XML");
    return xmlRoot(source);
  };
  if (!paths.length)
    return {
      root: basePath && registered?.has(basePath) ? parse(basePath) : undefined,
      basePath,
      overridden: false,
      masterPath,
    };
  if (!basePath) fail("missing base table theme identity");
  return {
    root: mergePresentationTheme(parse(basePath), paths.map(parse)),
    basePath,
    overridden: true,
    masterPath,
  };
}

function publicProjection(
  root: Element,
  path: string,
  styles?: Element,
): PresentationData {
  const empty = () => new Map<string, string>();
  const model = buildPresentation({
    contentTypes: "",
    presentation: `<p:presentation xmlns:p="${p}"><p:sldIdLst/><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`,
    presentationRels: `<Relationships xmlns="${relationships}"/>`,
    slides: empty(),
    slideRels: empty(),
    slideLayouts: empty(),
    slideLayoutRels: empty(),
    slideMasters: empty(),
    slideMasterRels: empty(),
    themes: new Map([[path, new XMLSerializer().serializeToString(root)]]),
    tableStyles: styles
      ? new XMLSerializer().serializeToString(styles)
      : undefined,
    media: new Map(),
    charts: empty(),
    chartStyles: empty(),
    chartColors: empty(),
    diagramDrawings: empty(),
  });
  const theme = model.themes.get(path);
  if (!theme) fail("unable to project table theme");
  theme.colorScheme = validateThemeColors(root);
  return model;
}

/** 每次 render 使用派生 maps，原 model 和共享 master 的其他 slide 不变。 */
export function presentationThemeModel(
  model: PresentationData,
  slide: SlideData,
): PresentationData {
  const resolved = modelPresentationTheme(model, slide);
  const ids = new Set<string>();
  const collect = (nodes: readonly SlideNode[]) => {
    for (const node of nodes) {
      if (node.nodeType === "table" && node.tableStyleId)
        ids.add(node.tableStyleId);
      else if (node.nodeType === "group")
        for (const child of node.children)
          for (const id of Array.from(
            child.element?.getElementsByTagNameNS(a, "tableStyleId") ?? [],
          ))
            if (id.textContent?.trim()) ids.add(id.textContent.trim());
    }
  };
  collect(slide.nodes);
  const native = resolved.root
    ? presentationThemeContext(resolved.root)
    : undefined;
  const builtinStyles = presentationTableStyleProjection(
    model.tableStyles?.element ?? undefined,
    ids,
    !!resolved.masterPath && !!resolved.basePath && !!native?.theme.size,
  );
  const styles = ids.size
    ? (materializeTableStyleLines(
        builtinStyles ?? model.tableStyles?.element ?? undefined,
        native?.lineStyles ?? [],
      ) ?? builtinStyles)
    : undefined;
  if (!resolved.overridden && !styles) return model;
  if (!resolved.root || !resolved.basePath || !resolved.masterPath)
    fail("missing slide theme hierarchy");
  const projection = publicProjection(resolved.root, resolved.basePath, styles);
  const themes = new Map(model.themes),
    masterToTheme = new Map(model.masterToTheme);
  themes.set(resolved.basePath, projection.themes.get(resolved.basePath)!);
  masterToTheme.set(resolved.masterPath, resolved.basePath);
  return {
    ...model,
    themes,
    masterToTheme,
    tableStyles: projection.tableStyles ?? model.tableStyles,
  };
}
