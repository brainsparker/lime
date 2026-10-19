import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  ConversationSection,
  ConversationSectionHeader,
  ConversationSectionTitle,
  ConversationSectionToggle,
} from "./AppSidebarConversationShelf.styles";

const SECTION_DRAG_TYPE = "application/x-sidebar-section";

interface AppSidebarSectionProps {
  sectionKey: string;
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onReorder: (source: string, target: string, after: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  actions?: ReactNode;
  children: ReactNode;
  threadSectionId?: string;
}

export function AppSidebarSection({
  sectionKey,
  title,
  collapsed,
  onToggleCollapsed,
  onReorder,
  onMove,
  actions,
  children,
  threadSectionId,
}: AppSidebarSectionProps) {
  const contentId = useId();
  return (
    <ConversationSection
      data-testid={threadSectionId ? "app-sidebar-thread-section" : undefined}
      data-section-id={threadSectionId}
      data-sidebar-section={sectionKey}
    >
      <ConversationSectionHeader
        onDragOver={(event) => {
          if (
            Array.from(event.dataTransfer.types).includes(SECTION_DRAG_TYPE)
          ) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          const source = event.dataTransfer.getData(SECTION_DRAG_TYPE);
          if (!source) return;
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          onReorder(
            source,
            sectionKey,
            event.clientY >= bounds.top + bounds.height / 2,
          );
        }}
      >
        <ConversationSectionTitle>
          <ConversationSectionToggle
            type="button"
            aria-expanded={!collapsed}
            aria-controls={contentId}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(SECTION_DRAG_TYPE, sectionKey);
              event.dataTransfer.effectAllowed = "move";
            }}
            onKeyDown={(event) => {
              if (
                event.altKey &&
                (event.key === "ArrowUp" || event.key === "ArrowDown")
              ) {
                event.preventDefault();
                onMove(event.key === "ArrowUp" ? -1 : 1);
              }
            }}
            onClick={onToggleCollapsed}
          >
            <ChevronDown aria-hidden="true" />
            {title}
          </ConversationSectionToggle>
        </ConversationSectionTitle>
        {actions}
      </ConversationSectionHeader>
      {!collapsed ? <div id={contentId}>{children}</div> : null}
    </ConversationSection>
  );
}
