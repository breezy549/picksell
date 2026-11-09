import assert from 'node:assert/strict';
import { combineEvidence, prepareEvidence } from '../api/evidence-rounds.mjs';
import { validateAnalysis, createServiceDraft } from '../api/service-draft.mjs';
import { analysis } from './draft-fixture.mjs';

const image = 'data:image/jpeg;base64,/9j/';
const photo = {source:image,mime:'image/jpeg',kind:'photo',duration:null,frames:[{index:0,time:0,image}]};
const video = {...photo,source:'data:video/mp4;base64,YQ==',mime:'video/mp4',kind:'video',duration:2,frames:[{index:0,time:0,image},{index:1,time:1,image}]};
const combined = combineEvidence([video,photo]);
assert.deepEqual(combined.frames.map(f=>[f.index,f.capture_index,f.time]),[[0,0,0],[1,0,1],[2,1,0]]);
assert.equal(video.frames[1].index,1); // original frame IDs are not mutated
assert.equal(combined.capture_metadata.length,2);
const a = structuredClone(analysis);
Object.assign(a.task_assessment.criteria[0],{rating:'proficient',observation_indices:[0],frame_indices:[2]});
assert.equal(validateAnalysis(a,combined),false); // adding a video cannot turn a photo into process evidence
a.task_assessment.criteria[0].frame_indices=[0,1];
assert.equal(validateAnalysis(a,combined),true);
const draft=createServiceDraft(a,{},'test',combined);
assert.equal(draft.evidence.capture_count,2);
assert.equal(draft.assessment.dimensions[0].evidence_refs[1].capture_index,0);
assert.equal(draft.evidence.sampling.frames[2].capture_index,1);
a.task_assessment.improvement_tips=[{tip:'Align the fold before pressing.',frame_indices:[90]}];
assert.equal(validateAnalysis(a,combined),false);
assert.equal((await prepareEvidence({captures:[{image},{image}]})).frames.length,2);
await assert.rejects(prepareEvidence({captures:[]}),/one to three/);
await assert.rejects(prepareEvidence({captures:[{image},{image},{image},{image}]}),/one to three/);
await assert.rejects(prepareEvidence({captures:[null]}),/Invalid capture/);
await assert.rejects(prepareEvidence({captures:[{image:'data:image/jpeg;base64,'+'A'.repeat(48_000_004)}]}),/36 MB/);
console.log('PASS: multi-capture references, mixed-media restrictions, next-capture feedback, malformed and oversized batches.');
