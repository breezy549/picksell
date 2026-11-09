import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createCommerceHandler} from '../api/commerce.mjs';
import {createPublicationTicket,readPublicationTicket} from '../api/publication-ticket.mjs';
import {validateOffer,validateQuote,CommerceError} from '../api/commerce-model.mjs';
import {createServiceDraft} from '../api/service-draft.mjs';
import {analysis} from './draft-fixture.mjs';
const draft=createServiceDraft(analysis,{image:'data:image/jpeg;base64,/9j/'},'test');
assert.equal(createPublicationTicket(draft),null);
draft.assessment.coverage.assessed=2;
const ticket=createPublicationTicket(draft);assert.ok(ticket);
assert.throws(()=>readPublicationTicket(ticket.slice(0,-3)+'xxx'));
const highRisk=structuredClone(draft);highRisk.assessment.domain='healthcare_or_care';assert.equal(createPublicationTicket(highRisk),null);
const offer={publication_ticket:ticket,publish_consent:true,title:'Paper craft session',description:'Practice folding a small paper box.',scope:'One box, with aligned edges and a stable base.',exclusions:'Materials not supplied',seller_name:'Demo seller',service_area:'Seoul',availability:'Weekends, subject to confirmation',timezone:'Asia/Seoul',pricing_mode:'quote',currency:'KRW',pricing_unit:'per job'};
assert.throws(()=>validateOffer({...offer,publish_consent:false}));
assert.throws(()=>validateOffer({...offer,timezone:'not/a/timezone'}));
assert.throws(()=>validateOffer({...offer,pricing_mode:'starting_at',amount:-1}));
assert.throws(()=>validateQuote({request_id:randomUUID()}));
const services=new Map(),requests=new Map();
const store={
 async publish(row){const old=[...services.values()].find(s=>s.receipt_id===row.receipt_id);if(old)return old;const result={...row,created_at:new Date().toISOString()};services.set(row.id,result);return result;},
 async get(id){return services.get(id);},async search(q){return [...services.values()].filter(s=>s.status==='active'&&s.public_data.title.includes(q));},
 async quote(serviceId,q){const old=requests.get(q.id);if(old){if(JSON.stringify(old.payload)!==JSON.stringify(q.payload))throw new CommerceError(409,'Conflict');return {id:q.id,status:old.status,duplicate:true};}requests.set(q.id,{...q,service_id:serviceId,status:'pending'});return {id:q.id,status:'pending',duplicate:false};},
 async requests(id){return [...requests.values()].filter(q=>q.service_id===id);},async close(id){services.get(id).status='closed';},async updateRequest(serviceId,id,status){const q=requests.get(id);if(!q||q.service_id!==serviceId)throw new CommerceError(404,'Not found');q.status=status;return {id,status};}
};
const handler=createCommerceHandler(store);const server=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;process.env.PUBLIC_BASE_URL=base;
const call=(path,body,token,method)=>fetch(base+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
try{
 let response=await call('/api/services',{...offer,publication_ticket:'tampered'});assert.equal(response.status,401);
 response=await call('/api/services',offer);assert.equal(response.status,201);const publication=await response.json(),id=publication.service.id,key=new URLSearchParams(new URL(publication.management_url).hash.slice(1)).get('key');
 assert.equal((await call('/api/services',offer)).status,201);assert.equal(services.size,1);
 assert.equal((await call('/api/services',{...offer,title:'Different offer'})).status,409);
 const publicJson=await (await call(`/api/services/${id}`)).json();assert.equal(publicJson.seller_approval_required,true);assert.ok(!JSON.stringify(publicJson).includes(key));assert.equal(publicJson.manage_token_hash,undefined);assert.match(publicJson.assessment.disclaimer,/not skill certification/i);
 const quote={request_id:randomUUID(),buyer_name:'Buyer',buyer_email:'buyer@example.test',scope:'Please fold 10 boxes.',preferred_time:'Next Saturday',location:'Mapo',contact_consent:true};
 assert.equal((await call(`/api/services/${id}/requests`,{...quote,contact_consent:false})).status,400);
 assert.equal((await call(`/api/services/${id}/requests`,quote)).status,202);
 const duplicate=await (await call(`/api/services/${id}/requests`,quote)).json();assert.equal(duplicate.duplicate,true);assert.equal(requests.size,1);
 assert.equal((await call(`/api/services/${id}/requests`,{...quote,scope:'Changed scope'})).status,409);
 assert.equal((await call(`/api/services/${id}/requests`)).status,401);
 assert.equal((await call(`/api/services/${id}/requests`,null,'wrong')).status,401);
 const inbox=await (await call(`/api/services/${id}/requests`,null,key)).json();assert.equal(inbox.requests[0].payload.buyer_email,'buyer@example.test');
 assert.equal((await call(`/api/services/${id}/requests/${quote.request_id}`,{status:'reviewing'},key,'PATCH')).status,200);
 assert.equal((await call(`/api/services/${id}/requests/${randomUUID()}`,{status:'reviewing'},key,'PATCH')).status,404);
 assert.equal((await call(`/api/services/${id}`,{status:'closed'},key,'PATCH')).status,200);
 assert.equal((await call(`/api/services/${id}`)).status,404);
 assert.equal((await call(`/api/services/${id}/requests`,{...quote,request_id:randomUUID()})).status,404);
 const schema=await(await call('/openapi.json')).json();assert.equal(schema.paths['/api/services/{id}/requests'].post.operationId,'requestQuote');
 const page=await call(`/s/${id}`);assert.equal(page.status,200);assert.ok(page.headers.get('Content-Security-Policy').includes("script-src 'self'"));
 console.log('PASS: publication consent/signature, private assessment gate, idempotency, public fields, buyer consent, protected inbox, close and API contract. No external calls.');
}finally{server.close();}
