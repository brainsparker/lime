import { useEffect, useRef, useState } from "react";
import {
  getConfig,
  updateConfig,
  type Config,
  type ConfigUpdater,
  type ServiceModelPreferenceConfig,
} from "@/lib/api/appConfig";
import {
  buildPersistedServiceModelPreference,
  normalizeServiceModelPreference,
  type ServiceModelConfigKey,
} from "@/lib/serviceModels";
import { useSettingsDraft } from "../../_layout/useSettingsDraft";

export const DEFAULT_IMAGE_COUNT = 2;
export const MIN_IMAGE_COUNT = 1;
export const MAX_IMAGE_COUNT = 6;
type PromptDrafts = Partial<Record<ServiceModelConfigKey, string>>;
type Draft = {
  config: Config | null;
  prompts: PromptDrafts;
  imageInput: string;
  imageCount: number;
};
type Submission = { field: string; raw: string; revision: number };
type Request = {
  id: number;
  submission?: Submission;
  revisions: Map<string, number>;
};

export function getSectionPreference(
  config: Config | null,
  key: ServiceModelConfigKey,
) {
  return normalizeServiceModelPreference(
    config?.workspace_preferences?.service_models?.[key],
  );
}
const savedPrompt = (config: Config | null, key: ServiceModelConfigKey) =>
  getSectionPreference(config, key).customPrompt ?? "";
const savedCount = (config: Config | null) =>
  config?.image_gen?.default_count ?? DEFAULT_IMAGE_COUNT;
const clamp = (value: number) =>
  Math.min(MAX_IMAGE_COUNT, Math.max(MIN_IMAGE_COUNT, Math.round(value)));
const invalidCount = (raw: string) =>
  !raw.trim() || !Number.isFinite(Number(raw));

function preferenceUpdate(
  key: ServiceModelConfigKey,
  update: (
    current: ServiceModelPreferenceConfig,
  ) => ServiceModelPreferenceConfig,
): ConfigUpdater {
  return (current) => {
    const models = { ...current.workspace_preferences?.service_models };
    const preference = buildPersistedServiceModelPreference(
      update(getSectionPreference(current, key)),
    );
    if (preference) models[key] = preference;
    else delete models[key];
    return {
      ...current,
      workspace_preferences: {
        ...current.workspace_preferences,
        service_models: models,
      },
    };
  };
}

/** 同一页面草稿；配置的串行写入与版本仍由 updateConfig 持有。 */
export function useMediaServicesDraft(
  feedback: (type: "success" | "error") => void,
) {
  const [draft, setDraft] = useState<Draft>({
    config: null,
    prompts: {},
    imageInput: String(DEFAULT_IMAGE_COUNT),
    imageCount: DEFAULT_IMAGE_COUNT,
  });
  const draftRef = useRef(draft);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const mounted = useRef(false);
  const lifetime = useRef(0);
  const revisions = useRef(new Map<string, number>());
  const requests = useRef(new Map<number, Request>());
  const latestSubmission = useRef(new Map<string, Request>());
  const sequence = useRef(0);
  const applied = useRef(0);
  const [pending, setPending] = useState(0);
  const replaceDraft = (next: Draft) => {
    draftRef.current = next;
    setDraft(next);
  };
  const revise = (field: string) => {
    revisions.current.set(field, (revisions.current.get(field) ?? 0) + 1);
  };
  const snapshot = (field: string, raw: string): Submission => ({
    field,
    raw,
    revision: revisions.current.get(field) ?? 0,
  });
  const hasPendingField = (field: string) =>
    [...requests.current.values()].some(
      (request) => request.submission?.field === field,
    );

  useEffect(() => {
    mounted.current = true;
    const owner = ++lifetime.current;
    void getConfig().then(
      (config) => {
        if (!mounted.current || lifetime.current !== owner) return;
        const next: Draft = {
          config,
          prompts: {
            resource_prompt_rewrite: savedPrompt(
              config,
              "resource_prompt_rewrite",
            ),
          },
          imageInput: String(savedCount(config)),
          imageCount: savedCount(config),
        };
        draftRef.current = next;
        setDraft(next);
      },
      () => {
        // 初始配置不可用时保留 disabled 表单，不建立可保存的草稿基线。
      },
    );
    return () => {
      mounted.current = false;
      lifetime.current = owner + 1;
    };
  }, []);

  const accept = (config: Config, request: Request) => {
    const { submission } = request;
    const current = draftRef.current;
    const prompts = { ...current.prompts };
    for (const key of Object.keys(prompts) as ServiceModelConfigKey[]) {
      const field = `prompt:${key}`;
      const confirmed =
        submission?.field === field &&
        submission.revision === (revisions.current.get(field) ?? 0);
      const untouched =
        submission?.field !== field &&
        (revisions.current.get(field) ?? 0) ===
          (request.revisions.get(field) ?? 0) &&
        prompts[key] === savedPrompt(current.config, key);
      if (confirmed || untouched) prompts[key] = savedPrompt(config, key);
    }
    const imageConfirmed =
      submission?.field === "image-count" &&
      submission.revision === (revisions.current.get("image-count") ?? 0);
    const acceptImage =
      imageConfirmed ||
      (submission?.field !== "image-count" &&
        (revisions.current.get("image-count") ?? 0) ===
          (request.revisions.get("image-count") ?? 0) &&
        current.imageInput === String(savedCount(current.config)));
    replaceDraft({
      config,
      prompts,
      imageInput: acceptImage ? String(savedCount(config)) : current.imageInput,
      imageCount: acceptImage ? savedCount(config) : current.imageCount,
    });
  };

  const persist = async (updater: ConfigUpdater, submission?: Submission) => {
    if (!draftRef.current.config || !mounted.current) return;
    if (submission) {
      const previous = latestSubmission.current.get(submission.field);
      if (
        previous &&
        requests.current.has(previous.id) &&
        previous.submission?.raw === submission.raw
      ) {
        previous.submission = submission;
        return;
      }
    }
    const owner = lifetime.current;
    const id = ++sequence.current;
    const request = { id, submission, revisions: new Map(revisions.current) };
    requests.current.set(id, request);
    if (submission) latestSubmission.current.set(submission.field, request);
    setPending(requests.current.size);
    try {
      const config = await updateConfig(updater);
      if (!mounted.current || lifetime.current !== owner) return;
      if (id > applied.current) {
        applied.current = id;
        accept(config, request);
      }
      if (id === sequence.current) feedbackRef.current("success");
    } catch {
      if (
        mounted.current &&
        lifetime.current === owner &&
        id === sequence.current
      )
        feedbackRef.current("error");
    } finally {
      requests.current.delete(id);
      if (mounted.current && lifetime.current === owner)
        setPending(requests.current.size);
    }
  };

  const changePrompt = (key: ServiceModelConfigKey, value: string) => {
    const current = draftRef.current;
    if (current.prompts[key] === value) return;
    revise(`prompt:${key}`);
    replaceDraft({ ...current, prompts: { ...current.prompts, [key]: value } });
  };
  const commitPrompt = (key: ServiceModelConfigKey, raw: string) => {
    const submission = snapshot(`prompt:${key}`, raw);
    const value = raw.trim();
    if (
      value === savedPrompt(draftRef.current.config, key) &&
      !hasPendingField(submission.field)
    ) {
      changePrompt(key, value);
      return;
    }
    void persist(
      preferenceUpdate(key, (current) => ({
        ...current,
        customPrompt: value || undefined,
      })),
      submission,
    );
  };
  const changeImageCount = (raw: string) => {
    const current = draftRef.current;
    if (current.imageInput === raw) return;
    revise("image-count");
    replaceDraft({
      ...current,
      imageInput: raw,
      imageCount: invalidCount(raw) ? current.imageCount : clamp(Number(raw)),
    });
  };
  const commitImageCount = (rawValue: string | number) => {
    const raw = String(rawValue);
    if (invalidCount(raw)) return;
    const value = clamp(Number(raw));
    const submission = snapshot("image-count", raw);
    if (
      value === savedCount(draftRef.current.config) &&
      !hasPendingField(submission.field)
    ) {
      changeImageCount(String(value));
      return;
    }
    void persist(
      (current) => ({
        ...current,
        image_gen: { ...current.image_gen, default_count: value },
      }),
      submission,
    );
  };

  const dirty = Boolean(
    draft.config &&
    (draft.imageInput !== String(savedCount(draft.config)) ||
      (Object.keys(draft.prompts) as ServiceModelConfigKey[]).some(
        (key) => draft.prompts[key] !== savedPrompt(draft.config, key),
      )),
  );
  useSettingsDraft({ dirty, saving: pending > 0 });
  return {
    config: draft.config,
    promptDrafts: draft.prompts,
    imageCountDraft: draft.imageCount,
    imageCountInput: draft.imageInput,
    imageCountInvalid: invalidCount(draft.imageInput),
    changePrompt,
    commitPrompt,
    changeImageCount,
    commitImageCount,
    updateServiceModelPreference: (
      key: ServiceModelConfigKey,
      updater: (
        current: ServiceModelPreferenceConfig,
      ) => ServiceModelPreferenceConfig,
    ) => void persist(preferenceUpdate(key, updater)),
  };
}
