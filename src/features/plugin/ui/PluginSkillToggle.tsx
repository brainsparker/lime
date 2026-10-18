export function PluginSkillToggle({
  name,
  checked,
  disabled,
  reason,
  onChange,
  t,
}: {
  name: string;
  checked: boolean;
  disabled: boolean;
  reason?: string;
  onChange: (enabled: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={t("plugin.skillPreference.use", { name })}
      disabled={disabled}
      title={reason}
      onClick={() => onChange(!checked)}
      className="inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface-hover)] p-0.5 transition-colors aria-checked:bg-[color:var(--lime-brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lime-brand)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-[color:var(--lime-text-strong)] transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}
