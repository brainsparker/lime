import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { ComposerEditor } from "@/components/input-kit/ComposerEditor";

export function QuestionAnswerEditor({
  text,
  disabled,
  autoFocus,
  label,
  placeholder,
  onFocus,
  onChange,
  onSubmit,
}: {
  text: string;
  disabled: boolean;
  autoFocus: boolean;
  label: string;
  placeholder: string;
  onFocus: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [controller] = useState(
    () => new ComposerController({ text }, { plainTextMode: true }),
  );
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const previousTextRef = useRef(text);
  useLayoutEffect(() => {
    if (controller.getSnapshot().document.text !== text) {
      previousTextRef.current = text;
      controller.setText(text);
    }
  }, [controller, text]);
  useEffect(
    () =>
      controller.subscribe(() => {
        const nextText = controller.getSnapshot().document.text;
        if (nextText !== previousTextRef.current) {
          previousTextRef.current = nextText;
          onChangeRef.current(nextText);
        }
      }),
    [controller],
  );
  return (
    <div className="min-w-0 flex-1 text-sm leading-5" onFocus={onFocus}>
      <ComposerEditor
        controller={controller}
        ariaLabel={label}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onSubmit={onSubmit}
        className="max-h-40 min-h-5 overflow-y-auto outline-none"
      />
    </div>
  );
}
