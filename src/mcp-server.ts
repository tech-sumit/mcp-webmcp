import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "./tool-registry.js";
import { parseInputSchema, toMcpAnnotations, toolAnnotations, type WebMCPTool } from "./webmcp-tool.js";

/**
 * Create an MCP server backed by the ToolRegistry.
 *
 * Dynamically lists tools from all sources and routes callTool requests.
 * Sends tools/list_changed notifications when tools are added or removed.
 *
 * Pattern derived from playwright-mcp SDK usage.
 */
export function createMcpServer(registry: ToolRegistry): Server {
  const server = new Server(
    { name: "mcp-webmcp", version: "1.0.0" },
    { capabilities: { tools: { listChanged: true } } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.listTools().map((t: WebMCPTool) => {
      const annotations = toMcpAnnotations(t);
      const webmcpAnnotations = toolAnnotations(t);
      return {
        name: t.name,
        ...(t.title && { title: t.title }),
        description: t.description,
        inputSchema: parseInputSchema(t.inputSchema),
        ...(annotations && { annotations }),
        // Preserve the original WebMCP hints (e.g. `debugging`) and the registering
        // document's origin, which the spec expects agents to be shown
        ...((webmcpAnnotations || t.origin) && {
          _meta: {
            ...(webmcpAnnotations && { "webmcp/annotations": webmcpAnnotations }),
            ...(t.origin && { "webmcp/origin": t.origin }),
          },
        }),
      };
    }),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const content = await registry.callTool(
      req.params.name,
      // MCP sends parsed object; WebMCP expects DOMString
      JSON.stringify(req.params.arguments ?? {}),
    );

    return { content };
  });

  // Notify connected MCP clients when tool list changes
  registry.onChanged(() => {
    server.sendToolListChanged().catch(() => {
      // Ignore if no client is connected
    });
  });

  return server;
}
