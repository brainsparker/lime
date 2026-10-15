import { describe, expect, it, vi } from "vitest";
import {
  codeBlockLanguages,
  normalizeCodeBlockLanguage,
  codeBlockHighlightLanguage,
  codeBlockLanguageLabelKey,
  detectCodeBlockLanguage,
} from "./composerCodeBlockLanguage";

describe("code language semantics", () => {
  it("keeps the shipped picker catalog distinct from parser extras", () => {
    expect(codeBlockLanguages).toHaveLength(41);
    expect(new Set(codeBlockLanguages.map((item) => item.value)).size).toBe(41);
    expect(codeBlockLanguages.some((item) => item.value === "tsrx")).toBe(true);
    expect(codeBlockLanguages.some((item) => item.value === "dockerfile")).toBe(
      false,
    );
  });

  it.each([
    [" JSX ", "javascript"],
    ["TSX", "typescript"],
    ["html", "xml"],
    ["zsh", "bash"],
    ["C++", "cpp"],
    ["text", "plaintext"],
    ["unknown", null],
    ["java script", null],
    [null, null],
  ])(
    "canonicalizes %s without inventing a parser language",
    (input, expected) => {
      expect(normalizeCodeBlockLanguage(input)).toBe(expected);
    },
  );

  it("separates metadata names from display and highlighter language", () => {
    expect(codeBlockHighlightLanguage("math")).toBe("latex");
    expect(codeBlockHighlightLanguage("mermaid")).toBeNull();
    expect(codeBlockHighlightLanguage("plaintext")).toBeNull();
    expect(codeBlockLanguageLabelKey("math")).toBe(
      "composer.codeBlock.language.math",
    );
    expect(codeBlockLanguageLabelKey("plaintext")).toBe(
      "composer.codeBlock.language.plaintext",
    );
    expect(codeBlockLanguageLabelKey("ts")).toBeNull();
  });

  it.each([
    [" \n ", null],
    ["https://example.test/path", "plaintext"],
    ["[INFO] ready\n[INFO] done", "plaintext"],
    ["Content Type: text/plain\nServer: test\nHost: test", "plaintext"],
    ['{"emoji":"😀","value":1}', "json"],
    ["<div>你好</div>", "xml"],
    ["SELECT a FROM users", "sql"],
    ["def hello():\n  return 1", "python"],
    ["const result: number = 1", "typescript"],
    ["const App = () => @{ <div/> }", "tsrx"],
    ["abc", "plaintext"],
    ["example.test/path", "plaintext"],
    ["localhost:8080/path", "plaintext"],
    ["PS C:\\work> Get-Item .", "plaintext"],
    ["2026-10-14T12:00:00 ready", "plaintext"],
    ["Compiling application...", "plaintext"],
    ["HTTP/1.1 200 OK", "plaintext"],
    ["On branch main", "plaintext"],
    ["Build log:\n  at main (src.ts:1:2)", "plaintext"],
    ["name: one\nversion: two\nstatus: active", "yaml"],
    ["<Widget/>", "plaintext"],
    ["diff --git a/a b/a\n--- a/a\n+++ b/a", "diff"],
    ["query GetUser { user { id } }", "graphql"],
    ["using System;\nConsole.WriteLine(1);", "csharp"],
    ["public static void Main() {}", "csharp"],
    ["package org.example;\nclass Main {}", "java"],
    ["public static void main() {}", "java"],
    ["#include <filesystem>", "cpp"],
    ["#include <stddef.h>", "c"],
    ["export default async function App(): View @{ <div/> }", "tsrx"],
    ["const $App = x => @{ <div/> }", "tsrx"],
    ["console.log(1)", "javascript"],
    ["func greet() {}", "swift"],
    ["library(ggplot2)", "r"],
    ["import Foundation", "python"],
  ])("detects bounded syntax/log evidence for %s", async (source, expected) => {
    const expensive = vi.fn(() => ({ language: "java", relevance: 99 }));
    expect(await detectCodeBlockLanguage(source, expensive)).toBe(expected);
    expect(expensive).not.toHaveBeenCalled();
  });

  it("uses the real detector contract only above threshold and catches failure", async () => {
    const source = "a lengthy unclassified fragment without syntax";
    expect(
      await detectCodeBlockLanguage(source, () => ({
        language: "rust",
        relevance: 2,
      })),
    ).toBe("rust");
    expect(
      await detectCodeBlockLanguage(source, () => ({
        language: "rust",
        relevance: 1.99,
      })),
    ).toBe("plaintext");
    expect(
      await detectCodeBlockLanguage(source, () => ({
        language: "dockerfile",
        relevance: 100,
      })),
    ).toBe("plaintext");
    expect(
      await detectCodeBlockLanguage(source, () => {
        throw new Error("parser unavailable");
      }),
    ).toBe("plaintext");
  });

  it.each([
    '{/* note */ "value": 1}',
    '// note\n{"value":1}',
    '/* note */ [1, {"value":true}]',
    '{"value": "// not a comment", "other": "/* literal */"}',
  ])(
    "recognizes valid JSONC objects/arrays before grammar detection: %s",
    async (source) => {
      const detector = vi.fn(() => ({ language: "rust", relevance: 99 }));
      expect(await detectCodeBlockLanguage(source, detector)).toBe("json");
      expect(detector).not.toHaveBeenCalled();
    },
  );

  it.each([
    '{"value":1,}',
    "[1,]",
    '{unquoted: "JSON5"}',
    "{'single':'quote'}",
    '{"value":}',
    '{"value":1} extra',
    "/* unfinished",
    "// comment only",
    "/* note */ true",
    "/* note */ [1, invalid]",
  ])(
    "rejects malformed, scalar, or overly permissive JSONC: %s",
    async (source) => {
      expect(
        await detectCodeBlockLanguage(source, () => ({
          language: null,
          relevance: 0,
        })),
      ).toBe("plaintext");
    },
  );
});
