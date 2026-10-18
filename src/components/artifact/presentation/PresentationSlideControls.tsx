import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import type {
  PresentationController,
  PresentationControllerState,
} from "./PresentationController";
import {
  readPresentationSlideTemplates,
  type PresentationSlideTemplate,
} from "./presentationSlidesPackage";

const button =
  "inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

type Templates = {
  source: Uint8Array;
  status: "loading" | "ready" | "failed";
  items: PresentationSlideTemplate[];
};

/** 幻灯片动作只委托现有 Controller；模板列表来自当前原包的真实关系。 */
export function PresentationSlideControls({
  controller,
  state,
}: {
  controller: PresentationController;
  state: PresentationControllerState;
}) {
  const { t } = useTranslation("workspace");
  const statusId = useId();
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [selection, setSelection] = useState({ controller, id: "" });
  const selectedLayout =
    selection.controller === controller ? selection.id : "";
  const bytes = state.document.sourceBytes;
  useEffect(() => {
    if (!state.isEditing) return;
    let current = true;
    setTemplates({ source: bytes, status: "loading", items: [] });
    void readPresentationSlideTemplates(bytes).then(
      (items) => {
        if (current) setTemplates({ source: bytes, status: "ready", items });
      },
      () => {
        if (current)
          setTemplates({ source: bytes, status: "failed", items: [] });
      },
    );
    return () => {
      current = false;
    };
  }, [bytes, state.isEditing, controller]);
  const currentTemplates = templates?.source === bytes ? templates : null;
  const status = currentTemplates?.status ?? "loading";
  const items = currentTemplates?.items ?? [];
  const layoutId = items.some((item) => item.id === selectedLayout)
    ? selectedLayout
    : "";
  const index = state.document.slideIds.indexOf(state.selectedSlideId);
  const count = state.document.slideIds.length;
  const disabled =
    !state.isEditing || state.saving || state.projecting || index < 0;
  const hasTemplates = status === "ready" && items.length > 0;
  const templateMessage =
    status === "loading"
      ? "loadingLayouts"
      : status === "failed"
        ? "layoutsFailed"
        : !items.length
          ? "noLayouts"
          : null;
  if (!state.isEditing) return null;
  return (
    <div
      role="group"
      aria-label={t("workspace.presentationSlides.actions")}
      className="flex w-full min-w-0 flex-wrap items-center gap-2"
    >
      <label className="flex min-w-0 items-center gap-1 text-xs">
        {t("workspace.presentationSlides.layout")}
        <select
          className="min-w-0 max-w-48 rounded border border-border bg-background px-1 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          aria-label={t("workspace.presentationSlides.layout")}
          aria-describedby={templateMessage ? statusId : undefined}
          disabled={disabled || !hasTemplates}
          value={layoutId}
          onChange={(event) =>
            setSelection({ controller, id: event.currentTarget.value })
          }
        >
          <option value="">
            {t("workspace.presentationSlides.inheritLayout")}
          </option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.masterName ? ` — ${item.masterName}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={button}
        disabled={disabled || !hasTemplates}
        aria-describedby={templateMessage ? statusId : undefined}
        onClick={() => controller.addSlide(layoutId || undefined)}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {t("workspace.presentationSlides.add")}
      </button>
      <button
        type="button"
        className={button}
        disabled={disabled}
        onClick={() => controller.duplicateSelectedSlide()}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        {t("workspace.presentationSlides.duplicate")}
      </button>
      <button
        type="button"
        className={button}
        disabled={disabled || index === 0}
        onClick={() => controller.moveSlide(index, index - 1)}
      >
        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        {t("workspace.presentationSlides.moveEarlier")}
      </button>
      <button
        type="button"
        className={button}
        disabled={disabled || index >= count - 1}
        onClick={() => controller.moveSlide(index, index + 1)}
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        {t("workspace.presentationSlides.moveLater")}
      </button>
      <button
        type="button"
        className={button}
        disabled={disabled || count <= 1}
        title={
          count <= 1 ? t("workspace.presentationSlides.lastSlide") : undefined
        }
        onClick={() => controller.deleteSlide(index)}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t("workspace.presentationSlides.delete")}
      </button>
      {templateMessage && (
        <span
          id={statusId}
          role="status"
          className="text-xs text-muted-foreground"
        >
          {t(`workspace.presentationSlides.${templateMessage}`)}
        </span>
      )}
      {count <= 1 && (
        <span className="text-xs text-muted-foreground">
          {t("workspace.presentationSlides.lastSlide")}
        </span>
      )}
    </div>
  );
}
