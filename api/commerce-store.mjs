import {createClient} from '@supabase/supabase-js';
import {CommerceError} from './commerce-model.mjs';
function client(){
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)throw new CommerceError(503,'Service storage is not configured.');
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
function check(error){if(error)throw new CommerceError(503,'Service storage unavailable. Apply supabase/commerce.sql and check server configuration.');}
export const commerceStore={
 async publish(row){const db=client();const {error}=await db.from('picksell_services').insert(row);if(error && error.code!=='23505')check(error);const {data,error:readError}=await db.from('picksell_services').select('*').eq('receipt_id',row.receipt_id).single();check(readError);return data;},
 async get(id){const {data,error}=await client().from('picksell_services').select('*').eq('id',id).maybeSingle();check(error);return data;},
 async search(q){let query=client().from('picksell_services').select('id,status,public_data,created_at').eq('status','active').order('created_at',{ascending:false}).limit(20);if(q)query=query.ilike('public_data->>title',`%${q.replace(/[%_]/g,'\\$&')}%`);const {data,error}=await query;check(error);return data;},
 async quote(serviceId,quote){const {data,error}=await client().rpc('picksell_submit_quote',{p_service_id:serviceId,p_request_id:quote.id,p_payload:quote.payload});if(error){if(error.message.includes('RATE_LIMITED'))throw new CommerceError(429,'This service has received too many requests. Try later.');if(error.message.includes('IDEMPOTENCY_CONFLICT'))throw new CommerceError(409,'This request ID was already used for different details.');if(error.message.includes('SERVICE_UNAVAILABLE'))throw new CommerceError(404,'Service unavailable.');check(error);}return data;},
 async requests(id){const {data,error}=await client().from('picksell_quote_requests').select('id,payload,status,created_at').eq('service_id',id).order('created_at',{ascending:false}).limit(100);check(error);return data;},
 async close(id){const {error}=await client().from('picksell_services').update({status:'closed'}).eq('id',id);check(error);},
 async updateRequest(serviceId,id,status){const {data,error}=await client().from('picksell_quote_requests').update({status}).eq('id',id).eq('service_id',serviceId).select('id,status').maybeSingle();check(error);if(!data)throw new CommerceError(404,'Request not found.');return data;}
};
