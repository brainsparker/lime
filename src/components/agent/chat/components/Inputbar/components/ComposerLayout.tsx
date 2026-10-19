import type { ReactNode } from "react";
import styled from "styled-components";
import {
  InlineControlLayoutContext,
  useInlineControlLayout,
} from "@/components/input-kit/InlineControlLayout";

const Footer = styled.div`
  display: grid;
  grid-template-columns: minmax(0, auto) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 5px;
  min-width: 0;
  padding-inline: 8px;
  padding-bottom: 8px;

  [data-composer-footer-input] {
    grid-column: 1 / -1;
    grid-row: 1;
    min-width: 0;
    margin-inline: -8px;
    margin-bottom: 4px;
  }

  [data-composer-leading-controls] {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  [data-composer-trailing-controls] {
    grid-column: 3;
    grid-row: 2;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
  }
`;

const ExpandingControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  flex: 1;

  > * {
    min-width: 0;
    max-width: 100%;
  }
`;

const ModelControl = styled.div`
  min-width: 0;
  max-width: 100%;

  &[hidden] {
    display: none;
  }
`;

interface AdaptiveFooterProps {
  input: ReactNode;
  leadingControls: ReactNode;
  modelControl?: ReactNode;
  trailingControls: ReactNode;
}

/** 主输入与底栏共用槽位；布局变化不重新挂载 EditorView。 */
export function AdaptiveFooter({
  input,
  leadingControls,
  modelControl,
  trailingControls,
}: AdaptiveFooterProps) {
  const { availableRef, controlRef, presentation } = useInlineControlLayout(
    Boolean(modelControl),
  );
  return (
    <Footer
      data-composer-layout="multiline"
      data-composer-rows="stacked"
      data-composer-footer-responsive=""
    >
      <div data-composer-footer-input="">{input}</div>
      <div data-composer-leading-controls="">{leadingControls}</div>
      <div data-composer-trailing-controls="">
        {modelControl ? (
          <ExpandingControls
            ref={availableRef}
            data-inline-control-available=""
          >
            <ModelControl ref={controlRef} hidden={presentation === "hidden"}>
              <InlineControlLayoutContext.Provider value={presentation}>
                {modelControl}
              </InlineControlLayoutContext.Provider>
            </ModelControl>
          </ExpandingControls>
        ) : null}
        {trailingControls}
      </div>
    </Footer>
  );
}
