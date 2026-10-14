import React from "react";

interface InputbarSurfaceProps {
  isFullscreen: boolean;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  children: React.ReactNode;
}

export const InputbarSurface: React.FC<InputbarSurfaceProps> = ({
  isFullscreen,
  onDragOver,
  onDrop,
  children,
}) => (
  <div
    onDragOver={onDragOver}
    onDrop={onDrop}
    className={
      isFullscreen ? "fixed inset-0 z-50 bg-background p-4 flex flex-col" : ""
    }
    style={{ position: "relative" }}
  >
    {children}
  </div>
);
