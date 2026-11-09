// Opt-in integration check. Creates synthetic records only and removes them in finally.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createPublicationTicket} from '../api/publication-ticket.mjs';
import {createServiceDraft} from '../api/service-draft.mjs';
import {analysis} from './draft-fixture.mjs';
if(process.env.RUN_COMMERCE_LIVE!=='1')throw Error('Set RUN_COMMERCE_LIVE=1 to explicitly run the Supabase integration check.');
process.env.API_PORT='0';
const {server}=await import('../api/server.mjs');
if(!server.listening)await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;process.env.PUBLIC_BASE_URL=base;
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const draft=createServiceDraft(analysis,{image:'data:image/jpeg;base64,/9j/'},'synthetic-integration-test');draft.assessment.coverage.assessed=2;
const ticket=createPublicationTicket(draft);let serviceId;
const call=async(path,body,key,method)=>{const response=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
try{
 const offer={publication_ticket:ticket,publish_consent:true,title:'AUTOMATED TEST · Paper folding',description:'Synthetic integration test. Not a real service.',scope:'One synthetic paper box example for automated validation.',exclusions:'Not a real offer',seller_name:'Automated test',service_area:'Test only',availability:'Not available',timezone:'Asia/Seoul',pricing_mode:'quote',currency:'KRW',pricing_unit:'per test'};
 const published=await call('/api/services',offer);assert.equal(published.status,201,JSON.stringify(published.data));serviceId=published.data.service.id;
 const key=new URLSearchParams(new URL(published.data.management_url).hash.slice(1)).get('key');
 assert.equal((await call('/api/services',offer)).data.service.id,serviceId);
 assert.equal((await call(`/api/services/${serviceId}`)).data.media_public,false);
 const quote={request_id:randomUUID(),buyer_name:'Synthetic test buyer',buyer_email:'test@example.test',scope:'Synthetic quote request for integration verification.',preferred_time:'No appointment',location:'Test only',contact_consent:true};
 assert.equal((await call(`/api/services/${serviceId}/requests`,quote)).status,202);
 assert.equal((await call(`/api/services/${serviceId}/requests`,quote)).data.duplicate,true);
 assert.equal((await call(`/api/services/${serviceId}/requests`)).status,401);
 const inbox=await call(`/api/services/${serviceId}/requests`,null,key);assert.equal(inbox.data.requests.length,1);assert.equal(inbox.data.requests[0].payload.buyer_email,quote.buyer_email);
 assert.equal((await call(`/api/services/${serviceId}/requests/${quote.request_id}`,{status:'reviewing'},key,'PATCH')).status,200);
 assert.equal((await call(`/api/services/${serviceId}`,{status:'closed'},key,'PATCH')).status,200);
 assert.equal((await call(`/api/services/${serviceId}`)).status,404);
 console.log('PASS: real Supabase offer save/read, quote RPC, duplicate handling, owner inbox, request update and unpublish.');
}finally{
 if(serviceId){const {error}=await db.from('picksell_services').delete().eq('id',serviceId);if(error)throw Error('Synthetic test cleanup failed.');const {data,error:checkError}=await db.from('picksell_quote_requests').select('id').eq('service_id',serviceId);assert.equal(checkError,null);assert.equal(data.length,0);console.log('PASS: synthetic offer and quote cleanup.');}
 server.close();
}
