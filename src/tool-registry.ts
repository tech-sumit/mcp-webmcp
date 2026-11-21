import type {
  DiscoveredTool,
  ToolSource,
  ToolCallResultContent,
} from "@tech-sumit/ai-inspector-types";

interface RegistryEntry {
  tool: DiscoveredTool;
  source: ToolSource;
}

/**
 * Central aggregation of tools from all sources (CDP, extension, etc.).
 * Provides a unified view of available tools and routes callTool to the source.
 */
export class ToolRegistry {
  private entries = new Map<string, RegistryEntry>();
  private listeners = new Set<() => void>();

  /**
   * Replace all tools from a source with a new set.
   * Removes stale entries that were previously associated with this source
   * but are no longer in the new list (e.g., after a page navigates or aborts a registration signal).
   */
  addTools(source: ToolSource, tools: DiscoveredTool[]): void {
    // Remove all previous entries from this source
    for (const [name, entry] of this.entries) {
      if (entry.source === source) {
        this.entries.delete(name);
      }
    }
    // Add all current tools
    for (const tool of tools) {
      this.entries.set(tool.name, { tool, source });
    }
    this.notify();
  }

  /** Remove all tools associated with a given source. */
  removeToolsBySource(source: ToolSource): void {
    for (const [name, entry] of this.entries) {
      if (entry.source === source) {
        this.entries.delete(name);
      }
    }
    this.notify();
  }

  /** List all currently registered tools. */
  listTools(): DiscoveredTool[] {
    return Array.from(this.entries.values()).map((e) => e.tool);
  }

  /** Get a specific tool by name. */
  getTool(name: string): DiscoveredTool | undefined {
    return this.entries.get(name)?.tool;
  }

  /**
   * Execute a tool by name, routing to the correct source.
   *
   * @param name - Tool name
   * @param inputArguments - JSON-encoded input (DOMString per WebMCP spec)
   * @returns Array of content blocks (text, image, etc.)
   */
  async callTool(
    name: string,
    inputArguments: string,
  ): Promise<ToolCallResultContent[]> {
    const entry = this.entries.get(name);
    if (!entry) {
      throw new Error(
        `Unknown tool: "${name}". Available: ${this.listTools().map((t) => t.name).join(", ") || "(none)"}`,
      );
    }
    return entry.source.callTool(name, inputArguments);
  }

  /** Register a callback for when the tool list changes. */
  onChanged(cb: () => void): void {
    this.listeners.add(cb);
  }

  /** Unregister a change callback. */
  offChanged(cb: () => void): void {
    this.listeners.delete(cb);
  }

  /** Number of registered tools. */
  get size(): number {
    return this.entries.size;
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }
}
