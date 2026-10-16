import { useTranslation } from "react-i18next";
import { useSettingsDraft } from "../../_layout/useSettingsDraft";
import { ProfileLayout } from "./ProfileLayout";
import { ProfileFieldEditor } from "./ProfileFieldEditor";
import { useProfileDraft } from "./useProfileDraft";

export function ProfileContent() {
  const { t } = useTranslation("settings");
  const state = useProfileDraft();
  useSettingsDraft({ dirty: state.dirty, saving: state.saving });
  return (
    <ProfileLayout header={t("settings.profile.title")}>
      {state.loading ? (
        <p role="status">{t("settings.profile.loading")}</p>
      ) : (
        <>
          {state.message && (
            <p
              role={state.message.type === "error" ? "alert" : "status"}
              className="mb-4 text-sm"
            >
              {state.message.text}
            </p>
          )}
          {!state.ready && (
            <button type="button" onClick={state.retryLoad}>
              {t("settings.profile.action.retry")}
            </button>
          )}
          {(["displayName", "bio"] as const).map((field) => (
            <ProfileFieldEditor
              key={field}
              field={field}
              value={state.profile[field]}
              isEditing={state.editingField === field}
              editValue={state.editValue}
              saving={state.saving}
              canSave={state.fieldDirty && state.valid}
              editDisabled={!state.ready || state.saving || state.fieldDirty}
              onStartEdit={() => state.startEdit(field)}
              onChange={state.changeEditValue}
              onSave={state.saveEdit}
              onCancel={state.cancelEdit}
            />
          ))}
        </>
      )}
    </ProfileLayout>
  );
}
