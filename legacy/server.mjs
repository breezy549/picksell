import http from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT || 4188);
http.createServer(async (req, res) => {
  if (req.method !== 'GET' || new URL(req.url, 'http://localhost').pathname !== '/') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  try {
    const html = await readFile(new URL('./index.html', import.meta.url));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Could not load the demo');
  }
}).listen(port, '127.0.0.1', () => console.log(`PickSell demo: http://localhost:${port}`));
