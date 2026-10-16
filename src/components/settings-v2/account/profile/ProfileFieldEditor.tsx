import type { ChangeEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { PROFILE_LIMITS, type ProfileField } from "./profileConfig";

interface ProfileFieldEditorProps {
  field: ProfileField;
  value: string;
  isEditing: boolean;
  editValue: string;
  saving: boolean;
  canSave: boolean;
  editDisabled: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ProfileFieldEditor({
  field,
  value,
  isEditing,
  editValue,
  saving,
  canSave,
  editDisabled,
  onStartEdit,
  onChange,
  onSave,
  onCancel,
}: ProfileFieldEditorProps) {
  const { t } = useTranslation("settings");
  const label = t(
    field === "displayName"
      ? "settings.profile.field.displayName.label"
      : "settings.profile.field.bio.label",
  );
  const placeholder = t(
    field === "displayName"
      ? "settings.profile.field.displayName.placeholder"
      : "settings.profile.field.bio.placeholder",
  );
  const id = `profile-field-${field}`;
  const limitId = `${id}-limit`;
  const buttonClass =
    "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50";
  const editorProps = {
    id,
    value: editValue,
    maxLength: PROFILE_LIMITS[field],
    "aria-describedby": limitId,
    autoComplete: "off",
    autoFocus: true,
    placeholder,
    className:
      "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    onKeyDown: (
      event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (field === "displayName") onSave();
      }
    },
  };
  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-4">
        <label
          htmlFor={isEditing ? id : undefined}
          className="text-sm font-medium"
        >
          {label}
        </label>
        {!isEditing && (
          <button
            type="button"
            className={buttonClass}
            aria-label={t("settings.profile.field.editAria", { label })}
            disabled={editDisabled}
            onClick={onStartEdit}
          >
            {t("settings.profile.action.edit")}
          </button>
        )}
      </div>
      {isEditing ? (
        <>
          {field === "bio" ? (
            <textarea {...editorProps} rows={3} spellCheck />
          ) : (
            <input {...editorProps} type="text" spellCheck={false} />
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span id={limitId} className="text-xs text-muted-foreground">
              {t("settings.profile.field.limit", {
                count: PROFILE_LIMITS[field],
              })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={buttonClass}
                aria-label={t("settings.profile.field.cancelAria", { label })}
                disabled={saving}
                onClick={onCancel}
              >
                {t("settings.profile.action.cancel")}
              </button>
              <button
                type="button"
                className={buttonClass}
                aria-label={t("settings.profile.field.saveAria", { label })}
                disabled={saving || !canSave}
                onClick={onSave}
              >
                {t("settings.profile.action.save")}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="break-words text-sm text-muted-foreground">
          {value || placeholder}
        </p>
      )}
    </div>
  );
}
