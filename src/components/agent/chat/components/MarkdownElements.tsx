import type { ComponentProps } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { Quote } from "lucide-react";
import {
  MarkdownDivider,
  MarkdownQuoteBody,
  MarkdownQuoteCard,
  MarkdownQuoteIconShell,
  MarkdownQuoteInner,
  MarkdownTableScroll,
} from "./MarkdownRendererStyles";

type CodeProps = ComponentProps<"code"> & ExtraProps & { inline?: boolean };

// 保持元素类型稳定，正文更新时保留链接、焦点与正在进行的鼠标手势。
export const markdownElements: Components = {
  code({ inline, className, children, ...props }: CodeProps) {
    const content = String(
      Array.isArray(children) ? children.join("") : children || "",
    );
    const isInlineCode =
      typeof inline === "boolean"
        ? inline
        : !className && !content.includes("\n");

    if (isInlineCode) {
      return (
        <code className={className} data-inline-code="true" {...props}>
          {children}
        </code>
      );
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  h1({ children, ...props }) {
    return (
      <h1 data-markdown-heading-level="1" {...props}>
        {children}
      </h1>
    );
  },
  h2({ children, ...props }) {
    return (
      <h2 data-markdown-heading-level="2" {...props}>
        {children}
      </h2>
    );
  },
  h3({ children, ...props }) {
    return (
      <h3 data-markdown-heading-level="3" {...props}>
        {children}
      </h3>
    );
  },
  blockquote({ children }) {
    return (
      <MarkdownQuoteCard data-testid="markdown-blockquote-card">
        <MarkdownQuoteInner>
          <MarkdownQuoteIconShell aria-hidden="true">
            <Quote size={15} />
          </MarkdownQuoteIconShell>
          <MarkdownQuoteBody>{children}</MarkdownQuoteBody>
        </MarkdownQuoteInner>
      </MarkdownQuoteCard>
    );
  },
  hr() {
    return <MarkdownDivider data-testid="markdown-divider" />;
  },
  table({ children, ...props }) {
    return (
      <MarkdownTableScroll data-testid="markdown-table-scroll">
        <table {...props}>{children}</table>
      </MarkdownTableScroll>
    );
  },
};
