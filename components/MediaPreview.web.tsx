import type { Media } from './Capture.types';
export default function MediaPreview({media}:{media:Media}){return media.mime.startsWith('video/')?<video src={media.uri} controls playsInline style={{width:'100%',height:400,objectFit:'contain'}}/>:<img src={media.uri} alt="Captured work" style={{width:'100%',height:400,objectFit:'contain'}}/>;}
