#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClientFromEnv } from "./client.js";
import { createGluedlyMcpServer } from "./server.js";

async function main(): Promise<void> {
  const client = createClientFromEnv();
  const server = createGluedlyMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
