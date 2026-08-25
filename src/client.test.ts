import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GluedlyClient,
  createClientFromEnv,
  DEFAULT_BASE_URL,
} from "./client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GluedlyClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires an API key", () => {
    expect(() => new GluedlyClient({ apiKey: "" })).toThrow(
      /GLUEDLY_API_KEY is required/,
    );
    expect(() => createClientFromEnv({})).toThrow(
      /GLUEDLY_API_KEY environment variable is required/,
    );
  });

  it("lists pages from GET /pages", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(`${DEFAULT_BASE_URL}/pages?page=1`);
      return jsonResponse({
        current_page: 1,
        last_page: 1,
        data: [
          {
            id: 12,
            title: "Products",
            url: "https://example.com/products",
            next_scrape_date: "2026-08-10T12:00:00.000000Z",
          },
        ],
      });
    });

    const client = new GluedlyClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.listPages()).resolves.toEqual([
      {
        id: 12,
        title: "Products",
        url: "https://example.com/products",
        next_scrape_date: "2026-08-10T12:00:00.000000Z",
      },
    ]);

    expect(fetchImpl).toHaveBeenCalledWith(
      `${DEFAULT_BASE_URL}/pages?page=1`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("paginates listPages across all API pages", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/pages?page=1")) {
        return jsonResponse({
          current_page: 1,
          last_page: 2,
          data: [{ id: 1, title: "A", url: "https://a.test", next_scrape_date: null }],
        });
      }
      if (url.endsWith("/pages?page=2")) {
        return jsonResponse({
          current_page: 2,
          last_page: 2,
          data: [{ id: 2, title: "B", url: "https://b.test", next_scrape_date: null }],
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const client = new GluedlyClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.listPages()).resolves.toEqual([
      { id: 1, title: "A", url: "https://a.test", next_scrape_date: null },
      { id: 2, title: "B", url: "https://b.test", next_scrape_date: null },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("triggers scrape via POST /execute", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ page_id: 12 }));
      return jsonResponse({
        page_id: 12,
        data_id: 100,
        data: { ok: true, rows: [], match_counts: {}, warnings: [] },
      });
    });

    const client = new GluedlyClient({
      apiKey: "test-key",
      baseUrl: "https://gluedly.com/api/v1/",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.triggerScrape(12)).resolves.toEqual({
      status: "ok",
      page_id: 12,
      data_id: 100,
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "https://gluedly.com/api/v1/execute",
    );
  });

  it("resolves latest snapshot then returns rows", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/pages/12/data")) {
        return jsonResponse({ data: [{ id: 100 }, { id: 99 }] });
      }
      if (url.endsWith("/pages/12/data/100")) {
        return jsonResponse({
          id: 100,
          page_id: 12,
          data: {
            ok: true,
            rows: [{ title: "Widget", markdown: "# Widget" }],
            match_counts: {},
            warnings: [],
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const client = new GluedlyClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.getSnapshot({ pageId: 12 });
    expect(result.snapshotId).toBe(100);
    expect(result.body).toEqual([{ title: "Widget", markdown: "# Widget" }]);
  });

  it("returns empty rows when no snapshots exist", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));
    const client = new GluedlyClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.getSnapshot({ pageId: 12 })).resolves.toEqual({
      snapshotId: 0,
      body: [],
    });
  });

  it("fetches markdown with Accept header", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Accept).toBe("text/markdown");
      return new Response("# Sample Product\n", {
        status: 200,
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    });

    const client = new GluedlyClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.getSnapshot({
      pageId: 12,
      snapshotId: 100,
      format: "markdown",
    });

    expect(result).toEqual({
      snapshotId: 100,
      body: "# Sample Product\n",
    });
  });
});
