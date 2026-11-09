import { analysis } from './draft-fixture.mjs';
import assert from 'node:assert/strict';
process.env.API_PORT='0';
const {server}=await import('../api/server.mjs');
if(!server.listening)await new Promise(r=>server.once('listening',r));
const url=`http://127.0.0.1:${server.address().port}/api/analyze`;
const fetchReal=globalThis.fetch;
const post=(body)=>fetchReal(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
try {
 delete process.env.OPENAI_API_KEY;
 assert.equal((await post({})).status,503);
 process.env.OPENAI_API_KEY='test-only';
 process.env.PUBLIC_BASE_URL=new URL(url).origin;
 const sameOrigin=await fetchReal(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:process.env.PUBLIC_BASE_URL},body:'{}'});
 assert.equal(sameOrigin.status,400); // same-origin camera request reaches validation, not CORS rejection
 assert.equal((await post({image:'bad'})).status,400);
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  const request=JSON.parse(options.body);assert.equal(request.store,false);assert.equal(request.input[0].content[2].type,'input_image');
  return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(analysis)}]}]}),{status:200});
 };
 let response=await post({image:'data:image/jpeg;base64,/9j/'});assert.equal(response.status,200);const draft=(await response.json()).service_draft;assert.equal(draft.offer.amount,null);assert.equal(draft.publication.discoverable,false);assert.equal(draft.assessment.skill_level,null);
 globalThis.fetch=async (url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses'); // save=false must never call Supabase
  const request=JSON.parse(options.body);
  assert.equal(request.input[0].content.filter(c=>c.type==='input_image').length,2);
  assert.equal(JSON.parse(request.input[0].content[0].text).capture_count,2);
  return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(analysis)}]}]}),{status:200});
 };
 response=await post({captures:[{image:'data:image/jpeg;base64,/9j/'},{image:'data:image/jpeg;base64,/9j/'}],save:false});
 assert.equal(response.status,200);const followup=await response.json();assert.equal(followup.service_draft.evidence.capture_count,2);assert.equal(followup.storage,undefined);
 assert.equal((await post({captures:[]})).status,400);
 globalThis.fetch=async()=>new Response('',{status:429});assert.equal((await post({image:'data:image/jpeg;base64,/9j/'})).status,429);
 console.log('PASS: missing key, invalid image, image request/response, provider rate limit. No external API called.');
}finally{globalThis.fetch=fetchReal;server.close();}
