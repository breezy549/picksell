import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec=promisify(execFile);
export async function prepareMedia(body){
 const value=body.video || body.image;
 if(typeof value!=='string')throw Error('Capture a photo or video first.');
 const match=/^data:(image\/jpeg|video\/mp4|video\/webm|video\/quicktime);base64,([A-Za-z0-9+/]+=*)$/.exec(value);
 if(!match)throw Error('Unsupported capture format.');
 const [,mime,b64]=match,bytes=Buffer.from(b64,'base64');
 if(!bytes.length||bytes.length>(mime==='image/jpeg'?6000000:24000000))throw Error('Capture is too large. Record a shorter clip.');
 if(mime==='image/jpeg')return {source:value,mime,kind:'photo',duration:null,frames:[{index:0,time:0,image:value}]};
 const dir=await mkdtemp(join(tmpdir(),'picksell-video-'));
 try{
 const input=join(dir,'input'),normalized=join(dir,'normalized.mp4');await writeFile(input,bytes);
 const format=mime==='video/webm'?'matroska,webm':'mov';
 const probe=await exec(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-protocol_whitelist','file,pipe','-f',format,'-select_streams','v:0','-show_entries','stream=width,height:format=duration','-of','json',input],{timeout:10000,maxBuffer:100000});
 const info=JSON.parse(probe.stdout),v=info.streams?.[0];if(!v||v.width>4096||v.height>4096||v.width*v.height>9000000)throw Error('Unsupported video dimensions.');
 const declared=Number(info.format?.duration);if(Number.isFinite(declared)&&declared>30.5)throw Error('Record a video of 30 seconds or less.');
 await exec(process.env.FFMPEG_PATH||'ffmpeg',['-v','error','-nostdin','-protocol_whitelist','file,pipe','-f',format,'-i',input,'-map','0:v:0','-t','31','-an','-vf','scale=640:-2','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','28','-fs','24000000',normalized],{timeout:30000,maxBuffer:100000});
 const out=await exec(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_entries','format=duration','-of','json',normalized],{timeout:10000,maxBuffer:100000});
 const duration=Number(JSON.parse(out.stdout).format?.duration);if(!Number.isFinite(duration)||duration<=0||duration>30.5)throw Error('Record a video of 30 seconds or less.');
 const count=Math.min(16,Math.max(2,Math.ceil(duration))),interval=duration/count;
 await exec(process.env.FFMPEG_PATH||'ffmpeg',['-v','error','-nostdin','-i',normalized,'-vf',`fps=${1/interval}:start_time=0`,'-frames:v',String(count),'-q:v','3',join(dir,'frame-%02d.jpg')],{timeout:20000,maxBuffer:100000});
 const files=(await readdir(dir)).filter(f=>/^frame-\d+\.jpg$/.test(f)).sort();
 const frames=await Promise.all(files.map(async(f,index)=>({index,time:Number((index*interval).toFixed(2)),image:'data:image/jpeg;base64,'+(await readFile(join(dir,f))).toString('base64')})));
 if(!frames.length)throw Error('No readable video frames.');
 return {source:value,mime,kind:'video',duration,frames};
 }catch(e){if(e.code==='ENOENT')throw Error('Video analysis needs FFmpeg and FFprobe on the server.');if(e.message?.startsWith('Record ')||e.message==='Unsupported video dimensions.')throw e;throw Error('Could not process this video. Try a shorter recording.');}
 finally{await rm(dir,{recursive:true,force:true});}
}
