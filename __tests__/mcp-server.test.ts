import { describe, it, expect, vi, beforeEach } from "vitest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolRegistry } from "../src/tool-registry.js";
import { createMcpServer } from "../src/mcp-server.js";
import type { ToolSource, DiscoveredTool } from "@tech-sumit/ai-inspector-types";

function mockSource(overrides?: Partial<ToolSource>): ToolSource {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    listTools: vi.fn().mockReturnValue([]),
    callTool: vi
      .fn()
      .mockResolvedValue([{ type: "text", text: '{"result":"ok"}' }]),
    onToolsChanged: vi.fn(),
    ...overrides,
  };
}

const tool: DiscoveredTool = {
  name: "makeReservation",
  description: "Make a reservation",
  inputSchema: '{"type":"object","properties":{"name":{"type":"string"}}}',
};

describe("createMcpServer", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("should create a server with tools capability", () => {
    const server = createMcpServer(registry);
    expect(server).toBeDefined();
  });

  it("should be an instance of Server", () => {
    const server = createMcpServer(registry);
    expect(server).toBeInstanceOf(Server);
  });

  it("should integrate with tool registry", () => {
    const source = mockSource();
    registry.addTools(source, [tool]);

    const server = createMcpServer(registry);
    expect(server).toBeDefined();

    // Verify registry has the tool
    expect(registry.listTools()).toHaveLength(1);
    expect(registry.listTools()[0].name).toBe("makeReservation");
  });

  it("lists WebMCP title, MCP annotations and origin metadata", async () => {
    registry.addTools(mockSource(), [
      {
        ...tool,
        title: "Make a reservation",
        origin: "https://bistro.example",
        annotations: { consequentialHint: true },
      } as DiscoveredTool,
    ]);
    const server = createMcpServer(registry);
    const client = new Client({ name: "test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(tools[0]).toMatchObject({
      name: "makeReservation",
      title: "Make a reservation",
      annotations: {
        title: "Make a reservation",
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
      _meta: {
        "webmcp/annotations": {
          readOnlyHint: false,
          untrustedContentHint: false,
          consequentialHint: true,
          debugging: false,
        },
        "webmcp/origin": "https://bistro.example",
      },
    });
    await client.close();
  });
});
