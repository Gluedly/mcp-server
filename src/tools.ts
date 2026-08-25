import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GluedlyClient } from "./client.js";

function textResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          typeof payload === "string"
            ? payload
            : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

export function registerGluedlyTools(
  server: McpServer,
  client: GluedlyClient,
): void {
  server.tool(
    "gluedly_list_pages",
    "Retrieve all mapped scraping pages in your Gluedly workspace.",
    {},
    async () => {
      try {
        const pages = await client.listPages();
        return textResult(pages);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "gluedly_trigger_scrape",
    "Trigger an immediate web scrape execution for a specific Gluedly page ID.",
    {
      page_id: z.number().int().positive().describe("Gluedly page ID"),
    },
    async ({ page_id }) => {
      try {
        const result = await client.triggerScrape(page_id);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "gluedly_get_snapshot",
    "Fetch clean extracted rows or prompt-ready Markdown for a page snapshot.",
    {
      page_id: z.number().int().positive().describe("Gluedly page ID"),
      snapshot_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Snapshot ID; omit to use the latest snapshot"),
      format: z
        .enum(["json", "markdown"])
        .optional()
        .describe('Response format: "json" (rows) or "markdown"'),
    },
    async ({ page_id, snapshot_id, format }) => {
      try {
        const result = await client.getSnapshot({
          pageId: page_id,
          snapshotId: snapshot_id,
          format: format ?? "json",
        });
        return textResult(result.body);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
