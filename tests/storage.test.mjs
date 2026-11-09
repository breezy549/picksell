import assert from 'node:assert/strict';
import { saveAnalysis, storageConfigured } from '../api/storage.mjs';
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY;
assert.equal(storageConfigured(), false);
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SECRET_KEY='test-key';
const original=globalThis.fetch;let requests=[];let failRow=false;let failUploadAt=0;let uploadCount=0;
globalThis.fetch=async (url,options)=>{
 requests.push({url:String(url),method:options.method});
 if(String(url).includes('/storage/') && options.method==='POST' && ++uploadCount===failUploadAt)return new Response(JSON.stringify({message:'upload failed'}),{status:400});
 if(String(url).includes('/rest/v1/'))return new Response(failRow?JSON.stringify({message:'insert failed'}):null,{status:failRow?400:201});
 return new Response(JSON.stringify({Key:'test'}),{status:200,headers:{'Content-Type':'application/json'}});
};
try {
 const result={title:'Tools',observations:['A wrench'],limitations:['Skill unknown']};
 const saved=await saveAnalysis('data:image/jpeg;base64,/9j/',result,'test');assert.equal(saved.saved,true);assert.equal(requests.length,2);assert.ok(requests[0].url.includes('/storage/v1/object/picksell-work/'));
 requests=[];failRow=true;await assert.rejects(saveAnalysis('data:image/jpeg;base64,/9j/',result,'test'));assert.equal(requests.length,3);assert.equal(requests[2].method,'DELETE');
 requests=[];failRow=false;uploadCount=0;const multiResult={...result,service_draft:{evidence:{}}};
 const multi=await saveAnalysis(['data:image/jpeg;base64,/9j/','data:image/jpeg;base64,/9j/'],multiResult,'test');assert.equal(multi.capture_count,2);assert.equal(requests.length,3);assert.equal(multiResult.service_draft.evidence.saved_captures.length,2);
 requests=[];uploadCount=0;failUploadAt=2;await assert.rejects(saveAnalysis(['data:image/jpeg;base64,/9j/','data:image/jpeg;base64,/9j/'],result,'test'));assert.equal(requests.at(-1).method,'DELETE');assert.ok(!requests.some(r=>r.url.includes('/rest/v1/')));
 console.log('PASS: storage upload + row insert; failed insert cleans up photo. No cloud calls.');
}finally{globalThis.fetch=original;}
