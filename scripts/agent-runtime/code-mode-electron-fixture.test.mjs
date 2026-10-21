import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EXEC_CALL_ID,
  EXEC_OUTPUT_MARKER,
  FINAL_TEXT,
  MODEL_NAME,
  startCodeModeFixture,
  summarizeProviderEvidence,
} from "./code-mode-electron-fixture.mjs";

const memoryPrompt = fs.readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../lime-rs/crates/app-server/src/memory_store/consolidation_prompt.md",
  ),
  "utf8",
);
const foregroundInput = [{ role: "user", content: "Run the CodeMode gate" }];
const tools = [
  { type: "custom", name: "exec", format: { type: "grammar", syntax: "lark" } },
];

async function sample(fixture, input) {
  const response = await fetch(`${fixture.baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer fixture-code-mode-key",
    },
    body: JSON.stringify({ model: MODEL_NAME, input, tools, stream: true }),
  });
  return { status: response.status, text: await response.text() };
}

describe.each([
  { label: "LF", newline: "\n" },
  { label: "CRLF", newline: "\r\n" },
])("CodeMode fixture conversations ($label)", ({ newline }) => {
  const memoryInput = [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: memoryPrompt
            .replaceAll("\r\n", "\n")
            .replaceAll("\n", newline)
            .replace(/\{\{[^}]+\}\}/gu, "fixture-memory-value"),
        },
      ],
    },
  ];
  it.each([0, 1, 2])(
    "isolates startup memory at foreground boundary %i",
    async (memoryBoundary) => {
      const fixture = await startCodeModeFixture();
      try {
        const output = {
          type: "custom_tool_call_output",
          call_id: EXEC_CALL_ID,
          output: `Script completed\nOutput:\n${EXEC_OUTPUT_MARKER}`,
        };
        for (let boundary = 0; boundary < 3; boundary += 1) {
          if (boundary === memoryBoundary) {
            const memory = await sample(fixture, memoryInput);
            expect(memory.status, memory.text).toBe(200);
            expect(memory.text).toContain("MEMORY-FIXTURE: no update needed");
            expect(memory.text).not.toContain(EXEC_CALL_ID);
            expect(memory.text).not.toContain(FINAL_TEXT);
          }
          if (boundary < 2) {
            const foreground = await sample(
              fixture,
              boundary === 0 ? foregroundInput : [...foregroundInput, output],
            );
            expect(foreground.status, foreground.text).toBe(200);
            expect(foreground.text).toContain(
              boundary === 0 ? EXEC_CALL_ID : FINAL_TEXT,
            );
          }
        }
        expect(summarizeProviderEvidence(fixture)).toMatchObject({
          responsesRequestCount: 2,
          memoryRequestCount: 1,
          firstRequestAdvertisedExec: true,
          secondRequestHasCustomToolOutput: true,
          customToolOutputContainsMarker: true,
          requestErrors: [],
        });
      } finally {
        await fixture.close();
      }
    },
  );

  it("still rejects missing foreground tool output after memory sampling", async () => {
    const fixture = await startCodeModeFixture();
    try {
      expect((await sample(fixture, foregroundInput)).status).toBe(200);
      expect((await sample(fixture, memoryInput)).status).toBe(200);
      const invalid = await sample(fixture, foregroundInput);
      expect(invalid.status).toBe(400);
      expect(JSON.parse(invalid.text).error.message).toContain(
        "missing the CodeMode custom_tool_call_output marker",
      );
      expect(summarizeProviderEvidence(fixture)).toMatchObject({
        responsesRequestCount: 2,
        memoryRequestCount: 1,
        customToolOutputContainsMarker: false,
        requestErrors: [
          "second Responses request is missing the CodeMode custom_tool_call_output marker",
        ],
      });
    } finally {
      await fixture.close();
    }
  });
});
