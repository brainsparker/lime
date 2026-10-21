import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

export function PreferenceMenu<T extends string>({
  label,
  description,
  targetId,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  targetId: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div
      id={targetId}
      data-settings-search-target={targetId}
      tabIndex={-1}
      aria-labelledby={`${targetId}-label`}
      className="flex min-h-16 items-center justify-between gap-6 border-b border-border py-4 last:border-0"
    >
      <div className="min-w-0">
        <div id={`${targetId}-label`} className="text-sm">
          {label}
        </div>
        {description ? (
          <p
            id={`${targetId}-description`}
            className="mt-1 text-xs text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
      </div>
      <Menu.Root>
        <Menu.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-labelledby={`${targetId}-label ${targetId}-value`}
            aria-describedby={
              description ? `${targetId}-description` : undefined
            }
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <span id={`${targetId}-value`}>
              {options.find((option) => option.value === value)?.label}
            </span>
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="end"
            sideOffset={4}
            className="z-[70] min-w-44 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            <Menu.RadioGroup
              value={value}
              onValueChange={(next) => {
                const option = options.find((item) => item.value === next);
                if (option && option.value !== value && !disabled)
                  onChange(option.value);
              }}
            >
              {options.map((option) => (
                <Menu.RadioItem
                  key={option.value}
                  value={option.value}
                  className="flex cursor-default items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm outline-none focus:bg-accent"
                >
                  {option.label}
                  <Menu.ItemIndicator>
                    <Check className="size-4" aria-hidden="true" />
                  </Menu.ItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
