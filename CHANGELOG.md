# Changelog

## 0.3.0 (2026-10-23)

Aligns with the October 2026 WebMCP draft and Chromium, which removed `navigator.modelContextTesting` in Chrome 152.

### Features

- **`document.modelContext` support**: `webmcp_list_tools` uses `document.modelContext.getTools()` and `webmcp_call_tool` uses `document.modelContext.executeTool(registeredTool, inputObject)`. The startup probe detects `document.modelContext` first and falls back to the legacy `navigator.modelContextTesting` on Chrome 146–151
- **Full annotation mapping**: `tools/list` now maps WebMCP `title` → MCP `title`, `readOnlyHint` → `readOnlyHint`, `consequentialHint` → `destructiveHint` and `untrustedContentHint` → `openWorldHint`. Because WebMCP hints default to `false` and MCP's `destructiveHint`/`openWorldHint` default to `true`, both are set explicitly whenever a tool has annotations (Chrome omits false hints, so the spec defaults are filled in). The original WebMCP hints (including `debugging`) are passed through in `_meta["webmcp/annotations"]`
- **Tool origin**: the registering document's origin is passed in `_meta["webmcp/origin"]` and in `webmcp_list_tools` output, since the spec expects agents to be shown each tool's origin
- **Richer `webmcp_list_tools` output**: includes each tool's `title`, `annotations` and (for cross-origin iframe tools) `origin`; the description tells agents to treat `untrustedContentHint` output as untrusted and to confirm `consequentialHint` tools with the user
- **Launch flags**: `--launch` / `browser_launch` now pass `--enable-features=WebMCPTesting,DevToolsWebMCPSupport` so the CDP `WebMCP` domain is available too

- **Chrome 153 compatibility**: accepts `inputSchema` as an object (spec) or JSON string (current Chrome) and retries `executeTool()` with a JSON string input when Chrome rejects the spec's object form. Verified end to end against Chrome 153.0.8010.12

### Bug fixes

- Tools without an `inputSchema` (allowed by the spec) no longer crash `webmcp_list_tools` with a JSON parse error

### Documentation

- Prerequisites, troubleshooting and sequence diagram updated for Chrome 149+, `chrome://flags/#enable-webmcp-testing` and `document.modelContext`


## 0.2.0 (2026-03-04)

### Features

- **`readOnlyHint` forwarded as MCP annotations**: When a discovered tool has `readOnlyHint` set (per the spec's formalized tool definition struct), the MCP server now includes it as `annotations: { readOnlyHint }` in the `tools/list` response, so MCP clients can leverage the hint
- **Playwright browser automation**: New `PlaywrightBrowserSource` providing 25 tools via Playwright connected over CDP
  - 23 browser automation tools: navigation (`navigate`, `back`, `forward`, `reload`), page state (`url`, `snapshot`, `screenshot`, `console_logs`, `network_requests`), element interaction (`click`, `type`, `fill`, `hover`, `select_option`, `press_key`, `focus`), scrolling (`scroll`), tab management (`tab_list`, `tab_new`, `tab_select`, `tab_close`), JavaScript execution (`evaluate`), and waiting (`wait`)
  - 2 WebMCP meta-tools: `webmcp_list_tools` and `webmcp_call_tool` for dynamic page tool discovery and execution via `navigator.modelContextTesting`
  - Element targeting via accessibility tree snapshots with `[ref=N]` markers resolved to Playwright locators
  - Buffered console log and network request capture
  - Page event listener management via `WeakSet<Page>` to prevent duplicates
- **Per-session MCP server**: Each client connection gets its own `MCP Server` + `StreamableHTTPServerTransport` pair, backed by the shared `ToolRegistry`
- **Chrome version check**: Validates Chrome >= 146 on startup; hard error with download link if too old
- **WebMCP availability check**: Probes `navigator.modelContextTesting` on startup; warns if not enabled
- **Stale session handling**: Non-initialize requests with unknown session IDs return HTTP 404 with a clear re-initialize message
- **Rich tool results**: `ToolRegistry.callTool()` and MCP `CallToolRequestSchema` handler now support `ToolCallResultContent[]` (text + image blocks)

### Spec alignment

- Tool listing now maps the WebMCP spec's `readOnlyHint` (a top-level field on the tool definition struct) to MCP's `annotations.readOnlyHint`, bridging the two protocols

### Bug fixes

- **Screenshot timeout**: Added 10s timeout to `page.screenshot()` to prevent hanging on slow font loading
- **Modal click fallback**: `browser_click` now uses a two-phase strategy — tries normal click first, falls back to `force: true` for elements in fixed/overlay containers that can't be scrolled into view
- **"Server already initialized" error**: Fixed by creating per-session MCP server instances instead of a single long-lived server — clients can disconnect and reconnect without errors
- **Stale session 400 error**: Requests with unknown session IDs now return 404 instead of creating an uninitialized transport that would fail on non-initialize requests
- **Duplicate shebang**: Removed `banner` option from `tsup.config.ts` that was duplicating `#!/usr/bin/env node` in ESM output

### Documentation

- **Comprehensive README**: Full setup instructions with Mermaid architecture diagrams, prerequisites, step-by-step setup, all 25 tools documented, CLI reference, end-to-end demo walkthrough, troubleshooting decision tree, and session management sequence diagram

## 0.1.0 (2026-02-17)

### Features

- **MCP server**: Bridges browser WebMCP tools to desktop MCP clients via HTTP `/mcp` endpoint
  - `ListToolsRequestSchema` handler: converts DOMString `inputSchema` to parsed JSON objects for MCP clients
  - `CallToolRequestSchema` handler: converts MCP object arguments to JSON DOMString for WebMCP execution
  - Sends `tools/list_changed` notifications when tool sources update
- **ToolRegistry**: Central aggregation of tools from multiple sources (CDP, extension)
  - Routes `callTool` to the correct source
  - Deduplicates by tool name across sources
- **ExtensionToolSource**: WebSocket server receiving tools from Chrome extension background
  - Per-tab tool tracking to correctly aggregate tools from multiple browser tabs
  - Bidirectional tool execution: server sends `CALL_TOOL`, extension sends `TOOL_RESULT`
  - 30s timeout for pending tool calls
  - Graceful disconnect with pending call rejection
- **HTTP server**: Express-based with `StreamableHTTPServerTransport` and health check endpoint
- **CLI**: `commander`-based with `start`, `list-tools`, `call-tool`, `config` commands
- **Config utility**: Auto-configures Cursor and Claude Desktop MCP client settings
- **Docker**: Containerized deployment via Dockerfile

### Bug fixes

- **JSON body parsing**: Added `express.json()` middleware to ensure `req.body` is parsed for MCP transport
- **Schema parsing safety**: Wrapped `JSON.parse(inputSchema)` in try-catch, falls back to `{ type: "object" }` for malformed schemas
- **WebSocket startup errors**: `connect()` Promise now rejects on server-level errors (e.g., port in use) instead of hanging indefinitely
- **Tool replacement semantics**: `ToolRegistry.addTools()` removes all previous entries from a source before adding new ones, preventing stale tools from persisting after `provideContext` replacements
- **Per-tab tool aggregation**: `ExtensionToolSource` now stores tools per-tab (`Map<tabId, tools>`) instead of replacing the entire array, so updates from one tab don't discard tools from other tabs
