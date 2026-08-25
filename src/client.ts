export const DEFAULT_BASE_URL = "https://gluedly.com/api/v1";

export type GluedlyPageSummary = {
  id: number;
  title: string;
  url: string;
  next_scrape_date: string | null;
};

export type TriggerScrapeResult = {
  status: "ok" | "failed";
  page_id: number;
  data_id: number;
};

export type SnapshotFormat = "json" | "markdown";

export class GluedlyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "GluedlyApiError";
  }
}

export type FetchLike = typeof fetch;

export class GluedlyClient {
  readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: FetchLike;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    fetchImpl?: FetchLike;
  }) {
    if (!options.apiKey) {
      throw new Error("GLUEDLY_API_KEY is required");
    }

    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.headers = {
      Authorization: `Bearer ${options.apiKey}`,
      Accept: "application/json",
    };
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listPages(): Promise<GluedlyPageSummary[]> {
    const collected: GluedlyPageSummary[] = [];
    let pageNum = 1;
    let lastPage = 1;

    do {
      const payload = await this.requestJson<{
        data?: GluedlyPageSummary[];
        current_page?: number;
        last_page?: number;
      }>("GET", `/pages?page=${pageNum}`);

      const pages = Array.isArray(payload.data) ? payload.data : [];
      for (const page of pages) {
        collected.push({
          id: Number(page.id),
          title: String(page.title ?? ""),
          url: String(page.url ?? ""),
          next_scrape_date:
            page.next_scrape_date === undefined || page.next_scrape_date === null
              ? null
              : String(page.next_scrape_date),
        });
      }

      lastPage = Number(payload.last_page ?? pageNum);
      if (!Number.isFinite(lastPage) || lastPage < 1) {
        lastPage = pageNum;
      }
      pageNum += 1;
    } while (pageNum <= lastPage);

    return collected;
  }

  async triggerScrape(pageId: number): Promise<TriggerScrapeResult> {
    const payload = await this.requestJson<{
      page_id?: number;
      data_id?: number;
      data?: { ok?: boolean };
    }>("POST", "/execute", { page_id: pageId });

    const ok = Boolean(payload.data?.ok);
    const resolvedPageId = Number(payload.page_id ?? pageId);
    const dataId = Number(payload.data_id);

    if (!Number.isFinite(dataId)) {
      throw new Error("Execute response missing data_id");
    }

    return {
      status: ok ? "ok" : "failed",
      page_id: resolvedPageId,
      data_id: dataId,
    };
  }

  async resolveLatestSnapshotId(pageId: number): Promise<number | null> {
    const payload = await this.requestJson<{ data?: Array<{ id?: number }> }>(
      "GET",
      `/pages/${pageId}/data`,
    );
    const snapshots = Array.isArray(payload.data) ? payload.data : [];
    if (snapshots.length === 0) {
      return null;
    }

    const id = Number(snapshots[0]?.id);
    return Number.isFinite(id) ? id : null;
  }

  async getSnapshot(options: {
    pageId: number;
    snapshotId?: number;
    format?: SnapshotFormat;
  }): Promise<{ snapshotId: number; body: unknown }> {
    let snapshotId = options.snapshotId;
    if (snapshotId === undefined || snapshotId === null) {
      const latest = await this.resolveLatestSnapshotId(options.pageId);
      if (latest === null) {
        return { snapshotId: 0, body: options.format === "markdown" ? "" : [] };
      }
      snapshotId = latest;
    }

    const format = options.format ?? "json";
    if (format === "markdown") {
      const text = await this.requestText(
        "GET",
        `/pages/${options.pageId}/data/${snapshotId}`,
        undefined,
        { Accept: "text/markdown" },
      );
      return { snapshotId, body: text };
    }

    const payload = await this.requestJson<{
      data?: { rows?: unknown[] };
    }>("GET", `/pages/${options.pageId}/data/${snapshotId}`);

    const rows = Array.isArray(payload.data?.rows) ? payload.data.rows : [];
    return { snapshotId, body: rows };
  }

  private async requestJson<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const response = await this.rawRequest(method, path, body, extraHeaders);
    const text = await response.text();
    if (!response.ok) {
      throw new GluedlyApiError(
        `Gluedly API ${method} ${path} failed with ${response.status}`,
        response.status,
        text,
      );
    }

    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  private async requestText(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<string> {
    const response = await this.rawRequest(method, path, body, extraHeaders);
    const text = await response.text();
    if (!response.ok) {
      throw new GluedlyApiError(
        `Gluedly API ${method} ${path} failed with ${response.status}`,
        response.status,
        text,
      );
    }
    return text;
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    return this.fetchImpl(url, {
      method,
      headers: {
        ...this.headers,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}

export function createClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: FetchLike,
): GluedlyClient {
  const apiKey = env.GLUEDLY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GLUEDLY_API_KEY environment variable is required");
  }

  return new GluedlyClient({
    apiKey,
    baseUrl: env.GLUEDLY_BASE_URL?.trim() || DEFAULT_BASE_URL,
    fetchImpl,
  });
}
