import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import {
  ArtifactCommentSubmissionContext,
  type ArtifactCommentSubmission,
} from "../ArtifactCommentSubmissionContext";
import { ArtifactAnnotationDraftStore } from "./ArtifactAnnotationDraftStore";
import { ArtifactAnnotationComposerAccessory } from "./ArtifactAnnotationComposerAccessory";
import { submitArtifactAnnotationBatch } from "./artifactAnnotationSubmission";

const comment = (id: string, path = "/workspace/report.docx") => ({
  id,
  path,
  format: "docx" as const,
  sourceSha256: "a".repeat(64),
  pageNumber: id === "note2" ? 2 : 1,
  pageCount: 2,
  pageSize: { width: 600, height: 800 },
  anchor: { kind: "point" as const, point: { x: 100, y: 200 } },
});

describe("主 Composer 文档批注入口", () => {
  let root: Root;
  let container: HTMLDivElement;
  let drafts: ArtifactAnnotationDraftStore;
  let submission: ArtifactCommentSubmission;
  let submit: ReturnType<typeof vi.fn<ArtifactCommentSubmission["submit"]>>;
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    await changeLimeLocale("zh-CN");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    drafts = new ArtifactAnnotationDraftStore();
    submit = vi
      .fn<ArtifactCommentSubmission["submit"]>()
      .mockResolvedValue("accepted");
    submission = {
      scopeKey: "s1:t1:epoch1",
      draftScopeKey: "s1:t1",
      drafts,
      submit,
      openComment: vi.fn(),
    };
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    await changeLimeLocale("zh-CN");
  });
  const add = (id: string, path?: string, scope = "s1:t1") => {
    drafts.create(scope, comment(id, path));
    const draft = drafts
      .getSnapshot()
      .find((draft) => draft.comment.id === id)!;
    draft.controller.setText(`正文 ${id}`);
    return draft;
  };
  const show = async (value: ArtifactCommentSubmission | null = submission) => {
    await act(async () =>
      root.render(
        <ArtifactCommentSubmissionContext.Provider value={value}>
          <ArtifactAnnotationComposerAccessory />
        </ArtifactCommentSubmissionContext.Provider>,
      ),
    );
  };
  const button = (label: string) =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === label,
    )!;

  it("按会话和文件分组，审阅仅导航对应批注，取消只移除当前文件", async () => {
    add("note1");
    add("note2");
    add("other", "/workspace/other.docx");
    add("foreign", undefined, "s2:t2");
    await show();
    expect(container.querySelectorAll("section")).toHaveLength(2);
    expect(container.textContent).not.toContain("foreign");
    await act(async () => button("report.docx · 2 条批注").click());
    const review = [
      ...container.querySelectorAll<HTMLButtonElement>("li button"),
    ];
    expect(review.map((button) => button.textContent)).toEqual([
      "第 1 页正文 note1",
      "第 2 页正文 note2",
    ]);
    await act(async () => review[1].click());
    expect(submission.openComment).toHaveBeenCalledExactlyOnceWith("note2");
    expect(submit).not.toHaveBeenCalled();
    await act(async () => button("取消全部批注").click());
    expect(drafts.getSnapshot().map((draft) => draft.comment.id)).toEqual([
      "other",
      "foreign",
    ]);
  });

  it.each([
    ["zh-CN", "发送全部批注"],
    ["zh-TW", "傳送全部註解"],
    ["en-US", "Send all annotations"],
    ["ja-JP", "すべてのコメントを送信"],
    ["ko-KR", "모든 주석 보내기"],
  ] as const)(
    "%s 失败保稿并可重试；一次接受只清当前文件",
    async (locale, label) => {
      await changeLimeLocale(locale);
      add("note1");
      add("note2");
      add("foreign", undefined, "s2:t2");
      submit.mockResolvedValueOnce("file-changed");
      await show();
      await act(async () => button(label).click());
      expect(container.querySelector("[role=alert]")?.textContent).toBeTruthy();
      expect(
        drafts.getSnapshot().filter((draft) => draft.failure === "fileChanged"),
      ).toHaveLength(2);
      await act(async () => button(label).click());
      expect(submit).toHaveBeenCalledTimes(2);
      expect(submit.mock.calls[0][0]).toMatchObject({
        comments: [
          { id: "note1", body: "正文 note1" },
          { id: "note2", body: "正文 note2" },
        ],
      });
      expect(drafts.getSnapshot().map((draft) => draft.comment.id)).toEqual([
        "foreign",
      ]);
      expect(
        container.querySelector(
          '[data-testid="composer-annotation-accessory"]',
        ),
      ).toBeNull();
    },
  );

  it("文档浮层与主入口并发仅发送一次，迟到接受保留新 revision", async () => {
    const first = add("note1");
    add("note2");
    let resolve!: (value: "accepted") => void;
    submit.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await show();
    await act(async () => {
      button("发送全部批注").click();
      await submitArtifactAnnotationBatch({
        submission,
        drafts: drafts.getSnapshot(),
        isCurrent: () => true,
      });
    });
    expect(submit).toHaveBeenCalledOnce();
    expect(
      [...container.querySelectorAll("button")].filter(
        (button) => button.disabled,
      ),
    ).toHaveLength(2);
    await act(async () => {
      first.controller.setText("在途新输入");
      resolve("accepted");
    });
    expect(drafts.getSnapshot()).toHaveLength(1);
    expect(first.controller.getDocument().text).toBe("在途新输入");
  });

  it("导航切换后旧入口的文件验证不能继续提交，空上下文不显示入口", async () => {
    add("note1");
    let captured:
      | Parameters<ArtifactCommentSubmission["submit"]>[0]
      | undefined;
    let resolve!: (value: "canceled") => void;
    submit.mockImplementationOnce((request) => {
      captured = request;
      return new Promise((done) => {
        resolve = done;
      });
    });
    await show();
    await act(async () => button("发送全部批注").click());
    expect(captured!.isCurrent()).toBe(true);
    await show({
      ...submission,
      scopeKey: "s2:t2:epoch2",
      draftScopeKey: "s2:t2",
    });
    expect(captured!.isCurrent()).toBe(false);
    await act(async () => resolve("canceled"));
    expect(drafts.getSnapshot()[0].controller.getDocument().text).toBe(
      "正文 note1",
    );
    expect(drafts.getSnapshot()[0].pending).toBe(false);
    await show(null);
    expect(container.textContent).toBe("");
  });
});
