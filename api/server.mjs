import { prepareEvidence, roundsInstructions } from './evidence-rounds.mjs';
import { analysisSchema as schema, analysisInstructions, validateAnalysis, createServiceDraft } from './service-draft.mjs';
import { saveAnalysis, storageConfigured } from './storage.mjs';
import http from 'node:http';
import { createCommerceHandler, publicBase } from './commerce.mjs';
import { createWebAppHandler } from './web-app.mjs';
import { createPublicationTicket } from './publication-ticket.mjs';
import { loadEnvFile } from 'node:process';
try { loadEnvFile(); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const port = Number(process.env.API_PORT || 4188);
let active=0;
const commerceHandler=createCommerceHandler();
const webAppHandler=createWebAppHandler();
const server=http.createServer(async (req,res)=>{
 if(await commerceHandler(req,res))return;
 if(await webAppHandler(req,res))return;
 const origin=req.headers.origin;
 const allowed=(process.env.ALLOWED_ORIGINS || 'http://localhost:8081').split(',').map(s=>s.trim());
 try{allowed.push(publicBase());}catch{/* Commerce routes report invalid public URL configuration. */}
 if(origin && !allowed.includes(origin)){res.writeHead(403);return res.end();}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 if(req.url!=='/api/analyze'||req.method!=='POST')return send(404,{error:'Not found'});
 if(!process.env.OPENAI_API_KEY)return send(503,{error:'Set OPENAI_API_KEY on the analysis server.'});
 if(active>=2)return send(429,{error:'Server busy. Please retry shortly.'});
 active++;
 try {
  let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>49_000_000)return send(413,{error:'Capture too large. Record a shorter clip.'});chunks.push(chunk);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'Invalid request.'});}
  let media;try{media=await prepareEvidence(body);}catch(e){return send(400,{error:e.message});}
  if(body.save === true && !storageConfigured())return send(503,{error:'Supabase storage is not configured yet.'});
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(50000),body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-6-luna',store:false,instructions:analysisInstructions + roundsInstructions,input:[{role:'user',content:[{type:'input_text',text:JSON.stringify({task:'Create or update a service draft and reassess all capture evidence.',capture_count:media.captures.length,prior_rubric_context:typeof body.prior_rubric_context === 'string' ? body.prior_rubric_context.slice(0,4000) : '',media_kind:media.kind,duration_seconds:media.duration,frame_timestamps:media.frames.map(({index,time,capture_index,media_kind})=>({index,capture_index,media_kind,approx_seconds:time})),seller_statement:typeof body.work_statement === 'string' ? body.work_statement.slice(0,500) : '',seller_claims_performed_work:body.performed_work === true})},...media.frames.flatMap(f=>[{type:'input_text',text:`Frame ${f.index}, capture ${f.capture_index}, ${f.media_kind}, approximately ${f.time}s within this capture`},{type:'input_image',image_url:f.image}])]}],text:{format:{type:'json_schema',name:'work_observations',strict:true,schema}}})});
  if(!response.ok)return send(response.status===429?429:502,{error:response.status===401?'Check the server API key.':response.status===429?'AI quota or rate limit reached. Try later.':'AI request failed. Check model access and server configuration.'});
  const payload=await response.json();const text=(payload.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  let result;try{result=JSON.parse(text);}catch{return send(502,{error:'AI could not analyze this photo. Try a clearer shot.'});}
  if(!validateAnalysis(result, media))return send(502,{error:'Unexpected AI response. Please try again.'});
  result.service_draft = createServiceDraft(result, body, process.env.OPENAI_MODEL || 'gpt-6-luna', media);
  result.publication_ticket = createPublicationTicket(result.service_draft);
  if(body.save === true) {
    try { result.storage = await saveAnalysis(media.captures.map(c=>c.source), result, process.env.OPENAI_MODEL || 'gpt-6-luna'); }
    catch { result.storage = { saved: false, error: 'Analysis complete, but saving failed. Please retry later.' }; }
  }
  send(200,result);
 }catch{send(502,{error:'Analysis unavailable or timed out. Please retry.'});}finally{active--;}
});
server.listen(port,process.env.API_HOST || '127.0.0.1',()=>console.log(`PickSell analysis API listening on port ${port}`));
export { server };
