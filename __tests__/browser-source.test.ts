import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// All mock objects must be created inside the vi.mock factory because
// vi.mock is hoisted above all variable declarations.
vi.mock("playwright", () => {
  const locatorInstance = {
    click: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    press: vi.fn().mockResolvedValue(undefined),
    pressSequentially: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    nth: vi.fn().mockReturnThis(),
    ariaSnapshot: vi.fn().mockResolvedValue(
      [
        '- heading "Welcome" [level=1]',
        '- button "Submit"',
        '- textbox "Email": test@test.com',
      ].join("\n"),
    ),
  };

  const page = {
    url: vi.fn().mockReturnValue("https://example.com"),
    title: vi.fn().mockResolvedValue("Example"),
    goto: vi.fn().mockResolvedValue(null),
    goBack: vi.fn().mockResolvedValue(null),
    goForward: vi.fn().mockResolvedValue(null),
    reload: vi.fn().mockResolvedValue(null),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(null),
    bringToFront: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    locator: vi.fn().mockReturnValue(locatorInstance),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
    },
    mouse: {
      wheel: vi.fn().mockResolvedValue(undefined),
    },
    getByRole: vi.fn().mockReturnValue(locatorInstance),
  };

  const context = {
    pages: vi.fn().mockReturnValue([page]),
    newPage: vi.fn().mockResolvedValue(page),
  };

  const browser = {
    contexts: vi.fn().mockReturnValue([context]),
    close: vi.fn().mockResolvedValue(undefined),
    version: vi.fn().mockReturnValue("146.0.6478.0"),
  };

  return {
    chromium: {
      connectOverCDP: vi.fn().mockResolvedValue(browser),
    },
    // Expose internals for assertions
    __mocks: { browser, context, page, locatorInstance },
  };
});

import { PlaywrightBrowserSource } from "../src/sources/browser.js";

/** Helper to access the internal mocks created by the vi.mock factory. */
async function getMocks() {
  const mod = (await import("playwright")) as unknown as {
    __mocks: {
      browser: Record<string, ReturnType<typeof vi.fn>>;
      context: Record<string, ReturnType<typeof vi.fn>>;
      page: Record<string, ReturnType<typeof vi.fn> | Record<string, ReturnType<typeof vi.fn>>>;
      locatorInstance: Record<string, ReturnType<typeof vi.fn>>;
    };
  };
  return mod.__mocks;
}

describe("PlaywrightBrowserSource", () => {
  let source: PlaywrightBrowserSource;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-set default return values after clearAllMocks
    const { browser, context, page, locatorInstance } = await getMocks();
    (browser.version as ReturnType<typeof vi.fn>).mockReturnValue("146.0.6478.0");
    (browser.contexts as ReturnType<typeof vi.fn>).mockReturnValue([context]);
    (context.pages as ReturnType<typeof vi.fn>).mockReturnValue([page]);
    (context.newPage as ReturnType<typeof vi.fn>).mockResolvedValue(page);
    ((page as Record<string, unknown>).url as ReturnType<typeof vi.fn>).mockReturnValue(
      "https://example.com",
    );
    ((page as Record<string, unknown>).title as ReturnType<typeof vi.fn>).mockResolvedValue("Example");
    ((page as Record<string, unknown>).screenshot as ReturnType<typeof vi.fn>).mockResolvedValue(
      Buffer.from("fake-png"),
    );
    ((page as Record<string, unknown>).locator as ReturnType<typeof vi.fn>).mockReturnValue(
      locatorInstance,
    );
    ((page as Record<string, unknown>).getByRole as ReturnType<typeof vi.fn>).mockReturnValue(
      locatorInstance,
    );
    (locatorInstance.nth as ReturnType<typeof vi.fn>).mockReturnThis();
    (locatorInstance.ariaSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(
      [
        '- heading "Welcome" [level=1]',
        '- button "Submit"',
        '- textbox "Email": test@test.com',
      ].join("\n"),
    );

    source = new PlaywrightBrowserSource();
    await source.connect({ host: "localhost", port: 9222 });
  });

  afterEach(async () => {
    await source.disconnect();
  });

  // --- Connection ---

  it("should connect via chromium.connectOverCDP", async () => {
    const { chromium } = await import("playwright");
    expect(chromium.connectOverCDP).toHaveBeenCalledWith(
      "http://localhost:9222",
    );
  });

  it("should list all browser tools", () => {
    const tools = source.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(20);

    const names = tools.map((t) => t.name);
    expect(names).toContain("browser_navigate");
    expect(names).toContain("browser_snapshot");
    expect(names).toContain("browser_screenshot");
    expect(names).toContain("browser_click");
    expect(names).toContain("browser_type");
    expect(names).toContain("browser_fill");
    expect(names).toContain("browser_scroll");
    expect(names).toContain("browser_tab_list");
    expect(names).toContain("browser_evaluate");
    expect(names).toContain("browser_wait");
  });

  it("should have valid JSON inputSchema for all tools", () => {
    for (const tool of source.listTools()) {
      expect(() => JSON.parse(tool.inputSchema)).not.toThrow();
      const schema = JSON.parse(tool.inputSchema);
      expect(schema.type).toBe("object");
    }
  });

  // --- Navigation ---

  it("should handle browser_navigate", async () => {
    const { page } = await getMocks();
    const result = await source.callTool(
      "browser_navigate",
      JSON.stringify({ url: "https://example.com" }),
    );
    expect(page.goto).toHaveBeenCalledWith("https://example.com", {
      waitUntil: "domcontentloaded",
    });
    expect(result[0].type).toBe("text");
    expect((result[0] as { text: string }).text).toContain("Navigated to");
  });

  it("should handle browser_back", async () => {
    const { page } = await getMocks();
    const result = await source.callTool("browser_back", "{}");
    expect(page.goBack).toHaveBeenCalled();
    expect(result[0].type).toBe("text");
  });

  it("should handle browser_forward", async () => {
    const { page } = await getMocks();
    const result = await source.callTool("browser_forward", "{}");
    expect(page.goForward).toHaveBeenCalled();
    expect(result[0].type).toBe("text");
  });

  it("should handle browser_reload", async () => {
    const { page } = await getMocks();
    const result = await source.callTool("browser_reload", "{}");
    expect(page.reload).toHaveBeenCalled();
    expect(result[0].type).toBe("text");
  });

  // --- Page state ---

  it("should handle browser_url", async () => {
    const result = await source.callTool("browser_url", "{}");
    expect(result[0].type).toBe("text");
    const parsed = JSON.parse((result[0] as { text: string }).text);
    expect(parsed.url).toBe("https://example.com");
    expect(parsed.title).toBe("Example");
  });

  it("should handle browser_snapshot", async () => {
    const result = await source.callTool("browser_snapshot", "{}");
    expect(result[0].type).toBe("text");
    const text = (result[0] as { text: string }).text;
    expect(text).toContain("Page: https://example.com");
    expect(text).toContain("[ref=");
    expect(text).toContain("heading");
    expect(text).toContain("button");
    expect(text).toContain("textbox");
  });

  it("should handle browser_screenshot", async () => {
    const result = await source.callTool("browser_screenshot", "{}");
    expect(result[0].type).toBe("image");
    expect((result[0] as { mimeType: string }).mimeType).toBe("image/png");
    expect((result[0] as { data: string }).data).toBeTruthy();
  });

  it("should handle browser_screenshot with fullPage", async () => {
    const { page } = await getMocks();
    await source.callTool(
      "browser_screenshot",
      JSON.stringify({ fullPage: true }),
    );
    expect(page.screenshot).toHaveBeenCalledWith({
      fullPage: true,
      type: "png",
      timeout: 10000,
    });
  });

  // --- Element interaction ---

  it("should handle browser_click with ref", async () => {
    const { locatorInstance } = await getMocks();
    // Take snapshot to populate refs
    await source.callTool("browser_snapshot", "{}");

    // ref=2 should be the button "Submit"
    const result = await source.callTool(
      "browser_click",
      JSON.stringify({ ref: 2 }),
    );
    expect(locatorInstance.click).toHaveBeenCalled();
    expect(result[0].type).toBe("text");
    expect((result[0] as { text: string }).text).toContain("Clicked");
  });

  it("should throw on invalid ref", async () => {
    await expect(
      source.callTool("browser_click", JSON.stringify({ ref: 999 })),
    ).rejects.toThrow("Invalid ref 999");
  });

  it("should handle browser_fill with ref", async () => {
    const { locatorInstance } = await getMocks();
    await source.callTool("browser_snapshot", "{}");
    // ref=3 should be the textbox "Email"
    const result = await source.callTool(
      "browser_fill",
      JSON.stringify({ ref: 3, value: "hello@test.com" }),
    );
    expect(locatorInstance.fill).toHaveBeenCalledWith("hello@test.com");
    expect(result[0].type).toBe("text");
    expect((result[0] as { text: string }).text).toContain("Filled");
  });

  it("should handle browser_press_key", async () => {
    const { page } = await getMocks();
    const result = await source.callTool(
      "browser_press_key",
      JSON.stringify({ key: "Enter" }),
    );
    expect(
      (page.keyboard as Record<string, ReturnType<typeof vi.fn>>).press,
    ).toHaveBeenCalledWith("Enter");
    expect(result[0].type).toBe("text");
  });

  // --- Scrolling ---

  it("should handle browser_scroll down", async () => {
    const { page } = await getMocks();
    const result = await source.callTool(
      "browser_scroll",
      JSON.stringify({ direction: "down", amount: 300 }),
    );
    expect(
      (page.mouse as Record<string, ReturnType<typeof vi.fn>>).wheel,
    ).toHaveBeenCalledWith(0, 300);
    expect(result[0].type).toBe("text");
    expect((result[0] as { text: string }).text).toContain("down");
  });

  it("should handle browser_scroll up", async () => {
    const { page } = await getMocks();
    await source.callTool(
      "browser_scroll",
      JSON.stringify({ direction: "up" }),
    );
    expect(
      (page.mouse as Record<string, ReturnType<typeof vi.fn>>).wheel,
    ).toHaveBeenCalledWith(0, -500);
  });

  // --- Tab management ---

  it("should handle browser_tab_list", async () => {
    const result = await source.callTool("browser_tab_list", "{}");
    expect(result[0].type).toBe("text");
    const tabs = JSON.parse((result[0] as { text: string }).text);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].url).toBe("https://example.com");
  });

  it("should handle browser_tab_new", async () => {
    const { context } = await getMocks();
    const result = await source.callTool(
      "browser_tab_new",
      JSON.stringify({ url: "https://new.com" }),
    );
    expect(context.newPage).toHaveBeenCalled();
    expect(result[0].type).toBe("text");
    expect((result[0] as { text: string }).text).toContain("Opened new tab");
  });

  it("should handle browser_tab_select", async () => {
    const { page } = await getMocks();
    const result = await source.callTool(
      "browser_tab_select",
      JSON.stringify({ index: 0 }),
    );
    expect(page.bringToFront).toHaveBeenCalled();
    expect(result[0].type).toBe("text");
  });

  it("should throw on out-of-range tab index", async () => {
    await expect(
      source.callTool("browser_tab_select", JSON.stringify({ index: 99 })),
    ).rejects.toThrow("out of range");
  });

  // --- JavaScript ---

  it("should handle browser_evaluate", async () => {
    const { page } = await getMocks();
    (page.evaluate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      foo: "bar",
    });
    const result = await source.callTool(
      "browser_evaluate",
      JSON.stringify({ expression: "document.title" }),
    );
    expect(page.evaluate).toHaveBeenCalledWith("document.title");
    expect(result[0].type).toBe("text");
  });

  // --- Wait ---

  it("should handle browser_wait with time", async () => {
    const { page } = await getMocks();
    const result = await source.callTool(
      "browser_wait",
      JSON.stringify({ time: 1000 }),
    );
    expect(page.waitForTimeout).toHaveBeenCalledWith(1000);
    expect(result[0].type).toBe("text");
    expect((result[0] as { text: string }).text).toContain("1000ms");
  });

  it("should handle browser_wait with selector", async () => {
    const { page } = await getMocks();
    const result = await source.callTool(
      "browser_wait",
      JSON.stringify({ selector: "#app" }),
    );
    expect(page.waitForSelector).toHaveBeenCalledWith("#app", {
      timeout: 30000,
    });
    expect(result[0].type).toBe("text");
  });

  it("should throw when neither time nor selector provided", async () => {
    await expect(source.callTool("browser_wait", "{}")).rejects.toThrow(
      "Provide either time",
    );
  });

  // --- Error handling ---

  it("should throw for unknown tool name", async () => {
    await expect(
      source.callTool("browser_nonexistent", "{}"),
    ).rejects.toThrow('Unknown browser tool: "browser_nonexistent"');
  });

  // --- WebMCP page tools ---

  it("should list WebMCP tools via document.modelContext.getTools()", async () => {
    const { page } = await getMocks();
    (page.evaluate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      available: true,
      tools: [{ name: "book_table", title: "Book", description: "Book a table", inputSchema: {} }],
    });
    const result = await source.callTool("webmcp_list_tools", "{}");
    expect(JSON.parse((result[0] as { text: string }).text)[0]).toMatchObject({
      name: "book_table",
      title: "Book",
    });
  });

  it("should report WebMCP as unavailable with spec-era guidance", async () => {
    const { page } = await getMocks();
    (page.evaluate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ available: false });
    const result = await source.callTool("webmcp_list_tools", "{}");
    const text = (result[0] as { text: string }).text;
    expect(text).toContain("document.modelContext is undefined");
    expect(text).toContain("chrome://flags/#enable-webmcp-testing");
  });

  it("should execute WebMCP tools via document.modelContext.executeTool()", async () => {
    const { page } = await getMocks();
    (page.evaluate as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce("document")
      .mockResolvedValueOnce('{"booked":true}');
    const result = await source.callTool(
      "webmcp_call_tool",
      JSON.stringify({ name: "book_table", arguments: { guests: 2 } }),
    );
    expect(result).toEqual([{ type: "text", text: '{"booked":true}' }]);
    expect((page.evaluate as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]).toEqual({
      name: "book_table",
      input: { guests: 2 },
      api: "document",
    });
  });
});
