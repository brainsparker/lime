import {
  buildPresentation,
  parseZip,
  RECOMMENDED_ZIP_LIMITS,
  renderSlide,
  type PresentationData,
  type SlideHandle,
} from "@aiden0z/pptx-renderer";
import { readFileBytes } from "@/lib/api/fileBrowser";
import { hashFileBytes } from "@/lib/artifact/fileRevision";
import {
  presentationThemeModel,
  registerPresentationTableThemeSources,
} from "./presentationTableTheme";
import { registerPresentationTextSources } from "./presentationTextDocument";

const presentationNamespace =
  "http://schemas.openxmlformats.org/presentationml/2006/main";
const relationshipNamespace =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const maxSlides = 1000;

export interface PresentationSnapshot {
  sourceSha256: string;
  sourceBytes: Uint8Array;
  slideIds: readonly string[];
  model: PresentationData;
}

function readXml(source: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error("Invalid presentation XML");
  const xml = new DOMParser().parseFromString(source, "application/xml");
  if (xml.querySelector("parsererror"))
    throw new Error("Invalid presentation XML");
  return xml;
}

export function readPresentationSlideIds(source: string): string[] {
  const xml = readXml(source);
  if (
    xml.documentElement.localName !== "presentation" ||
    xml.documentElement.namespaceURI !== presentationNamespace
  )
    throw new Error("Invalid presentation root");
  const list = xml.getElementsByTagNameNS(presentationNamespace, "sldIdLst");
  const ids =
    list.length === 1
      ? Array.from(list[0].children, (entry) => {
          const id = entry.getAttribute("id") ?? "";
          if (
            entry.localName !== "sldId" ||
            entry.namespaceURI !== presentationNamespace ||
            !/^[1-9][0-9]*$/.test(id) ||
            Number(id) < 256 ||
            Number(id) > 2147483647
          )
            throw new Error("Invalid presentation slide identity");
          return id;
        })
      : [];
  if (!ids.length || ids.length > maxSlides || new Set(ids).size !== ids.length)
    throw new Error("Invalid presentation slide inventory");
  return ids;
}

/** 专业预览不解析或自动请求文档声明的外部资源。 */
export function removeExternalPresentationRelationships(
  source: string,
): string {
  const xml = readXml(source);
  for (const relationship of Array.from(
    xml.getElementsByTagNameNS(relationshipNamespace, "Relationship"),
  )) {
    const target = relationship.getAttribute("Target") ?? "";
    if (
      relationship.getAttribute("TargetMode")?.toLowerCase() === "external" ||
      /^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i.test(target.trim())
    )
      relationship.remove();
  }
  return new XMLSerializer().serializeToString(xml);
}

export async function loadPresentationDocument(
  path: string,
  signal: AbortSignal,
): Promise<PresentationSnapshot> {
  const bytes = await readFileBytes(path);
  return importPresentationDocument(bytes, signal);
}

export async function importPresentationDocument(
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<PresentationSnapshot> {
  const check = () => signal.throwIfAborted();
  check();
  if (bytes.byteLength > 64 * 1024 * 1024)
    throw new Error("Presentation is too large");
  const sourceSha256 = await hashFileBytes(bytes);
  check();
  const files = await parseZip(bytes.slice().buffer as ArrayBuffer, {
    ...RECOMMENDED_ZIP_LIMITS,
    maxEntryUncompressedBytes: 32 * 1024 * 1024,
    maxTotalUncompressedBytes: 128 * 1024 * 1024,
    maxMediaBytes: 64 * 1024 * 1024,
    maxConcurrency: 2,
  });
  check();
  const slideIds = readPresentationSlideIds(files.presentation);
  const textSources = { ...files, slideRels: new Map(files.slideRels) };
  files.presentationRels = removeExternalPresentationRelationships(
    files.presentationRels,
  );
  for (const records of [
    files.slideRels,
    files.slideLayoutRels,
    files.slideMasterRels,
    files.chartRels,
  ]) {
    for (const [key, value] of records ?? [])
      records!.set(key, removeExternalPresentationRelationships(value));
  }
  const model = buildPresentation(files);
  registerPresentationTableThemeSources(model, files);
  check();
  if (
    model.slides.length !== slideIds.length ||
    !Number.isFinite(model.width) ||
    !Number.isFinite(model.height) ||
    model.width <= 0 ||
    model.height <= 0 ||
    model.width > 20000 ||
    model.height > 20000
  )
    throw new Error("Invalid presentation dimensions or slides");
  const snapshot = {
    sourceSha256,
    sourceBytes: bytes.slice(),
    slideIds,
    model,
  };
  registerPresentationTextSources(snapshot, textSources);
  return snapshot;
}

export function renderPresentationSlide(
  snapshot: PresentationSnapshot,
  index: number,
): SlideHandle {
  const slide = snapshot.model.slides[index];
  if (!slide || !snapshot.slideIds[index])
    throw new Error("Invalid presentation slide");
  return renderSlide(presentationThemeModel(snapshot.model, slide), slide, {
    pdfjs: false,
    // 链接和动作不拥有宿主导航；只读预览不会自动打开外部资源。
    onNavigate: () => undefined,
  });
}

/** 保留已绘制的canvas/SVG，移除活动节点与文档导航。 */
export function sanitizePresentationSlide(element: HTMLElement): void {
  for (const blocked of element.querySelectorAll(
    "script,iframe,object,embed,form,link,meta,base,foreignObject,audio,video",
  ))
    blocked.remove();
  for (const node of [element, ...element.querySelectorAll("*")]) {
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      if (
        /^(?:href|xlink:href|src|srcset|action|formaction|target)$/i.test(
          attribute.name,
        )
      ) {
        const embedded =
          /^(?:img|image)$/i.test(node.localName) &&
          /^(?:blob:|data:image\/)/i.test(attribute.value) &&
          /^(?:src|href|xlink:href)$/i.test(attribute.name);
        const localSvgReference =
          /^(?:href|xlink:href)$/i.test(attribute.name) &&
          /^#[a-z0-9_-]+$/i.test(attribute.value);
        if (!embedded && !localSvgReference)
          node.removeAttribute(attribute.name);
      }
    }
  }
}

export const presentationFrameHtml = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src blob: data:; font-src blob: data:; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;background:#fff;color:#000}body{overflow:auto}#slide{position:relative;transform-origin:top left}a{pointer-events:none}</style></head><body><div id="slide"></div></body></html>`;
