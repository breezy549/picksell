import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {commerceStore} from './commerce-store.mjs';
import {CommerceError,validateOffer,validateQuote,publicService,uuidPattern} from './commerce-model.mjs';
import {readPublicationTicket,managementToken} from './publication-ticket.mjs';
import {openApiDocument} from './openapi.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function publicBase() {
  const value=process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.API_PORT || 4188}`;
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new CommerceError(503,'PUBLIC_BASE_URL must be an origin, e.g. https://picksell.example.com.');
  return url.origin;
}
async function bodyJson(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>32000)throw new CommerceError(413,'Request too large.');chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new CommerceError(400,'Invalid JSON body.');}}
const fileHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
export function createCommerceHandler(store=commerceStore){return async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  if(!(path==='/services'||path==='/openapi.json'||path==='/api/services'||path.startsWith('/api/services/')||path.startsWith('/s/')||path.startsWith('/manage/')||path==='/commerce.js'||path==='/commerce.css'))return false;
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
    const base=publicBase();
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return true;}
    if(req.method==='GET'&&(path==='/services'||/^\/(s|manage)\/[\w-]+$/.test(path)||['/commerce.js','/commerce.css'].includes(path))){
      const file=path==='/commerce.js'?'commerce.js':path==='/commerce.css'?'commerce.css':'index.html';
      const bytes=await readFile(new URL(`../commerce-web/${file}`,import.meta.url));res.writeHead(200,{...fileHeaders,'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(bytes);return true;
    }
    if(path==='/openapi.json'&&req.method==='GET'){send(200,openApiDocument(base));return true;}
    if(path==='/api/services'&&req.method==='GET'){const q=(url.searchParams.get('q')||'').trim();if(q.length>100)throw new CommerceError(400,'Search is too long.');send(200,{services:(await store.search(q)).map(row=>publicService(row,base)),limit:20});return true;}
    if(path==='/api/services'&&req.method==='POST'){
      const origins=(process.env.ALLOWED_ORIGINS||'http://localhost:8081').split(',').concat(base);
      if(req.headers.origin&&!origins.includes(req.headers.origin))throw new CommerceError(403,'Publishing origin is not allowed.');
      const input=await bodyJson(req),offer=validateOffer(input);let ticket;try{ticket=readPublicationTicket(input.publication_ticket);}catch(e){throw new CommerceError(401,e.message);}
      const key=managementToken(ticket.id);
      const publicData={...offer,assessment:ticket.assessment,identity_verified:false,media_public:false};
      const row=await store.publish({id:randomUUID(),receipt_id:ticket.id,manage_token_hash:hash(key),status:'active',public_data:publicData});
      if(!isDeepStrictEqual(row.public_data,publicData))throw new CommerceError(409,'This assessment already has a published offer. Use its management link or analyze again for a new offer.');
      send(201,{service:publicService(row,base),management_url:`${base}/manage/${row.id}#key=${key}`,local_only:new URL(base).hostname==='localhost'||new URL(base).hostname==='127.0.0.1'});return true;
    }
    const match=/^\/api\/services\/([^/]+)(?:\/(requests))?(?:\/([^/]+))?$/.exec(path);
    if(!match||!uuidPattern.test(match[1]))throw new CommerceError(404,'Service not found.');
    const [,id,requests,requestId]=match;
    const row=await store.get(id);if(!row)throw new CommerceError(404,'Service not found.');
    if(req.method==='GET'&&!requests){if(row.status!=='active')throw new CommerceError(404,'Service is no longer public.');send(200,publicService(row,base));return true;}
    if(req.method==='POST'&&requests&&!requestId){if(row.status!=='active')throw new CommerceError(404,'Service unavailable.');const quote=validateQuote(await bodyJson(req));send(202,{...(await store.quote(id,quote)),message:'Request received. Await seller response; no booking or payment has been made.'});return true;}
    const provided=req.headers.authorization?.replace(/^Bearer /,'') || '';
    const actual=Buffer.from(hash(provided)),expected=Buffer.from(row.manage_token_hash);
    if(!provided||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new CommerceError(401,'A valid private management key is required.');
    if(req.method==='GET'&&requests&&!requestId){send(200,{service:publicService(row,base),requests:await store.requests(id)});return true;}
    if(req.method==='PATCH'&&!requests){const input=await bodyJson(req);if(input?.status!=='closed')throw new CommerceError(400,'Only closing is supported.');await store.close(id);send(200,{status:'closed'});return true;}
    if(req.method==='PATCH'&&requests&&uuidPattern.test(requestId||'')){const input=await bodyJson(req);if(!['reviewing','declined'].includes(input?.status))throw new CommerceError(400,'Choose reviewing or declined.');send(200,await store.updateRequest(id,requestId,input.status));return true;}
    throw new CommerceError(405,'Method not allowed.');
  }catch(e){send(e instanceof CommerceError?e.status:500,{error:e instanceof CommerceError?e.message:'Service request failed. Please try again.'});}
  return true;
};}
