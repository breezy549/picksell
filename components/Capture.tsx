import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import type { CaptureProps } from './Capture.types';
export default function Capture({onCapture,onError}:CaptureProps){
 const camera=useRef<CameraView>(null),requested=useRef(false),alive=useRef(true);
 const [permission,request]=useCameraPermissions();const [mode,setMode]=useState<'picture'|'video'>('picture');const [ready,setReady]=useState(false);const [recording,setRecording]=useState(false);const [busy,setBusy]=useState(false);const [seconds,setSeconds]=useState(0);const [active,setActive]=useState(true);const [facing,setFacing]=useState<'back'|'front'>('back');
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;camera.current?.stopRecording();};},[]);
 useEffect(()=>{if(permission?.canAskAgain&&!permission.granted&&!requested.current){requested.current=true;request().catch(()=>onError('Camera permission failed.'));}},[permission,request]);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active')camera.current?.stopRecording();setActive(state==='active');setReady(false);});return()=>sub.remove();},[]);
 useEffect(()=>{if(!recording)return;const timer=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(timer);},[recording]);
 async function capture(){if(recording){camera.current?.stopRecording();return;}if(!ready||busy)return;setBusy(true);onError('');try{
 if(mode==='picture'){const shot=await camera.current?.takePictureAsync({base64:true,quality:.6});if(shot?.base64&&alive.current)onCapture({uri:shot.uri,base64:shot.base64,mime:'image/jpeg'});}
 else{setSeconds(0);setRecording(true);const clip=await camera.current?.recordAsync({maxDuration:30,maxFileSize:24000000});setRecording(false);if(!clip)throw Error('No video recorded.');const file=new File(clip.uri);if(file.size>24000000)throw Error('Video too large. Record a shorter clip.');const base64=await file.base64();if(alive.current)onCapture({uri:clip.uri,base64,mime:clip.uri.toLowerCase().endsWith('.mov')?'video/quicktime':'video/mp4'});}
 }catch(e){onError(e instanceof Error?e.message:'Capture failed.');}finally{if(alive.current){setRecording(false);setBusy(false);}}}
 const button=(label:string,action:()=>void,disabled=false)=><Pressable disabled={disabled} onPress={action} style={{padding:15,backgroundColor:'#e7eee3',borderRadius:12,opacity:disabled ? 0.4 : 1}}><Text>{label}</Text></Pressable>;
 return <View>{permission?.granted&&active?<CameraView key={mode+facing} ref={camera} mode={mode} facing={facing} mute videoQuality="480p" style={{height:400,borderRadius:20,overflow:'hidden'}} onCameraReady={()=>setReady(true)} onMountError={()=>onError('Camera unavailable. Check permissions.')} />:<View style={{height:300,justifyContent:'center',alignItems:'center'}}>{button('Enable camera',()=>{if(permission?.canAskAgain)request();else Linking.openSettings();})}</View>}
 <View style={{flexDirection:'row',gap:8,marginTop:12}}>{button(mode==='picture'?'● Photo':'Photo',()=>{setReady(false);setMode('picture');},busy||mode==='picture')}{button(mode==='video'?'● Video':'Video',()=>{setReady(false);setMode('video');},busy||mode==='video')}{button('Flip',()=>{setReady(false);setFacing(f=>f==='back'?'front':'back');},busy)}</View>
 <Pressable disabled={!ready||busy&&!recording} onPress={capture} style={{backgroundColor:recording?'#a13d31':'#245c3c',padding:18,borderRadius:14,alignItems:'center',marginTop:12,opacity:!ready ? 0.4 : 1}}><Text style={{color:'white',fontWeight:'600'}}>{recording?`Stop · ${seconds}s`:busy?'Preparing…':mode==='video'?'● Record video':'◉ Capture photo'}</Text></Pressable><Text style={{fontSize:11,color:'#7d8b80',marginTop:10}}>Video: up to 30 seconds · no audio</Text></View>;
}
