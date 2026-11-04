/**
 * BhavAI Standalone MCP Demo Client
 * Demonstrates tool discovery and tool invocation over Streamable HTTP.
 *
 * Usage:
 *   npx tsx scripts/mcp-client.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function main() {
  const port = process.env.PORT || 4000;
  const url = new URL(`http://localhost:${port}/mcp`);
  const apiKey = process.env.BHAVAI_KEY || 'bvk_demo_client_key';

  console.log(`Connecting to BhavAI MCP server at ${url.toString()}...`);

  const transport = new StreamableHTTPClientTransport(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const client = new Client(
    { name: 'bhavai-demo-agent', version: '1.0.0' },
    { capabilities: {} },
  );

  await client.connect(transport);
  console.log('Connected successfully via Streamable HTTP!');

  // 1. Tool Discovery
  console.log('\n--- 1. Tool Discovery ---');
  const toolsResult = await client.listTools();
  console.log(`Discovered ${toolsResult.tools.length} published MCP tools:`);
  for (const tool of toolsResult.tools) {
    console.log(` - [${tool.name}] ${tool.description?.slice(0, 70)}...`);
  }

  // 2. Search Products
  console.log('\n--- 2. Invoking search_products ---');
  try {
    const searchRes = await client.callTool({
      name: 'search_products',
      arguments: { query: 'diya', currency: 'USD' },
    });
    console.log('Result:', JSON.stringify(searchRes, null, 2));
  } catch (err) {
    console.log('Search completed or returned notice:', (err as Error).message);
  }

  console.log('\nMCP Client demonstration finished successfully.');
  await transport.close();
}

main().catch((err) => {
  console.error('MCP Client demo error:', err.message);
  process.exit(1);
});

