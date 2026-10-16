import type { Config } from "@/lib/api/appConfig";

export type ProfileField = "displayName" | "bio";
export const PROFILE_LIMITS = { displayName: 64, bio: 140 } as const;

/** 本地配置映射；不代表远端公共 Profile。 */
export function readProfile(config?: Config) {
  return {
    displayName: config?.user_profile?.nickname ?? "",
    bio: config?.user_profile?.bio ?? "",
  };
}

export function normalizeProfileValue(field: ProfileField, value: string) {
  return field === "bio"
    ? value.replace(/\r\n|[\r\n\u2028\u2029]/g, " ")
    : value;
}

export function isProfileValueValid(field: ProfileField, value: string) {
  return (
    value.length <= PROFILE_LIMITS[field] &&
    (field !== "displayName" || value.trim().length > 0)
  );
}

export function mergeProfileField(
  config: Config,
  field: ProfileField,
  value: string,
): Config {
  return {
    ...config,
    user_profile: {
      nickname: config.user_profile?.nickname,
      bio: config.user_profile?.bio,
      [field === "displayName" ? "nickname" : "bio"]: normalizeProfileValue(
        field,
        value,
      ).trim(),
    },
  };
}
