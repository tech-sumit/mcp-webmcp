# mcp-webmcp

MCP server bridging browser WebMCP tools to desktop MCP clients.

## Architecture
- ToolRegistry aggregates tools from CdpToolSource and ExtensionToolSource
- MCP server uses @modelcontextprotocol/sdk with ListTools + CallTool handlers
- **Stdio transport** (default) for mcp.json / npx usage — stdout is MCP protocol, logs go to stderr
- Streamable HTTP transport on /mcp via `start` subcommand (for hosted/manual usage)
- CLI wraps server functionality via commander

## Transport modes
- **stdio (default)**: `mcp-webmcp` or `npx @tech-sumit/mcp-webmcp` — for mcp.json config
- **HTTP**: `mcp-webmcp start` — runs Express server with StreamableHTTPServerTransport on /mcp

## mcp.json usage
```json
{
  "mcpServers": {
    "mcp-webmcp": {
      "command": "npx",
      "args": ["-y", "@tech-sumit/mcp-webmcp"]
    }
  }
}
```

## Key type conversions
- WebMCP uses DOMString (JSON strings) for inputSchema and tool args
- MCP uses parsed objects for inputSchema and arguments
- Server must JSON.parse inputSchema when sending to MCP clients
- Server must JSON.stringify arguments when calling WebMCP tools
- WebMCP annotations map to MCP annotations: `title`→`title`, `readOnlyHint`→`readOnlyHint`, `consequentialHint`→`destructiveHint`, `untrustedContentHint`→`openWorldHint`; the raw hints go in `_meta["webmcp/annotations"]` (see src/webmcp-tool.ts)
- Page-level WebMCP access uses `document.modelContext.getTools()` / `executeTool(tool, inputObject)`; `navigator.modelContextTesting` is only a fallback for Chrome <= 151

## Sources
- CdpToolSource (from @tech-sumit/webmcp-cdp) — direct CDP connection to Chrome
- ExtensionToolSource — WebSocket server that accepts connections from the extension

## CLI commands
- `mcp-webmcp` — Run as stdio MCP server (default, for mcp.json)
- `mcp-webmcp start` — Start HTTP server (CDP + optional extension bridge)
- `mcp-webmcp list-tools` — List all tools (CDP only)
- `mcp-webmcp call-tool <name> [args]` — Execute a tool (CDP only)
- `mcp-webmcp config <client>` — Configure MCP client (claude, cursor)

## Testing
- Unit tests mock ToolSource interface
- Extension source tests use real WebSocket connections
- Integration tests need Chrome 149+ with chrome://flags/#enable-webmcp-testing (or --enable-features=WebMCPTesting,DevToolsWebMCPSupport)
