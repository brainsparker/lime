import type { InputCapabilitySendRoute } from "../skill-selection/inputCapabilitySelection";
import { parseRuntimeSceneCommand } from "./serviceSkillSceneLaunch";

export interface CompletedInputCapabilitySlashUsage {
  kind: "scene";
  entryId: string;
  replayText?: string;
}

export interface ResolvedInputCapabilityDispatchContext {
  capabilityRoute?: InputCapabilitySendRoute;
  sourceText: string;
  completedSlashUsage: CompletedInputCapabilitySlashUsage | null;
}

function normalizeOptionalText(value?: string | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeSlashCommandReplayText(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, 400).trim();
}

function resolveRuntimeSceneReplayText(rawText: string): string | undefined {
  return normalizeSlashCommandReplayText(
    parseRuntimeSceneCommand(rawText)?.userInput,
  );
}

function inferRuntimeSceneCapabilityRoute(
  sourceText: string,
): InputCapabilitySendRoute | undefined {
  const parsedCommand = parseRuntimeSceneCommand(sourceText);
  const sceneKey = normalizeOptionalText(parsedCommand?.sceneKey);
  if (!sceneKey) {
    return undefined;
  }

  return {
    kind: "runtime_scene",
    sceneKey,
    commandPrefix: `/${sceneKey}`,
  };
}

function resolveEffectiveInputCapabilityRoute(
  capabilityRoute: InputCapabilitySendRoute | undefined,
  sourceText: string,
): InputCapabilitySendRoute | undefined {
  return capabilityRoute || inferRuntimeSceneCapabilityRoute(sourceText);
}

function resolveRoutedSourceText(params: {
  sourceText: string;
  capabilityRoute?: InputCapabilitySendRoute;
  displayContent?: string;
}): string {
  const route = params.capabilityRoute;
  if (!route) {
    return params.sourceText;
  }

  const trimmedSourceText = params.sourceText.trim();
  const sourceBody = trimmedSourceText
    ? params.sourceText
    : (normalizeOptionalText(params.displayContent) ?? "");

  if (route.kind === "builtin_command") {
    if (
      trimmedSourceText === route.commandPrefix ||
      trimmedSourceText.startsWith(`${route.commandPrefix} `)
    ) {
      return params.sourceText;
    }

    return `${route.commandPrefix}${sourceBody ? ` ${sourceBody}` : ""}`;
  }

  if (route.kind === "curated_task") {
    return params.sourceText;
  }

  if (
    trimmedSourceText === route.commandPrefix ||
    trimmedSourceText.startsWith(`${route.commandPrefix} `)
  ) {
    return params.sourceText;
  }

  return `${route.commandPrefix}${sourceBody ? ` ${sourceBody}` : ""}`;
}

function resolveCompletedSlashUsage(params: {
  capabilityRoute?: InputCapabilitySendRoute;
  rawText: string;
  displayContent?: string;
}): CompletedInputCapabilitySlashUsage | null {
  const route = params.capabilityRoute;
  if (!route) {
    return null;
  }

  if (route.kind === "runtime_scene") {
    return {
      kind: "scene",
      entryId: route.sceneKey,
      replayText: resolveRuntimeSceneReplayText(params.rawText),
    };
  }

  return null;
}

export function resolveInputCapabilityDispatchContext(params: {
  sourceText: string;
  capabilityRoute?: InputCapabilitySendRoute;
  displayContent?: string;
}): ResolvedInputCapabilityDispatchContext {
  const capabilityRoute = resolveEffectiveInputCapabilityRoute(
    params.capabilityRoute,
    params.sourceText,
  );
  const sourceText = resolveRoutedSourceText({
    sourceText: params.sourceText,
    capabilityRoute,
    displayContent: params.displayContent,
  });

  return {
    capabilityRoute,
    sourceText,
    completedSlashUsage: resolveCompletedSlashUsage({
      capabilityRoute,
      rawText: sourceText,
      displayContent: params.displayContent,
    }),
  };
}
