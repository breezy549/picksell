# CRUPI hackathon demo

Start with `node server.mjs`, then open http://localhost:4188.

1. Fill in a seller, product name, price, stock and an actual HTTPS checkout URL.
2. Submit the product. The preview searches the saved catalog immediately.
3. Search from the right panel and open the seller's checkout link.
4. The local MCP endpoint at http://localhost:4188/mcp provides a `search_products` tool. Its JSON-RPC `tools/list` and `tools/call` responses were tested directly; no external MCP host has been tested.

The page's search preview uses simple keyword matching, not an LLM. The MCP endpoint is local and unauthenticated; ChatGPT or Gemini cannot automatically access it. Initial products and checkout URLs are placeholders. Products saved by the form are stored in `products.json` next to the server. They survive a restart but are stored in a temporary directory and should be copied before cleanup.

To test the tool directly:

```sh
curl -X POST http://localhost:4188/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"수분크림","max_price_krw":30000}}}'
```
