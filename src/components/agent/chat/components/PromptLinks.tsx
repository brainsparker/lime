import { useCallback, useMemo, useRef, type PropsWithChildren } from "react";
import { useLimeSkills } from "../hooks/useLimeSkills";
import type { ArtifactTimelineOpenTarget } from "../utils/artifactTimelineNavigation";
import { PromptLinkContext } from "./promptLinkContext";

export function PromptLinks({
  children,
  onOpenFile,
}: PropsWithChildren<{
  onOpenFile?: (target: ArtifactTimelineOpenTarget) => void;
}>) {
  const { skills, skillsLoading, refreshSkills } = useLimeSkills({
    autoLoad: false,
  });
  const requested = useRef(false);
  const requestSkills = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    void refreshSkills();
  }, [refreshSkills]);
  const openSkill = useMemo(
    () =>
      onOpenFile
        ? (path: string, itemId: string) =>
            onOpenFile({
              filePath: path,
              content: "",
              timelineItemId: itemId,
              openMode: "file_preview",
            })
        : undefined,
    [onOpenFile],
  );
  const value = useMemo(
    () => ({ skills, loading: skillsLoading, requestSkills, openSkill }),
    [skills, skillsLoading, requestSkills, openSkill],
  );
  return (
    <PromptLinkContext.Provider value={value}>
      {children}
    </PromptLinkContext.Provider>
  );
}
