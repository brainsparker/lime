import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { DocxPageView } from "./DocxPageView";

describe("DOCX 同页定位与受限文档", () => {
  let root: Root;
  let container: HTMLDivElement;
  const annotate = vi.fn();
  const focus = vi.fn();
  const ready = vi.fn();
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    await changeLimeLocale("zh-CN");
    annotate.mockReset();
    focus.mockReset();
    ready.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });
  const show = async (commentMode = true) => {
    await act(async () =>
      root.render(
        <DocxPageView
          html="<section>inert</section>"
          title="Report.docx"
          pageNumber={2}
          pageCount={2}
          pageWidth={600}
          scale={0.5}
          commentMode={commentMode}
          onAnnotate={annotate}
          onReady={ready}
          annotations={[
            {
              id: "note1",
              label: 1,
              anchor: { kind: "point", point: { x: 100, y: 200 } },
            },
          ]}
          onFocusAnnotation={focus}
        />,
      ),
    );
    const frame = container.querySelector("iframe")!;
    const document = frame.contentDocument!;
    document.body.innerHTML =
      '<section class="docx" data-docx-page="2"><p>SELECTED_WORDS</p><a href="https://example.invalid">link</a></section>';
    const page = document.querySelector<HTMLElement>("section")!;
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue(
      new DOMRect(10, 20, 300, 400),
    );
    await act(async () => frame.dispatchEvent(new Event("load")));
    return { frame, document, page };
  };

  it("只有对应页形成布局后 ready；定位换算为 scale1，marker 不产生新批注", async () => {
    const { frame, page } = await show();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-same-origin allow-popups",
    );
    expect(frame.getAttribute("sandbox")).not.toContain("allow-scripts");
    await act(async () =>
      page.dispatchEvent(
        new MouseEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: 60,
          clientY: 120,
        }),
      ),
    );
    expect(annotate).toHaveBeenCalledExactlyOnceWith({
      pageNumber: 2,
      pageSize: { width: 600, height: 800 },
      anchor: { kind: "point", point: { x: 100, y: 200 } },
    });
    const marker = page.querySelector<HTMLButtonElement>("button")!;
    expect(marker.onclick).toBeNull();
    expect(page.onclick).toBeNull();
    await act(async () => {
      marker.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
      marker.click();
    });
    expect(focus).toHaveBeenCalledExactlyOnceWith("note1");
    expect(annotate).toHaveBeenCalledTimes(1);
  });

  it("真实 DOM Selection 先请求修改再形成批注，保留选区及坐标；卸载后旧页不响应", async () => {
    const { document, page } = await show(false);
    const text = page.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    Object.defineProperty(range, "getClientRects", {
      value: () => [new DOMRect(20, 40, 100, 10)],
    });
    document.getSelection()!.addRange(range);
    await act(async () =>
      page.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })),
    );
    expect(annotate).not.toHaveBeenCalled();
    const ask = Array.from(page.querySelectorAll("button")).find(
      (button) => button.textContent === "要求修改",
    )!;
    expect(ask.onclick).toBeNull();
    expect(page.onclick).toBeNull();
    await act(async () => ask.click());
    expect(annotate).toHaveBeenCalledExactlyOnceWith({
      pageNumber: 2,
      pageSize: { width: 600, height: 800 },
      anchor: {
        kind: "region",
        selectedText: "SELECTED_WORDS",
        selectionKind: "text",
        rect: { x: 20, y: 40, width: 200, height: 20 },
        selectionRects: [{ x: 20, y: 40, width: 200, height: 20 }],
      },
    });
    expect(document.getSelection()!.rangeCount).toBe(0);
    await act(async () => root.render(null));
    page.dispatchEvent(
      new MouseEvent("pointerup", { bubbles: true, clientX: 50, clientY: 60 }),
    );
    expect(annotate).toHaveBeenCalledTimes(1);
  });

  it("非批注模式、链接和非主按键均不会创建定位", async () => {
    const { page } = await show(false);
    await act(async () => {
      page.dispatchEvent(
        new MouseEvent("pointerup", {
          bubbles: true,
          clientX: 60,
          clientY: 120,
        }),
      );
      page
        .querySelector("a")!
        .dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
      page.dispatchEvent(
        new MouseEvent("pointerup", { bubbles: true, button: 2 }),
      );
    });
    expect(annotate).not.toHaveBeenCalled();
  });

  it("同一文档翻页、缩放及接受批注后仍可选区；旧页不响应", async () => {
    const { frame, document, page: oldPage } = await show();
    const page = document.createElement("section");
    page.className = "docx";
    page.dataset.docxPage = "1";
    page.innerHTML = "<p>AFTER_ACCEPTANCE</p>";
    document.body.append(page);
    vi.spyOn(page, "getBoundingClientRect").mockReturnValue(
      new DOMRect(10, 20, 600, 800),
    );
    await act(async () =>
      root.render(
        <DocxPageView
          html="<section>inert</section>"
          title="Report.docx"
          pageNumber={1}
          pageCount={2}
          pageWidth={600}
          scale={1}
          commentMode={false}
          onAnnotate={annotate}
          onReady={ready}
          annotations={[]}
          onFocusAnnotation={focus}
        />,
      ),
    );
    expect(container.querySelector("iframe")).toBe(frame);
    expect(frame.contentDocument).toBe(document);
    expect(document.getElementById("docx-preview-view")?.textContent).toContain(
      'data-docx-page="1"]{display:block!important;zoom:1}',
    );
    expect(oldPage.querySelector("button")).toBeNull();
    oldPage.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    expect(annotate).not.toHaveBeenCalled();
    const range = document.createRange();
    range.selectNodeContents(page.querySelector("p")!);
    Object.defineProperty(range, "getClientRects", {
      value: () => [new DOMRect(20, 40, 100, 10)],
    });
    document.getSelection()!.addRange(range);
    await act(async () =>
      page.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })),
    );
    const ask = Array.from(page.querySelectorAll("button")).find(
      (button) => button.textContent === "要求修改",
    )!;
    expect(ask).toBeDefined();
    await act(async () => ask.click());
    expect(annotate).toHaveBeenCalledExactlyOnceWith({
      pageNumber: 1,
      pageSize: { width: 600, height: 800 },
      anchor: {
        kind: "region",
        selectedText: "AFTER_ACCEPTANCE",
        selectionKind: "text",
        rect: { x: 10, y: 20, width: 100, height: 10 },
        selectionRects: [{ x: 10, y: 20, width: 100, height: 10 }],
      },
    });
  });
});
