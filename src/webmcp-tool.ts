import type { DiscoveredTool } from "@tech-sumit/ai-inspector-types";

/** WebMCP `ToolAnnotations` per the spec (all hints default to `false`). */
export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
  debugging?: boolean;
  /** Chromium-only: declarative tool declared with `toolautosubmit`. */
  autosubmit?: boolean;
}

/**
 * A discovered tool with the optional fields newer sources (webmcp-cdp 0.3+,
 * the extension) attach, matching the spec's `RegisteredTool` dictionary.
 */
export interface WebMCPTool extends DiscoveredTool {
  title?: string;
  annotations?: WebMCPToolAnnotations;
  origin?: string;
}

/** Parse a JSON-stringified input schema; absent or malformed → empty object schema. */
export function parseInputSchema(inputSchema: string | undefined): Record<string, unknown> {
  if (!inputSchema) return { type: "object", properties: {} };
  try {
    const parsed = JSON.parse(inputSchema) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed schema — fall back to empty object schema
  }
  return { type: "object", properties: {} };
}

/**
 * Normalized WebMCP annotations for a tool, merging the legacy top-level
 * `readOnlyHint` with `annotations`. Returns undefined if neither is set.
 *
 * Per spec every hint defaults to `false` once annotations are present.
 * Chrome omits false hints from `getTools()`, so the defaults are filled in.
 */
export function toolAnnotations(tool: WebMCPTool): WebMCPToolAnnotations | undefined {
  if (!tool.annotations && tool.readOnlyHint == null) return undefined;
  const a = tool.annotations;
  return {
    ...a,
    readOnlyHint: a?.readOnlyHint ?? tool.readOnlyHint ?? false,
    untrustedContentHint: a?.untrustedContentHint ?? false,
    consequentialHint: a?.consequentialHint ?? false,
    debugging: a?.debugging ?? false,
  };
}

/**
 * Map WebMCP tool metadata to MCP `ToolAnnotations`.
 *
 * - `title` → `title`
 * - `readOnlyHint` → `readOnlyHint`
 * - `consequentialHint` (significant, real-world or non-reversible) → `destructiveHint`
 * - `untrustedContentHint` (output contains untrusted data) → `openWorldHint`
 *
 * WebMCP hints default to `false` while MCP's `destructiveHint` and
 * `openWorldHint` default to `true`, so when a tool has annotations both
 * are always set explicitly. A tool with no annotations gets no hints, and
 * MCP clients keep their conservative defaults.
 */
export function toMcpAnnotations(tool: WebMCPTool): Record<string, unknown> | undefined {
  const a = toolAnnotations(tool);
  const out: Record<string, unknown> = {};
  if (tool.title) out.title = tool.title;
  if (a) {
    out.readOnlyHint = a.readOnlyHint;
    out.destructiveHint = a.consequentialHint;
    out.openWorldHint = a.untrustedContentHint;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
