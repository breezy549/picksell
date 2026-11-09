import assert from 'node:assert/strict';
import { promisify } from 'node:util';import { execFile } from 'node:child_process';
import { mkdtemp,readFile,rm } from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import { prepareMedia } from '../api/media.mjs';import { analysis } from './draft-fixture.mjs';import { validateAnalysis,createServiceDraft } from '../api/service-draft.mjs';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'picksell-video-test-'));
try{
 const file=join(dir,'clip.mp4');await exec('ffmpeg',['-v','error','-f','lavfi','-i','testsrc=size=320x240:rate=10','-t','3','-c:v','libx264','-pix_fmt','yuv420p',file]);
 const video='data:video/mp4;base64,'+(await readFile(file)).toString('base64');const media=await prepareMedia({video});assert.equal(media.kind,'video');assert.ok(media.duration>=2.9&&media.duration<=3.1);assert.equal(media.frames.length,3);assert.ok(media.frames[1].time>media.frames[0].time);
 const result=structuredClone(analysis);result.process.steps=[{description:'Test step',frame_indices:[0,1]}];assert.equal(validateAnalysis(result,media),true);result.process.steps[0].frame_indices=[999];assert.equal(validateAnalysis(result,media),false);result.process.steps[0].frame_indices=[0];const d=createServiceDraft(result,{video},'test',media);assert.equal(d.evidence.media_type,'video/mp4');assert.equal(d.evidence.sampling.audio_analyzed,false);assert.equal(d.assessment.skill_level,null);
 await assert.rejects(prepareMedia({video:'data:video/mp4;base64,YmFk'}));
 const long=join(dir,'long.mp4');await exec('ffmpeg',['-v','error','-f','lavfi','-i','color=size=32x32:rate=1','-t','32','-c:v','libx264',long]);await assert.rejects(prepareMedia({video:'data:video/mp4;base64,'+(await readFile(long)).toString('base64')}),/30 seconds/);
 const webm=join(dir,'stream.webm');const streamed=await exec('ffmpeg',['-v','error','-f','lavfi','-i','color=size=64x64:rate=5','-t','2','-c:v','libvpx','-f','webm','pipe:1'],{encoding:'buffer',maxBuffer:1000000});
 const web=await prepareMedia({video:'data:video/webm;base64,'+streamed.stdout.toString('base64')});assert.equal(web.kind,'video');assert.ok(web.frames.length>=2);
 console.log('PASS: real video extraction, ordered sample times, evidence reference bounds, invalid file and overlong rejection.');
}finally{await rm(dir,{recursive:true,force:true});}
