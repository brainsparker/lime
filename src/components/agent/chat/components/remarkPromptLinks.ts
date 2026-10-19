import type {} from "remark-parse";
import type { Extension as FromMarkdownExtension } from "mdast-util-from-markdown";
import type { Tokenizer, State, Token } from "micromark-util-types";
import type { Processor } from "unified";
import { isSkillPromptLink } from "../skill-selection/skillPromptLink";
import { parseComposerLink } from "./composerLink";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    composerLink: "composerLink";
  }
}

// Consume the entire reference before math can claim a dollar in its label.
const tokenizeComposerLink: Tokenizer = function (effects, ok, nok) {
  let token: Token;
  const start: State = (code) => {
    if (this.previous === 33) return nok(code);
    token = effects.enter("composerLink");
    effects.consume(code);
    return inside;
  };
  const inside: State = (code) => {
    if (code === null || (code >= -5 && code <= -3)) return nok(code);
    effects.consume(code);
    if (code === 41) {
      const source = this.sliceSerialize({
        start: token.start,
        end: this.now(),
      });
      const link = parseComposerLink(source);
      if (link && link.end === source.length) {
        if (!isSkillPromptLink(link.href, link.label)) return nok;
        effects.exit("composerLink");
        return ok;
      }
    }
    return inside;
  };
  return start;
};

const fromMarkdown: FromMarkdownExtension = {
  enter: {
    composerLink(token) {
      const link = parseComposerLink(this.sliceSerialize(token))!;
      this.enter(
        {
          type: "link",
          url: link.href,
          title: link.title,
          children: [{ type: "text", value: link.label }],
          data: {
            hProperties: {
              dataPromptLinkHref: link.href,
              dataPromptLinkLabel: link.label,
            },
          },
        },
        token,
      );
    },
  },
  exit: {
    composerLink(token) {
      this.exit(token);
    },
  },
};

export function remarkPromptLinks(this: Processor) {
  const data = this.data();
  (data.micromarkExtensions ??= []).push({
    text: { 91: { name: "composerLink", tokenize: tokenizeComposerLink } },
  });
  (data.fromMarkdownExtensions ??= []).push(fromMarkdown);
}
