import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const webRoot=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'};

export function createWebAppHandler(directory=webRoot){
  const root=resolve(directory);
  return async(req,res)=>{
    if(!['GET','HEAD'].includes(req.method))return false;
    let path;
    try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return false;}
    if(!(path==='/'||path==='/index.html'||path==='/favicon.ico'||path.startsWith('/_expo/')||path.startsWith('/assets/')))return false;
    const relative=path==='/'?'index.html':path.slice(1);
    const filename=resolve(root,relative);
    if(!filename.startsWith(root+sep)||relative.split('/').some(part=>part==='..'||part.startsWith('.'))){res.writeHead(404);res.end();return true;}
    try{
      const bytes=await readFile(filename);
      res.writeHead(200,{'Content-Type':mime[extname(filename)]||'application/octet-stream','Cache-Control':extname(filename)==='.html'?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{
      const isHome=relative==='index.html';
      res.writeHead(isHome?503:404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      res.end(isHome?'Camera app not built. Run npm run build:web, or open the Expo dev server from npm run web.':'Asset not found.');
    }
    return true;
  };
}
