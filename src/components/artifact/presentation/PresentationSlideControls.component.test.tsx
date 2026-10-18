import { webcrypto } from "node:crypto";
import JSZip from "jszip";
import { act, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { PresentationController } from "./PresentationController";
import { PresentationEditingControls } from "./PresentationEditingControls";
import { importPresentationDocument } from "./presentationDocument";
import {
  presentationElements,
  presentationElementText,
} from "./presentationElements";
import {
  p,
  r,
  ct,
  blankLayout,
  titleLayout,
  sourcePath,
  fixture,
  original,
  relPath,
  setXml,
  target,
  slidePath,
  xml,
} from "./presentationSlidesPackage.testFixtures";

function Controls({ controller }: { controller: PresentationController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  return (
    <PresentationEditingControls
      controller={controller}
      state={state}
      onDiscard={() => undefined}
    />
  );
}

describe("PresentationSlideControls 真实Controller与OOXML结构操作", () => {
  let root: Root;
  let container: HTMLDivElement;
  let controller: PresentationController;
  let disk: Uint8Array;
  let writes: number;
  const group = () => container.querySelector<HTMLElement>('[role="group"]')!;
  const button = (name: string, parent: HTMLElement = group()) =>
    Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find(
      (node) => node.textContent === name,
    )!;
  const select = () => group().querySelector<HTMLSelectElement>("select")!;
  const waitFor = async (check: () => void) => {
    const deadline = Date.now() + 1500;
    let failure: unknown;
    do {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      try {
        check();
        return;
      } catch (error) {
        failure = error;
      }
    } while (Date.now() < deadline);
    throw failure;
  };
  const mount = async (
    bytes: Uint8Array,
    options: { editing?: boolean; read?: () => Promise<Uint8Array> } = {},
  ) => {
    disk = bytes.slice();
    const document = await importPresentationDocument(
      bytes,
      new AbortController().signal,
    );
    controller = new PresentationController(
      "/workspace/structure.pptx",
      document,
      {
        read: options.read ?? (async () => disk.slice()),
        write: async (_path, bytes) => {
          disk = bytes.slice();
          writes++;
        },
      },
    );
    controller.setEditingEnabled(options.editing ?? true);
    await act(async () => root.render(<Controls controller={controller} />));
  };
  const ready = () => waitFor(() => expect(select().disabled).toBe(false));
  const click = async (name: string) => {
    await act(async () => {
      button(name).click();
      expect(await controller.flushEdits()).toBe(true);
    });
  };
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("crypto", webcrypto);
    await changeLimeLocale("zh-CN");
    writes = 0;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("通过编辑工具栏挂载，继承当前真实版式；选择真实blank后新增、保存、重开仍为真实新页", async () => {
    await mount(await fixture());
    await ready();
    expect(group().getAttribute("aria-label")).toBe("幻灯片操作");
    expect(select().getAttribute("aria-label")).toBe("新增版式");
    expect(
      Array.from(select().options, (option) => option.textContent),
    ).toEqual([
      "当前版式（或空白）",
      "Title layout — Office master",
      "Blank layout — Office master",
    ]);
    await click("新增幻灯片");
    const inheritedId = controller.getSnapshot().selectedSlideId;
    expect(controller.getSnapshot().document.slideIds).toEqual([
      "512",
      inheritedId,
      "900",
      "300",
    ]);
    let zip = await JSZip.loadAsync(
      controller.getSnapshot().document.sourceBytes,
    );
    expect(
      await target(zip, await slidePath(zip, inheritedId), `${r}/slideLayout`),
    ).toBe(titleLayout);
    await ready();
    await act(async () => {
      select().value = blankLayout;
      select().dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("新增幻灯片");
    const blankId = controller.getSnapshot().selectedSlideId;
    expect(controller.getSnapshot().document.slideIds).toEqual([
      "512",
      inheritedId,
      blankId,
      "900",
      "300",
    ]);
    zip = await JSZip.loadAsync(controller.getSnapshot().document.sourceBytes);
    const blankPath = await slidePath(zip, blankId);
    expect(await target(zip, blankPath, `${r}/slideLayout`)).toBe(blankLayout);
    expect(
      xml(await zip.file(blankPath)!.async("string")).getElementsByTagNameNS(
        p,
        "sp",
      ),
    ).toHaveLength(0);
    await act(async () => {
      button("保存", container).click();
      expect(await controller.flushPublicFile()).toBe(true);
    });
    expect(writes).toBe(1);
    const reopened = await importPresentationDocument(
      disk,
      new AbortController().signal,
    );
    expect(reopened.slideIds).toEqual([
      "512",
      inheritedId,
      blankId,
      "900",
      "300",
    ]);
    expect(reopened.model.slides).toHaveLength(5);
  });

  it("复制、前后移动和删除都作用于当前真实slideId，并保持原稿内容", async () => {
    await mount(await fixture());
    await ready();
    expect(button("前移幻灯片").disabled).toBe(true);
    await click("复制幻灯片");
    const copyId = controller.getSnapshot().selectedSlideId;
    expect(controller.getSnapshot().document.slideIds).toEqual([
      "512",
      copyId,
      "900",
      "300",
    ]);
    expect(
      presentationElements(controller.getSnapshot().document, copyId).map(
        presentationElementText,
      ),
    ).toContain("SLIDE_PREVIEW_01");
    await click("前移幻灯片");
    expect(controller.getSnapshot().selectedSlideId).toBe(copyId);
    expect(controller.getSnapshot().document.slideIds).toEqual([
      copyId,
      "512",
      "900",
      "300",
    ]);
    expect(button("前移幻灯片").disabled).toBe(true);
    await click("后移幻灯片");
    expect(controller.getSnapshot().selectedSlideId).toBe(copyId);
    expect(controller.getSnapshot().document.slideIds).toEqual([
      "512",
      copyId,
      "900",
      "300",
    ]);
    await click("删除幻灯片");
    expect(controller.getSnapshot().document.slideIds).toEqual([
      "512",
      "900",
      "300",
    ]);
    expect(controller.getSnapshot().selectedSlideId).toBe("900");
    expect(
      presentationElements(controller.getSnapshot().document, "512").map(
        presentationElementText,
      ),
    ).toContain("SLIDE_PREVIEW_01");
  });

  it("切换文件Controller不沿用旧文件的版式选择，也不接受旧异步列表", async () => {
    await mount(await fixture());
    await ready();
    await act(async () => {
      select().value = blankLayout;
      select().dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(select().value).toBe(blankLayout);
    await mount(await fixture());
    await ready();
    expect(select().value).toBe("");
    await click("新增幻灯片");
    const state = controller.getSnapshot();
    const zip = await JSZip.loadAsync(state.document.sourceBytes);
    expect(
      await target(
        zip,
        await slidePath(zip, state.selectedSlideId),
        `${r}/slideLayout`,
      ),
    ).toBe(titleLayout);
    await mount(original());
    await waitFor(() => expect(group().textContent).toContain("没有可用版式"));
    expect(select().options).toHaveLength(1);
    expect(button("新增幻灯片").disabled).toBe(true);
  });

  it("末页删除禁用并给出原因；首尾移动根据当前页序禁用", async () => {
    await mount(await fixture());
    await ready();
    await act(async () => controller.setSelectedSlideIdx(2));
    expect(button("后移幻灯片").disabled).toBe(true);
    await click("删除幻灯片");
    await click("删除幻灯片");
    expect(controller.getSnapshot().document.slideIds).toEqual(["512"]);
    expect(button("删除幻灯片").disabled).toBe(true);
    expect(button("删除幻灯片").title).toBe("至少保留一张幻灯片。");
    expect(button("前移幻灯片").disabled).toBe(true);
    expect(button("后移幻灯片").disabled).toBe(true);
    expect(button("复制幻灯片").disabled).toBe(false);
    expect(group().textContent).toContain("至少保留一张幻灯片。");
  });

  it("只读不显示结构控件，进入和退出编辑遵循同一Controller状态", async () => {
    await mount(await fixture(), { editing: false });
    expect(group()).toBeNull();
    await act(async () => button("编辑", container).click());
    await ready();
    expect(group()).not.toBeNull();
    await act(async () => button("结束编辑", container).click());
    expect(group()).toBeNull();
    expect(controller.getSnapshot().isEditing).toBe(false);
  });

  it("真实重投影期间所有结构动作禁用，完成后恢复", async () => {
    await mount(await fixture());
    await ready();
    await act(async () => {
      flushSync(() => button("复制幻灯片").click());
      expect(controller.getSnapshot().projecting).toBe(true);
      for (const node of group().querySelectorAll<HTMLButtonElement>("button"))
        expect(node.disabled).toBe(true);
      expect(select().disabled).toBe(true);
      expect(await controller.flushEdits()).toBe(true);
    });
    await ready();
    expect(button("复制幻灯片").disabled).toBe(false);
  });

  it("真实文件保存等待期间结构动作与版式选择禁用，完成后恢复", async () => {
    const input = await fixture();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mount(input, {
      read: async () => {
        await gate;
        return input;
      },
    });
    await ready();
    await click("复制幻灯片");
    await ready();
    let saving!: Promise<boolean>;
    await act(async () => {
      saving = controller.flushPublicFile();
    });
    expect(controller.getSnapshot().saving).toBe(true);
    for (const node of group().querySelectorAll<HTMLButtonElement>("button"))
      expect(node.disabled).toBe(true);
    expect(select().disabled).toBe(true);
    await act(async () => {
      release();
      expect(await saving).toBe(true);
    });
    await ready();
    expect(writes).toBe(1);
    expect(button("复制幻灯片").disabled).toBe(false);
  });

  it("没有真实layout时阻止新增并明确说明，复制仍创建真实副本", async () => {
    await mount(original());
    await waitFor(() => expect(group().textContent).toContain("没有可用版式"));
    expect(button("新增幻灯片").disabled).toBe(true);
    expect(select().disabled).toBe(true);
    expect(button("复制幻灯片").disabled).toBe(false);
    expect(button("后移幻灯片").disabled).toBe(false);
    expect(button("删除幻灯片").disabled).toBe(false);
    expect(button("新增幻灯片").getAttribute("aria-describedby")).toBe(
      group().querySelector('[role="status"]')!.id,
    );
    await click("复制幻灯片");
    expect(controller.getSnapshot().document.slideIds).toHaveLength(4);
    const newId = controller.getSnapshot().selectedSlideId;
    expect(newId).not.toBe("512");
    expect(
      presentationElements(controller.getSnapshot().document, newId).map(
        presentationElementText,
      ),
    ).toContain("SLIDE_PREVIEW_01");
  });

  it("真实layout读取失败有可见终态，保留复制/排序/删除入口", async () => {
    const zip = await JSZip.loadAsync(await fixture());
    await setXml(zip, "[Content_Types].xml", (document) => {
      Array.from(document.getElementsByTagNameNS(ct, "Override"))
        .find((node) => node.getAttribute("PartName") === `/${titleLayout}`)!
        .setAttribute("ContentType", "application/xml");
    });
    await mount(await zip.generateAsync({ type: "uint8array" }));
    await waitFor(() => expect(group().textContent).toContain("无法读取版式"));
    expect(button("新增幻灯片").disabled).toBe(true);
    expect(button("复制幻灯片").disabled).toBe(false);
    expect(button("后移幻灯片").disabled).toBe(false);
    expect(button("删除幻灯片").disabled).toBe(false);
    expect(container.textContent).not.toContain(
      "workspace.presentationSlides.",
    );
  });

  it("当前无layout且没有真实blank时新增失败保稿，不能暗中复制或替换为任意layout", async () => {
    const zip = await JSZip.loadAsync(await fixture({ noBlank: true }));
    await setXml(zip, relPath(sourcePath), (document) => {
      Array.from(document.documentElement.children)
        .find((node) => node.getAttribute("Id") === "layout")!
        .remove();
    });
    await mount(await zip.generateAsync({ type: "uint8array" }));
    await ready();
    await act(async () => {
      button("新增幻灯片").click();
      expect(await controller.flushEdits()).toBe(false);
    });
    expect(controller.getSnapshot().document.slideIds).toEqual([
      "512",
      "900",
      "300",
    ]);
    expect(controller.getSnapshot().selectedSlideId).toBe("512");
    expect(controller.getSnapshot().failure).toBe("invalidEdit");
    expect(controller.getSnapshot().dirty).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "此修改无法应用到原文件",
    );
    expect(writes).toBe(0);
  });

  it.each([
    ["zh-CN", "幻灯片操作", "新增版式", "复制幻灯片"],
    ["zh-TW", "投影片操作", "新增版面配置", "複製投影片"],
    ["en-US", "Slide actions", "New slide layout", "Duplicate slide"],
    ["ja-JP", "スライドの操作", "追加するレイアウト", "スライドを複製"],
    ["ko-KR", "슬라이드 작업", "새 슬라이드 레이아웃", "슬라이드 복제"],
  ] as const)(
    "%s 结构动作名称和label翻译完整，真实复制仍接同一Controller",
    async (locale, actions, layout, duplicate) => {
      await changeLimeLocale(locale);
      await mount(await fixture());
      await ready();
      expect(group().getAttribute("aria-label")).toBe(actions);
      expect(select().getAttribute("aria-label")).toBe(layout);
      expect(container.textContent).not.toContain(
        "workspace.presentationSlides.",
      );
      expect(group().querySelectorAll("button")).toHaveLength(5);
      await click(duplicate);
      expect(controller.getSnapshot().document.slideIds).toHaveLength(4);
    },
  );
});
