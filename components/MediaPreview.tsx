import { Image } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { Media } from './Capture.types';
function Video({uri}:{uri:string}){const player=useVideoPlayer(uri);return <VideoView player={player} nativeControls style={{width:'100%',height:400}} contentFit="contain"/>;}
export default function MediaPreview({media}:{media:Media}){return media.mime.startsWith('video/')?<Video uri={media.uri}/>:<Image source={{uri:media.uri}} style={{width:'100%',height:400}}/>;}
