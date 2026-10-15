import React, { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type {
  CodeBlockNodeViewEntry,
  CodeBlockNodeViewRegistry,
} from "./CodeBlockNodeViewRegistry";
import {
  codeBlockLanguages,
  codeBlockLanguageLabelKey,
  normalizeCodeBlockLanguage,
} from "./composerCodeBlockLanguage";
import "./CodeBlockToolbar.css";

export interface CodeBlockToolbarProps {
  entry: CodeBlockNodeViewEntry;
  disabled?: boolean;
}

/** The Portal owns only menu/search state; code remains in PM's contentDOM. */
export function CodeBlockToolbar({
  entry,
  disabled = false,
}: CodeBlockToolbarProps) {
  const { t } = useTranslation("agent");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery("");
    }
  }, [disabled]);
  const languageLabel = (value: string): string => {
    const language = normalizeCodeBlockLanguage(value) ?? value;
    const known = codeBlockLanguages.find((item) => item.value === language);
    const key = codeBlockLanguageLabelKey(language);
    if (key === "composer.codeBlock.language.math")
      return t("composer.codeBlock.language.math");
    if (key === "composer.codeBlock.language.plaintext")
      return t("composer.codeBlock.language.plaintext");
    return known?.label ?? language;
  };
  const none = t("composer.codeBlock.language.none");
  const auto = t("composer.codeBlock.language.auto");
  const language = entry.language;
  const autoEnabled = entry.autoDetectLanguage === true;
  const plain = !language || language === "plaintext";
  const label = autoEnabled
    ? !language
      ? auto
      : plain
        ? t("composer.codeBlock.autoPlainTextLanguage")
        : t("composer.codeBlock.autoDetectedLanguage", {
            language: languageLabel(language),
          })
    : plain
      ? none
      : languageLabel(language);
  const pickerLabel = autoEnabled
    ? !language
      ? t("composer.codeBlock.autoLanguagePickerLabel")
      : plain
        ? t("composer.codeBlock.autoPlainTextLanguagePickerLabel")
        : t("composer.codeBlock.autoDetectedLanguagePickerLabel", {
            language: languageLabel(language),
          })
    : t("composer.codeBlock.languagePickerLabel", {
        language: plain ? none : languageLabel(language),
      });
  const search = query.trim().toLowerCase();
  const matches = (label: string, value: string): boolean =>
    !search ||
    label.toLowerCase().includes(search) ||
    value.toLowerCase().includes(search);
  const options = [
    ...(entry.autoDetectLanguage === null
      ? []
      : [{ value: "auto", label: auto, selection: "auto" as string | null }]),
    { value: "plaintext", label: none, selection: null as string | null },
    ...codeBlockLanguages
      .filter((item) => item.value !== "plaintext")
      .map((item) => ({
        value: item.value,
        label: languageLabel(item.value),
        selection: item.value,
      })),
  ].filter((item) => matches(item.label, item.value));
  const selectedValue = autoEnabled ? "auto" : plain ? "plaintext" : language;
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  };
  const select = (value: string | null) => {
    if (disabled) return;
    entry.selectLanguage(value);
    changeOpen(false);
  };
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <div
      className="composer-code-toolbar"
      onKeyDown={stop}
      onPaste={stop}
      onBeforeInput={stop}
      onCompositionStart={stop}
      onCompositionEnd={stop}
    >
      <Popover open={open && !disabled} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={pickerLabel}
            className="composer-code-language-trigger"
          >
            <span>{label}</span>
            <ChevronsUpDown aria-hidden="true" size={12} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="composer-code-language-menu"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!disabled) entry.focusEditor();
          }}
          onKeyDown={stop}
          onPaste={stop}
          onBeforeInput={stop}
          onCompositionStart={stop}
          onCompositionEnd={stop}
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("composer.codeBlock.searchLanguages")}
              aria-label={t("composer.codeBlock.searchLanguages")}
            />
            <CommandList aria-label={pickerLabel}>
              <CommandEmpty>
                {t("composer.codeBlock.noLanguagesFound")}
              </CommandEmpty>
              <CommandGroup>
                {options.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    onSelect={() => select(item.selection)}
                    disabled={disabled}
                    data-code-language={item.value}
                  >
                    <Check
                      aria-hidden="true"
                      size={14}
                      className={
                        selectedValue === item.value ? "" : "invisible"
                      }
                    />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CodeBlockToolbars({
  registry,
  disabled,
}: {
  registry: CodeBlockNodeViewRegistry;
  disabled?: boolean;
}) {
  const entries = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  );
  return (
    <>
      {entries.map((entry) =>
        createPortal(
          <CodeBlockToolbar entry={entry} disabled={disabled} />,
          entry.toolbarPortalContainer,
          entry.id,
        ),
      )}
    </>
  );
}
