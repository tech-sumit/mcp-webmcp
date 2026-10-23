import { describe, it, expect, vi } from "vitest";
import type { ToolSource } from "@tech-sumit/ai-inspector-types";
import {
  parseInputSchema,
  toMcpAnnotations,
  toolAnnotations,
  type WebMCPTool,
} from "../src/webmcp-tool.js";
import { WebMCPMetaSource } from "../src/sources/webmcp-meta.js";

const bookTable: WebMCPTool = {
  name: "book_table",
  title: "Book a table",
  description: "Book a restaurant table",
  inputSchema: '{"type":"object","properties":{"guests":{"type":"number"}}}',
  annotations: {
    readOnlyHint: false,
    untrustedContentHint: false,
    consequentialHint: true,
    debugging: false,
  },
};

describe("parseInputSchema", () => {
  it("parses a JSON schema string", () => {
    expect(parseInputSchema(bookTable.inputSchema)).toEqual({
      type: "object",
      properties: { guests: { type: "number" } },
    });
  });

  it("falls back to an empty object schema for absent or malformed input", () => {
    expect(parseInputSchema("")).toEqual({ type: "object", properties: {} });
    expect(parseInputSchema("{not json")).toEqual({ type: "object", properties: {} });
    expect(parseInputSchema("[]")).toEqual({ type: "object", properties: {} });
  });
});

describe("toolAnnotations", () => {
  it("returns undefined when a tool has no hints", () => {
    expect(toolAnnotations({ name: "t", description: "d", inputSchema: "" })).toBeUndefined();
  });

  it("uses the legacy top-level readOnlyHint", () => {
    expect(
      toolAnnotations({ name: "t", description: "d", inputSchema: "", readOnlyHint: true }),
    ).toEqual({ readOnlyHint: true });
  });
});

describe("toMcpAnnotations", () => {
  it("maps WebMCP hints and title to MCP annotations", () => {
    expect(toMcpAnnotations(bookTable)).toEqual({
      title: "Book a table",
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    });
  });

  it("returns undefined when there is nothing to map", () => {
    expect(toMcpAnnotations({ name: "t", description: "d", inputSchema: "" })).toBeUndefined();
  });
});

describe("WebMCPMetaSource", () => {
  it("lists page tools with title and annotations", async () => {
    const inner = {
      listTools: vi.fn().mockReturnValue([bookTable, { name: "noop", description: "No-op", inputSchema: "" }]),
    } as unknown as ToolSource;
    const meta = new WebMCPMetaSource(inner);

    const [content] = await meta.callTool("webmcp_list_tools", "{}");
    const listed = JSON.parse((content as { text: string }).text);

    expect(listed).toEqual([
      {
        name: "book_table",
        title: "Book a table",
        description: "Book a restaurant table",
        inputSchema: { type: "object", properties: { guests: { type: "number" } } },
        annotations: bookTable.annotations,
      },
      { name: "noop", description: "No-op", inputSchema: { type: "object", properties: {} } },
    ]);
  });
});
