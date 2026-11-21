# @tech-sumit/mcp-webmcp

[![npm](https://img.shields.io/npm/v/@tech-sumit/mcp-webmcp)](https://www.npmjs.com/package/@tech-sumit/mcp-webmcp)

MCP server that bridges browser [WebMCP](https://AIdevelopment.blog/web-mcp) tools to desktop AI apps. Connects to Chrome via Playwright and exposes 26 browser automation tools + WebMCP meta-tools over the Model Context Protocol.

## Install

```bash
npm install -g @tech-sumit/mcp-webmcp
```

Or run directly with npx (no install needed):

```bash
npx -y @tech-sumit/mcp-webmcp
```

## Quick Start

### Option 1: Auto-launch browser on startup (`--launch`)

Add to your MCP client config (`~/.cursor/mcp.json` or Claude Desktop):

```json
{
  "mcpServers": {
    "mcp-webmcp": {
      "command": "npx",
      "args": ["-y", "@tech-sumit/mcp-webmcp", "--launch"]
    }
  }
}
```

The server launches Chrome Beta with WebMCP enabled on startup. All 26 tools are immediately available.

### Option 2: Let the AI agent launch the browser (default)

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

Without `--launch`, all 26 tools are registered but no browser is started. The AI agent calls the `browser_launch` tool when it needs a browser. This gives the client full control over when and how the browser is launched.

## Architecture

```mermaid
graph TD
    subgraph mcp_webmcp ["MCP-WebMCP Server"]
        PB["PlaywrightBrowserSource<br/>24 browser tools + 2 WebMCP meta-tools"]
        TR[ToolRegistry]
        MCP["MCP Server"]
    end

    subgraph transport ["Transport Layer"]
        STDIO["stdio<br/>(default, for mcp.json)"]
        HTTP["HTTP /mcp<br/>:3100 (optional)"]
    end

    subgraph browser_modes ["Browser Connection"]
        Launch["--launch<br/>chromium.launch()"]
        CDP["CDP :9222<br/>connectOverCDP()"]
    end

    Launch --> PB
    CDP --> PB
    PB --> TR
    TR --> MCP
    MCP --> STDIO
    MCP --> HTTP

    STDIO --> Cursor["Cursor"]
    STDIO --> Claude["Claude Desktop"]
    HTTP --> Any["Any MCP Client"]
```

### Connection Modes

| Mode | How it works | When to use |
|---|---|---|
| **`--launch` flag** | Launches Chrome on startup via `chromium.launch()`. Injects `--enable-features=WebMCPTesting,DevToolsWebMCPSupport` automatically. | Zero-config setup. Browser ready immediately. |
| **`browser_launch` tool** _(default)_ | No browser on startup. AI agent calls `browser_launch` tool when needed. | Agent controls when to open the browser. |

### Transport Modes

| Transport | How to use | When to use |
|---|---|---|
| **stdio** | Run `mcp-webmcp` (no subcommand) | For mcp.json / npx. Client spawns process, communicates via stdin/stdout. |
| **HTTP** | Run `mcp-webmcp start` | For hosted/manual usage. Streamable HTTP on `/mcp` endpoint. |

## Prerequisites

| Requirement | Details |
|---|---|
| **Node.js** | v18+ |
| **Chrome** | Version **149+** (WebMCP origin trial) with `chrome://flags/#enable-webmcp-testing` enabled, or launched with `--enable-features=WebMCPTesting,DevToolsWebMCPSupport`. Chrome 146–151 still work through the legacy `navigator.modelContextTesting` API. |

### Checking your Chrome version

```bash
# macOS — Chrome Beta
/Applications/Google\ Chrome\ Beta.app/Contents/MacOS/Google\ Chrome\ Beta --version

# macOS — Chrome Canary
/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary --version

# Linux
google-chrome-beta --version

# Windows
"C:\Program Files\Google\Chrome Beta\Application\chrome.exe" --version
```

The server validates Chrome >= 146 on startup (149+ recommended) and will throw a clear error if the version is too old.

## Setup

### Cursor

Add to `~/.cursor/mcp.json`:

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

Add `"--launch"` to `args` if you want Chrome to open on startup.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Local development

```json
{
  "mcpServers": {
    "mcp-webmcp": {
      "command": "node",
      "args": ["/path/to/dist/cli.js"]
    }
  }
}
```

### HTTP transport (hosted server)

For manual or hosted usage, run the server as an HTTP endpoint:

```bash
mcp-webmcp start [--launch] [--port 3100]
```

Connect your MCP client to `http://localhost:3100/mcp`.

### Auto-configure

```bash
mcp-webmcp config cursor   # writes ~/.cursor/mcp.json
mcp-webmcp config claude    # writes Claude Desktop config
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--launch` | Launch browser on startup (otherwise use `browser_launch` tool) | `false` |
| `--channel <ch>` | Browser channel: `chrome`, `chrome-beta`, `chrome-canary`, `msedge`, `msedge-beta`, `msedge-dev` | `chrome-beta` |
| `--headless` | Run browser in headless mode | `false` |
| `--url <url>` | Navigate to URL after launch | _(none)_ |

## Available Tools (26)

### Tool Categories

```mermaid
graph TD
    subgraph browser_auto ["Browser Automation (24 tools)"]
        direction LR
        Nav["Navigation<br/>navigate, back, forward, reload"]
        State["Page State<br/>url, snapshot, screenshot<br/>console_logs, network_requests"]
        Interact["Interaction<br/>click, type, fill, hover<br/>select_option, press_key, focus"]
        Scroll["Scrolling<br/>scroll"]
        Tabs["Tab Management<br/>tab_list, tab_new<br/>tab_select, tab_close"]
        JS["JavaScript<br/>evaluate"]
        Wait["Wait<br/>wait"]
        Lifecycle["Lifecycle<br/>launch"]
    end

    subgraph webmcp_meta ["WebMCP Meta-Tools (2 tools)"]
        direction LR
        List["webmcp_list_tools<br/>Discover page tools"]
        Call["webmcp_call_tool<br/>Execute page tools"]
    end
```

### Browser Automation (24 tools)

| Tool | Description |
|---|---|
| `browser_launch` | Launch a new browser window (closes existing). Supported channels: chrome, chrome-beta, chrome-canary, msedge. Cross-platform. |
| `browser_navigate` | Navigate to a URL |
| `browser_back` | Go back in history |
| `browser_forward` | Go forward in history |
| `browser_reload` | Reload current page |
| `browser_url` | Get current URL and title |
| `browser_snapshot` | Accessibility tree with `[ref=N]` markers for element targeting |
| `browser_screenshot` | Take a PNG screenshot |
| `browser_console_logs` | Get buffered console log messages |
| `browser_network_requests` | Get buffered network requests with status codes |
| `browser_click` | Click an element by ref |
| `browser_type` | Type text character by character |
| `browser_fill` | Clear and fill an input field |
| `browser_hover` | Hover over an element |
| `browser_select_option` | Select a dropdown option |
| `browser_press_key` | Press a keyboard key |
| `browser_focus` | Focus an element |
| `browser_scroll` | Scroll page or element |
| `browser_tab_list` | List all open tabs |
| `browser_tab_new` | Open a new tab |
| `browser_tab_select` | Switch to a tab |
| `browser_tab_close` | Close a tab |
| `browser_evaluate` | Execute JavaScript in page context |
| `browser_wait` | Wait for time or CSS selector |

### WebMCP Meta-Tools (2 tools)

| Tool | Description |
|---|---|
| `webmcp_list_tools` | List WebMCP tools registered on the active page |
| `webmcp_call_tool` | Execute a WebMCP tool by name on the active page |

WebMCP tools are **dynamic** — they change as the user navigates between pages. Always call `webmcp_list_tools` before `webmcp_call_tool` to discover what's available.

### Element Targeting: Snapshot + Ref

```mermaid
sequenceDiagram
    participant Agent
    participant Server
    participant Page

    Agent->>Server: browser_snapshot
    Server->>Page: ariaSnapshot()
    Page-->>Server: Accessibility tree
    Note over Server: Assigns [ref=N] to each element
    Server-->>Agent: Annotated snapshot

    Note over Agent: Picks ref=5 for Submit button

    Agent->>Server: browser_click {ref: 5}
    Note over Server: Resolves ref=5 via getByRole().nth()
    Server->>Page: Click resolved locator
    Page-->>Server: Done
    Server-->>Agent: Clicked button Submit ref=5
```

## CLI Reference

### `mcp-webmcp` (default — stdio mode)

Run as stdio MCP server. This is what `mcp.json` invokes.

```bash
mcp-webmcp [options]
```

| Option | Description | Default |
|---|---|---|
| `--launch` | Launch browser on startup (otherwise use `browser_launch` tool) | `false` |
| `--channel <ch>` | Browser channel | `chrome-beta` |
| `--headless` | Launch in headless mode | `false` |
| `--url <url>` | Initial URL to open | _(none)_ |
| `--extension` | Enable Chrome extension WebSocket bridge | `false` |
| `--ws-port <port>` | Extension WebSocket port | `8765` |
| `--no-browser-tools` | Disable Playwright browser tools | `false` |

### `mcp-webmcp start` (HTTP mode)

Start the MCP server over HTTP.

```bash
mcp-webmcp start [options]
```

Same options as stdio mode, plus:

| Option | Description | Default |
|---|---|---|
| `--port <port>` | HTTP server port | `3100` |

### `mcp-webmcp list-tools`

List all WebMCP tools from connected browser tabs (uses CDP directly).

```bash
mcp-webmcp list-tools [--host localhost] [--port 9222]
```

### `mcp-webmcp call-tool <name> [args]`

Execute a WebMCP tool by name.

```bash
mcp-webmcp call-tool searchFlights '{"from":"SFO","to":"JFK"}'
```

### `mcp-webmcp config <client>`

Write MCP client configuration (stdio-based).

```bash
mcp-webmcp config cursor   # writes ~/.cursor/mcp.json
mcp-webmcp config claude    # writes Claude Desktop config
```

## Demo: Booking a Table via WebMCP

This demo shows the full flow: an AI agent uses `browser_launch` to open Chrome, navigates to a WebMCP-enabled restaurant page, discovers the `book_table_le_petit_bistro` tool, and books a table — all via MCP.

### Agent Workflow

```mermaid
sequenceDiagram
    participant Agent as AI Agent (Cursor)
    participant MCP as MCP-WebMCP
    participant Chrome as Chrome Browser
    participant Page as Le Petit Bistro

    Agent->>MCP: browser_launch {channel: "chrome-beta"}
    MCP->>Chrome: chromium.launch()
    Chrome-->>MCP: Browser ready
    MCP-->>Agent: "Launched chrome-beta"

    Agent->>MCP: browser_navigate {url: "localhost:5173"}
    MCP->>Chrome: page.goto()
    Chrome-->>MCP: Page loaded
    MCP-->>Agent: "Le Petit Bistro"

    Agent->>MCP: webmcp_list_tools
    MCP->>Page: document.modelContext.getTools()
    Page-->>MCP: [{name: "book_table_le_petit_bistro", ...}]
    MCP-->>Agent: Tool schema with inputs

    Agent->>MCP: webmcp_call_tool {name: "book_table_le_petit_bistro", ...}
    MCP->>Page: document.modelContext.executeTool(tool, input)
    Page-->>MCP: "Reservation confirmed"
    MCP-->>Agent: "Hello Sumit, We look forward to welcoming you..."
```

### What happens

1. **`browser_launch`** opens Chrome Beta with `--enable-features=WebMCPTesting,DevToolsWebMCPSupport`
2. **`browser_navigate`** loads the Le Petit Bistro reservation form
3. **`webmcp_list_tools`** discovers `book_table_le_petit_bistro` and its full input schema (name, phone, date, time, guests, seating, requests)
4. **`webmcp_call_tool`** books the table — the form auto-fills and a confirmation modal appears: *"Reservation Received — Bon Appetit!"*

## Troubleshooting

### Decision Tree

```mermaid
flowchart TD
    Problem(["Something went wrong"]) --> Q0{"Using --launch mode?"}
    Q0 -- Yes --> Q0a{"Chrome Beta/Canary<br/>installed?"}
    Q0a -- No --> F0["Install Chrome Beta<br/>chrome.google.com/beta"]
    Q0a -- Yes --> Q3
    Q0 -- No --> Q1{"Can you reach Chrome?<br/>curl localhost:9222/json/version"}
    Q1 -- No --> F1["Launch Chrome with<br/>--remote-debugging-port=9222"]
    Q1 -- Yes --> Q2{"Chrome version >= 146?"}
    Q2 -- No --> F2["Install Chrome Beta/Canary"]
    Q2 -- Yes --> Q3{"Server starts?"}
    Q3 -- No --> F3["Check error message in stderr"]
    Q3 -- Yes --> Q4{"MCP client connects?"}
    Q4 -- No --> F4["Check mcp.json config<br/>Toggle MCP off/on"]
    Q4 -- Yes --> Q5{"WebMCP tools work?"}
    Q5 -- No --> F5["Enable chrome://flags/#enable-webmcp-testing<br/>or --enable-features=WebMCPTesting,DevToolsWebMCPSupport<br/>(--launch adds it automatically)"]
    Q5 -- Yes --> OK(["Everything working"])
```

### Common Issues

#### "Chrome version X is not supported"

Your Chrome is older than 146. Install Chrome Beta or Canary:
- https://www.google.com/chrome/beta/
- https://www.google.com/chrome/canary/

#### "WebMCP is NOT available"

`document.modelContext` is undefined on the page. Enable `chrome://flags/#enable-webmcp-testing` (Chrome 149+), or close all Chrome windows and relaunch with `--enable-features=WebMCPTesting,DevToolsWebMCPSupport`. Launch mode (`--launch`) adds these flags automatically. Pages enrolled in the WebMCP origin trial work without flags.

#### "No browser contexts found"

Chrome is not running with `--remote-debugging-port=9222`, or it has no tabs open. Use `--launch` mode instead, or verify with:

```bash
curl http://localhost:9222/json/version
```

#### "Target page, context or browser has been closed"

The browser connection was lost. Use `browser_launch` tool to start a new browser, or restart the MCP server.

#### Screenshot timeouts

Playwright waits for web fonts to load before taking screenshots. The server uses a 10-second timeout to avoid hanging.

#### Click fails on modal/overlay elements

Elements in `position: fixed` overlays may not be scrollable into view. The server automatically retries with `force: true` to click at the element's coordinates directly.

## Development

```bash
pnpm install           # install dependencies
pnpm build             # compile with tsup → dist/
pnpm dev               # watch mode
pnpm start             # run HTTP server (CDP mode)
pnpm start:stdio       # run stdio server
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint
pnpm test              # vitest
pnpm format            # prettier
```

## License

MIT
