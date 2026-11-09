import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createWebAppHandler} from '../api/web-app.mjs';
import {createCommerceHandler} from '../api/commerce.mjs';

// Validate the actual Expo export: a copied public/index.html previously replaced
// its React root and caused the camera app to disappear despite a successful build.
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
assert.match(html,/id="root"/);
assert.match(html,/_expo\/static\/js\/web\//);
assert.ok(!html.includes('commerce.js'));
assert.ok(!html.includes('Find a service'));
const web=createWebAppHandler(),commerce=createCommerceHandler({search:async()=>[]});
const server=http.createServer(async(req,res)=>{if(await commerce(req,res))return;if(await web(req,res))return;res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Not found'}));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;process.env.PUBLIC_BASE_URL=base;
try{
 const root=await fetch(base+'/');assert.equal(root.status,200);assert.match(await root.text(),/id="root"/);
 const search=await fetch(base+'/services');assert.equal(search.status,200);assert.match(await search.text(),/commerce.js/);
 const api=await fetch(base+'/api/services');assert.match(api.headers.get('content-type'),/application\/json/);assert.deepEqual((await api.json()).services,[]);
 const wrong=await fetch(base+'/api/unknown');assert.equal(wrong.status,404);assert.match(wrong.headers.get('content-type'),/application\/json/);
 const bundle=html.match(/src="([^\"]+_expo[^\"]+\.js)"/)[1];
 const asset=await fetch(base+bundle);assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);
 const js=await asset.text();assert.ok(js.includes('Get your hands-on'));assert.ok(js.includes('Turn them into services with PickSell.'));
 assert.equal((await fetch(base+'/.env')).status,404);
 assert.equal((await fetch(base+'/_expo/%252e%252e/.env')).status,404);
 console.log('PASS: actual export retains React camera root/hero; separate service page; JSON API; bundle MIME; no secret/static fallback leaks.');
}finally{server.close();}
