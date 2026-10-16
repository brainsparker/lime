import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { addMemoryStoreNote } from "@/lib/api/memoryStore";
import { useSettingsDraft } from "../../_layout/useSettingsDraft";

export function MemoryNoteEditor({
  showMessage,
  onSaved,
}: {
  showMessage: (message: string) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("settings");
  const id = useId();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const revision = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useSettingsDraft({ dirty: content.length > 0, saving });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function save() {
    if (inFlight.current) return;
    const submittedContent = content.trim();
    if (!submittedContent) {
      showMessage(t("settings.memory.store.message.noteEmpty"));
      return;
    }
    const submittedRevision = revision.current;
    inFlight.current = true;
    setSaving(true);
    try {
      await addMemoryStoreNote({
        scope: "global",
        title: t("settings.memory.store.noteDefaultTitle"),
        content: submittedContent,
      });
      if (!mounted.current) return;
      if (revision.current === submittedRevision) setContent("");
      showMessage(t("settings.memory.store.message.noteSaved"));
      onSaved();
    } catch (error) {
      if (!mounted.current) return;
      console.error("保存记忆修正失败:", error);
      showMessage(t("settings.memory.store.message.noteFailed"));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <label
            htmlFor={id}
            className="text-xs font-medium text-muted-foreground"
          >
            {t("settings.memory.store.noteTitle")}
          </label>
          <p
            id={`${id}-description`}
            className="mt-1 text-sm text-muted-foreground"
          >
            {t("settings.memory.store.noteDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          data-testid="settings-memory-note-save"
          className="shrink-0 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {t(
            saving
              ? "settings.memory.store.noteSaving"
              : "settings.memory.store.noteSave",
          )}
        </button>
      </div>
      <textarea
        id={id}
        aria-describedby={`${id}-description`}
        value={content}
        onChange={(event) => {
          revision.current += 1;
          setContent(event.target.value);
        }}
        data-testid="settings-memory-note-textarea"
        placeholder={t("settings.memory.store.notePlaceholder")}
        className="mt-3 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </div>
  );
}
