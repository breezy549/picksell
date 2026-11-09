import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
export const storageConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
export async function saveAnalysis(input, result, model) {
  if (!storageConfigured()) throw Error('Storage is not configured.');
  const images = Array.isArray(input) ? input : [input];
  if (!images.length || images.length > 3) throw Error('Invalid capture count.');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = 'picksell-work', id = randomUUID(), uploaded = [];
  try {
    for (const [index, image] of images.entries()) {
      const mime = image.slice(5, image.indexOf(';'));
      const extension = {'image/jpeg':'jpg','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'}[mime];
      if (!extension) throw Error('Unsupported media type.');
      const path = `${id}-${index}.${extension}`;
      const {error} = await client.storage.from(bucket).upload(path, Buffer.from(image.split(',')[1], 'base64'), {contentType:mime,upsert:false});
      if (error) throw Error('Capture could not be saved.');
      uploaded.push(path);
    }
    const draft = result.service_draft ? structuredClone(result.service_draft) : null;
    if (draft?.evidence) draft.evidence.saved_captures = uploaded.map((path,index)=>({capture_index:index,bucket,path}));
    const {error} = await client.from('picksell_analyses').insert({id,image_path:uploaded.at(-1),title:result.title,observations:result.observations,limitations:result.limitations,service_draft:draft,model});
    if (error) throw Error('Analysis could not be saved.');
    if (draft) result.service_draft = draft;
    return {saved:true,id,capture_count:uploaded.length};
  } catch (error) {
    // Compensate both partial multi-file upload and failed database insert.
    if (uploaded.length) {
      const {error:cleanupError} = await client.storage.from(bucket).remove(uploaded);
      if (cleanupError) console.error('PickSell storage cleanup needed for objects',uploaded);
    }
    throw error;
  }
}
