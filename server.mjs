import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 4188);
const database = new URL('./products.json', import.meta.url);
const initial = [
  { id: 'sample-1', name: '데일리 배리어 수분크림', description: '건성 피부를 위한 산뜻한 수분크림. 50ml.', price: 29000, seller: '스튜디오 하니', url: 'https://example.com/cream', stock: 8 },
  { id: 'sample-2', name: '세라마이드 보습 로션', description: '건조한 피부에 쓰는 가벼운 보습 로션. 100ml.', price: 19000, seller: '스튜디오 하니', url: 'https://example.com/lotion', stock: 5 }
];
async function products() { try { return JSON.parse(await readFile(database, 'utf8')); } catch { return initial; } }
const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
async function body(req) { let data = ''; for await (const c of req) { data += c; if (data.length > 100000) throw Error('Request too large'); } return JSON.parse(data || '{}'); }
function search(items, query, maxPrice) {
  const q = String(query || '').toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(t => t.length >= 2 && !/^(찾아줘|추천해줘|추천|제품|상품|이하|만원|원)$/.test(t));
  return items.filter(p => p.stock > 0 && (!maxPrice || p.price <= maxPrice)).map(p => {
    const haystack = `${p.name} ${p.description} ${p.seller}`.toLowerCase();
    const score = tokens.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0);
    return { p, score };
  }).filter(x => tokens.length === 0 || x.score > 0).sort((a,b) => b.score - a.score || a.p.price - b.p.price).map(x => x.p);
}
const definition = { name:'search_products', description:'Search the CRUPI demo catalog for available products. Returns seller-provided facts and purchase links.', inputSchema:{ type:'object', properties:{ query:{ type:'string', description:'Product keywords' }, max_price_krw:{ type:'number', description:'Maximum price in Korean won' } }, required:['query'] } };
http.createServer(async (req,res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && u.pathname === '/') { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); return res.end(await readFile(new URL('./index.html', import.meta.url))); }
    if (req.method === 'GET' && u.pathname === '/api/products') return json(res,200,await products());
    if (req.method === 'POST' && u.pathname === '/api/products') {
      const v=await body(req); const price=Number(v.price), stock=Number(v.stock); let url;
      try { url = new URL(v.url); } catch { return json(res,400,{error:'유효한 구매 링크를 입력해 주세요.'}); }
      if (!['http:','https:'].includes(url.protocol) || !String(v.name || '').trim() || !String(v.seller || '').trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) return json(res,400,{error:'상품명, 판매자, 가격, 재고, 구매 링크를 확인해 주세요.'});
      const p={id:randomUUID(), name:String(v.name).trim(), seller:String(v.seller).trim(), description:String(v.description || '').trim(), price, stock, url:url.href}; const list=await products(); list.unshift(p); await writeFile(database, JSON.stringify(list,null,2)); return json(res,201,p);
    }
    if (req.method === 'POST' && u.pathname === '/api/search') { const v=await body(req); return json(res,200,search(await products(),v.query,Number(v.max_price_krw)||0)); }
    if (req.method === 'POST' && u.pathname === '/mcp') {
      const v=await body(req); if (v.id === undefined) { res.writeHead(202); return res.end(); }
      let result;
      if (v.method === 'initialize') result={protocolVersion:'2025-03-26', capabilities:{tools:{listChanged:false}}, serverInfo:{name:'crupi-demo', version:'0.1.0'}};
      else if(v.method === 'tools/list') result={tools:[definition]};
      else if(v.method === 'tools/call' && v.params?.name === 'search_products') { const a=v.params.arguments || {}; const found=search(await products(),a.query,Number(a.max_price_krw)||0); result={content:[{type:'text',text:JSON.stringify(found)}]}; }
      else return json(res,200,{jsonrpc:'2.0', id:v.id, error:{code:-32601,message:'Method not found'}});
      return json(res,200,{jsonrpc:'2.0',id:v.id,result});
    }
    json(res,404,{error:'Not found'});
  } catch(e) { json(res,500,{error:String(e.message || e)}); }
}).listen(port, '127.0.0.1', () => console.log(`CRUPI demo running: http://localhost:${port}`));
