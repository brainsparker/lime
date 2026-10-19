import styled from "styled-components";
import { ComposerEditor } from "@/components/input-kit";

export const DragHandle = styled.div`
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  color: var(--muted-foreground);
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;

  &:hover {
    opacity: 1;
  }
`;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2;
  padding: 0 8px 10px;
  width: 100%;
  max-width: none;
  margin: 0;

  &.floating-composer {
    padding: 0 0 6px;
  }

  &.floating-composer.context-connected {
    padding-bottom: 0;
  }
`;

export const InputBarContainer = styled.div`
  position: relative;
  border: 1px solid var(--lime-composer-border, rgba(110, 231, 183, 0.84));
  border-radius: 22px;
  padding: 8px 8px 0;
  background: var(
    --lime-composer-surface,
    var(--lime-surface, hsl(var(--card)))
  );
  box-shadow:
    0 10px 28px var(--lime-shadow-color),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;

  &:focus-within {
    border-color: var(--lime-composer-border-focus, rgba(74, 222, 128, 0.7));
    background: var(--lime-composer-surface-focus);
    box-shadow:
      0 0 0 3px var(--lime-focus-ring, rgba(74, 222, 128, 0.24)),
      0 14px 32px var(--lime-shadow-color),
      inset 0 1px 0 rgba(255, 255, 255, 0.92);
  }

  &.file-dragging {
    border: 2px dashed var(--lime-brand, #10b981);
    background-color: var(--lime-brand-soft, #ecfdf5);
  }

  &.floating-composer {
    border-radius: 18px;
    padding: 12px 8px 0;
    background: var(
      --lime-composer-surface-floating,
      var(--lime-surface, hsl(var(--card)))
    );
    border-color: var(--lime-composer-border, rgba(110, 231, 183, 0.84));
    box-shadow:
      0 28px 56px -38px var(--lime-shadow-color),
      inset 0 1px 0 rgba(255, 255, 255, 0.88);
  }

  &.floating-composer.context-connected {
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
    border-bottom-color: transparent;
    box-shadow:
      0 18px 42px -36px var(--lime-shadow-color),
      inset 0 1px 0 rgba(255, 255, 255, 0.88);
  }

  &.floating-composer:focus-within {
    background: var(--lime-composer-surface-focus);
    border-color: var(--lime-composer-border-focus, rgba(74, 222, 128, 0.7));
    box-shadow:
      0 0 0 3px var(--lime-focus-ring, rgba(74, 222, 128, 0.24)),
      0 28px 56px -34px var(--lime-shadow-color),
      inset 0 1px 0 rgba(255, 255, 255, 0.88);
  }

  &.floating-composer.context-connected:focus-within {
    border-bottom-color: transparent;
    box-shadow:
      0 0 0 3px rgba(74, 222, 128, 0.1),
      0 22px 48px -38px var(--lime-shadow-color),
      inset 0 1px 0 rgba(255, 255, 255, 0.88);
  }
`;

export const InputColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
`;

export const DictationRecordingDot = styled.span`
  display: inline-flex;
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: currentColor;
`;

export const DictationRecordingWaveform = styled.span`
  display: inline-flex;
  width: 34px;
  height: 10px;
  flex: 0 0 auto;
  align-items: center;
  opacity: 0.76;

  &::before {
    content: "••••••";
    font-size: 13px;
    line-height: 1;
    letter-spacing: 1px;
  }
`;

export const DictationRecordingDuration = styled.span`
  display: inline-flex;
  width: 36px;
  justify-content: flex-start;
  font-size: 13px;
  font-weight: 760;
  line-height: 1;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

export const DictationLiveTranscript = styled.div`
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 1.45;
  word-break: break-word;
  opacity: 0.86;
`;

export const StyledComposerEditor = styled(ComposerEditor)`
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 4px 0 0;
  border-radius: 0;
  overflow: auto;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  outline: none;
  line-height: 1.5;
  font-family: inherit;
  font-size: 16px;
  color: hsl(var(--foreground));
  min-height: 88px;

  &.floating-composer {
    font-size: 17px;
    line-height: 1.78;
    min-height: 88px;
  }

  [data-testid="inputbar-core-container"]:has([data-composer-expand-toggle]) & {
    padding-inline-end: 40px;
  }

  &.composer-expanded {
    min-height: 210px;
  }

  &[data-empty="true"]::before {
    color: hsl(var(--muted-foreground) / 0.78);
  }

  p {
    margin: 0;
  }
  &[data-empty="true"]::before {
    content: attr(data-placeholder);
    position: absolute;
    pointer-events: none;
  }
  [data-composer-token="paste"],
  [data-composer-token="element"] {
    border-radius: 4px;
    padding: 0 3px;
    background: hsl(var(--muted));
  }

  [data-appearance="inline-mention"] {
    display: inline;
    padding: 0;
    font-family: inherit;
    font-weight: 500;
    color: color-mix(
      in srgb,
      var(--lime-info, var(--info)) 80%,
      hsl(var(--foreground)) 20%
    );
    white-space: nowrap;
  }

  [data-mention-icon-container] {
    position: relative;
    display: inline-block;
    box-sizing: content-box;
    height: 1lh;
    padding-inline-end: 3px;
    vertical-align: bottom;
  }

  [data-mention-icon] {
    position: relative;
    display: block;
    top: 50%;
    width: 16px;
    height: 16px;
    transform: translateY(-50%);
  }

  [data-mention-label] {
    min-width: 0;
    overflow-wrap: break-word;
    white-space: normal;
  }

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: hsl(var(--border));
    border-radius: 2px;
  }
`;

export const ExpansionControl = styled.div`
  position: absolute;
  inset-block-start: 10px;
  inset-inline-end: 10px;
  z-index: 2;
`;
