import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GluedlyClient } from "./client.js";
import { registerGluedlyTools } from "./tools.js";

export function createGluedlyMcpServer(client: GluedlyClient): McpServer {
  const server = new McpServer({
    name: "gluedly",
    version: "0.1.0",
  });

  registerGluedlyTools(server, client);
  return server;
}
