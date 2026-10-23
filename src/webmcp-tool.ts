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
 */
export function toolAnnotations(tool: WebMCPTool): WebMCPToolAnnotations | undefined {
  if (!tool.annotations && tool.readOnlyHint == null) return undefined;
  return {
    ...tool.annotations,
    readOnlyHint: tool.annotations?.readOnlyHint ?? tool.readOnlyHint ?? false,
  };
}

/**
 * Map WebMCP tool metadata to MCP `ToolAnnotations`.
 *
 * - `title` → `title`
 * - `readOnlyHint` → `readOnlyHint`
 * - `consequentialHint` (significant, real-world or non-reversible) → `destructiveHint`
 * - `untrustedContentHint` (output contains untrusted data) → `openWorldHint`
 */
export function toMcpAnnotations(tool: WebMCPTool): Record<string, unknown> | undefined {
  const a = toolAnnotations(tool);
  const out: Record<string, unknown> = {};
  if (tool.title) out.title = tool.title;
  if (a) {
    out.readOnlyHint = a.readOnlyHint;
    if (a.consequentialHint != null) out.destructiveHint = a.consequentialHint;
    if (a.untrustedContentHint != null) out.openWorldHint = a.untrustedContentHint;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
