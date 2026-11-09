import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Capture from './components/Capture';
import PublishService from './components/PublishService';
import {apiUrl} from './lib/api-url';
import MediaPreview from './components/MediaPreview';
import type { Media } from './components/Capture.types';
import { StatusBar } from 'expo-status-bar';

type ServiceDraft = {
 schema_version: string; status: string;
 service: { name: string | null; category: string | null; description: string | null; proposed_scope: string[]; exclusions_to_confirm: string[] };
 provider: { authorship_claim: string };
 evidence: { sampling: { frames: {index:number;capture_index:number;approx_seconds:number}[]; limitation:string }; process: {steps:{description:string;frame_indices:number[]}[];skill_signals:{skill:string;visible_behavior:string;frame_indices:number[];limitation:string}[];assessment_gaps:string[]} };
 assessment: { strengths:{text:string;frame_indices:number[]}[]; improvement_tips:{tip:string;frame_indices:number[]}[]; needed_evidence: string[]; skill_level: string | null; status: string; summary: string; coverage: {assessed:number;total:number}; dimensions: {dimension:string;task_criterion:string;rating:string;rationale:string;limitation:string;evidence_refs:{frame_index:number;capture_index:number;approx_seconds:number}[]}[] };
 next_questions: string[];
};
type Result = { publication_ticket?: string | null; title: string; observations: string[]; limitations: string[]; service_draft: ServiceDraft; storage?: { saved: boolean; id?: string; error?: string } };
const humanize = (value: string) => value.replaceAll('_', ' ');
function Assessment({assessment}: {assessment: ServiceDraft['assessment']}) {
  const [expanded, setExpanded] = useState(false);
  return <View style={s.assessment}>
    <Text style={s.badge}>CURRENT ASSESSMENT</Text>
    <Text style={s.resultTitle}>{assessment.skill_level ? ({emerging:'Beginner signs',developing:'Developing',proficient:'Proficient in this task',advanced:'Advanced signs'}[assessment.skill_level] || humanize(assessment.skill_level)) : assessment.status === 'human_review_required' ? 'Expert review needed' : 'More evidence needed'}</Text>
    <Text style={s.muted}>{assessment.summary}</Text>
    <Text style={s.small}>{assessment.coverage.assessed}/4 criteria observed · AI opinion, not certification.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={[s.lightButton,{marginTop:12}]}><Text>{expanded ? 'Hide criteria' : 'Why this assessment?'}</Text></Pressable>
    {expanded ? assessment.dimensions.map(c=><View key={c.dimension} style={{marginTop:14}}>
      <Text style={s.label}>{humanize(c.dimension)} · {humanize(c.rating)}</Text>
      <Text style={s.item}>{c.task_criterion}</Text>
      <Text style={s.muted}>{c.rationale}</Text>
      {c.evidence_refs.length ? <Text style={s.small}>{c.evidence_refs.map(r=>`Capture ${r.capture_index + 1} · ~${r.approx_seconds.toFixed(1)}s`).join(', ')}</Text> : null}
      <Text style={s.small}>{c.limitation}</Text>
    </View>) : null}
  </View>;
}
export default function App() {
  const [photo, setPhoto] = useState<Media | null>(null);
  const [captures, setCaptures] = useState<Media[]>([]);
  const [adding, setAdding] = useState(false);
  const [previousLevel, setPreviousLevel] = useState<string | null>(null);
  const [previousCoverage, setPreviousCoverage] = useState<number | null>(null);
  const captureUrls = useRef(new Set<string>());
  const [statement, setStatement] = useState('');
  const [performedWork, setPerformedWork] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  useEffect(()=>()=>{ for (const uri of captureUrls.current) if (uri.startsWith('blob:')) URL.revokeObjectURL(uri); },[]);
  function receiveCapture(media: Media) { captureUrls.current.add(media.uri); setPhoto(media); }
  function clearPending() { if (photo && !captures.includes(photo) && photo.uri.startsWith('blob:')) {URL.revokeObjectURL(photo.uri);captureUrls.current.delete(photo.uri);} setPhoto(null);setError(''); }
  function followUp() {setPhoto(null);setAdding(true);setSave(false);setError('');setShowData(false);}
  function cancelFollowUp() {clearPending();setPhoto(captures.at(-1) || null);setAdding(false);}
  async function analyze() {
    if (!photo?.base64 || busy) return;
    const base = apiUrl();
    if (!base) { setError('Set EXPO_PUBLIC_API_URL to your analysis server.'); return; }
    if (captures.length >= 3) {setError('Three captures complete. Start a new assessment to continue.');return;}
    const allCaptures = [...captures, photo];
    if (allCaptures.reduce((sum,c)=>sum+(c.base64?.length || 0)*0.75,0) > 36_000_000) {setError('Combined captures exceed 36 MB. Use shorter clips.');return;}
    setBusy(true); setError('');
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captures: allCaptures.map(c=>c.mime.startsWith('video/') ? {video:`data:${c.mime};base64,${c.base64}`} : {image:`data:image/jpeg;base64,${c.base64}`}), prior_rubric_context: result ? JSON.stringify({task:result.service_draft.service.name,criteria:result.service_draft.assessment.dimensions.map(c=>({dimension:c.dimension,criterion:c.task_criterion}))}) : '', save, work_statement: statement, performed_work: performedWork, capture_source: 'app_camera' }), signal: AbortSignal.timeout(240000) });
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Analysis is temporarily unavailable. Please try again later.');
      const body = await response.json(); if (!response.ok) throw Error(body.error || 'Analysis failed.');
      if (typeof body.title !== 'string' || !Array.isArray(body.observations) || !body.observations.every((x: unknown) => typeof x === 'string') || !Array.isArray(body.limitations) || !body.limitations.every((x: unknown) => typeof x === 'string')) throw Error('Invalid analysis response.');
      if (!body.service_draft?.service || !Array.isArray(body.service_draft.next_questions)) throw Error('Invalid service draft.');
      if (!body.service_draft.assessment?.coverage || !Array.isArray(body.service_draft.assessment.dimensions)) throw Error('Restart the API server to enable task assessment.');
      setPreviousLevel(result?.service_draft.assessment.skill_level || null);
      setPreviousCoverage(result?.service_draft.assessment.coverage.assessed ?? null);
      setCaptures(allCaptures);setAdding(false);setShowDetails(false);setResult(body);
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed. Please retry.'); } finally { setBusy(false); }
  }
  function reset() { for(const uri of captureUrls.current) if(uri.startsWith('blob:')) URL.revokeObjectURL(uri);captureUrls.current.clear();setCaptures([]);setAdding(false);setPreviousLevel(null);setPreviousCoverage(null);setPhoto(null); setResult(null); setError(''); setStatement(''); setPerformedWork(false); setShowData(false);setSave(false); }
  return <View style={s.page}><StatusBar style="dark" /><ScrollView contentContainerStyle={s.content}>
    <View style={s.header}><Text style={s.logo}>✳ picksell</Text><Text style={s.badge}>PROTOTYPE</Text></View>
    <View style={s.hero}><Text accessibilityRole="header" style={s.title}>{'Get your hands-on\nskills assessed.'}</Text><Text style={s.subtitle}>Turn them into services with PickSell.</Text></View>
    {adding ? <View style={s.assessment}><Text style={s.badge}>CAPTURE {captures.length + 1} OF 3</Text><Text style={s.item}>{result?.service_draft.assessment.needed_evidence[0] || 'Show the missing work process and result.'}</Text><Pressable onPress={cancelFollowUp} disabled={busy}><Text style={s.small}>Cancel additional capture</Text></Pressable></View> : null}
    {photo ? <View style={s.cameraBox}><MediaPreview media={photo}/></View> : <Capture onCapture={receiveCapture} onError={setError}/>}
    {photo && (!result || adding) ? <View style={{ marginTop: 18 }}><TextInput accessibilityLabel="What did you do?" placeholder="What did you do? (optional)" placeholderTextColor="#89988c" value={statement} onChangeText={setStatement} maxLength={500} multiline editable={!busy} style={s.input} /><Pressable accessibilityRole="checkbox" accessibilityState={{checked: performedWork}} disabled={busy} onPress={() => setPerformedWork(!performedWork)}><Text style={s.small}>{performedWork ? '☑' : '☐'} I performed this work · self-reported</Text></Pressable></View> : null}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {busy ? <ActivityIndicator color="#245c3c" style={{ margin: 15 }} /> : null}
    {photo && (!result || adding) ? <View style={s.row}><Pressable disabled={busy} style={s.lightButton} onPress={clearPending}><Text>Retake</Text></Pressable><Pressable disabled={busy} style={[s.button,{flex:1},busy&&s.disabled]} onPress={analyze}><Text style={s.buttonText}>{adding ? 'Update assessment →' : 'Assess my work →'}</Text></Pressable></View> : null}
    {photo && (!result || adding) ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: save }} disabled={busy} onPress={() => setSave(!save)}><Text style={s.small}>{save ? '☑' : '☐'} Save all captures & this assessment privately</Text></Pressable> : null}
    {photo && (!result || adding) ? <Text style={s.small}>Analysis sends all captures’ sampled images to OpenAI. No audio. Without saving, this session is lost when you close or reload.</Text> : null}
    {result && !adding ? <View style={s.card}>
      {result.storage ? <Text style={result.storage.saved ? s.small : s.error}>{result.storage.saved ? 'Saved privately' : result.storage.error}</Text> : null}
      {previousCoverage !== null ? <Text style={s.small}>Updated with capture {captures.length} · {humanize(previousLevel || 'insufficient evidence')} → {humanize(result.service_draft.assessment.skill_level || 'insufficient evidence')} · coverage {previousCoverage}/4 → {result.service_draft.assessment.coverage.assessed}/4</Text> : null}
      <Assessment assessment={result.service_draft.assessment}/>
      {result.service_draft.assessment.strengths?.length ? <><Text style={s.label}>What went well</Text>{result.service_draft.assessment.strengths.map((t,i)=><Text key={i} style={s.item}>{t.text}</Text>)}</> : null}
      {result.service_draft.assessment.improvement_tips?.length ? <><Text style={s.label}>Try this</Text>{result.service_draft.assessment.improvement_tips.map((t,i)=><Text key={i} style={s.item}>{t.tip}</Text>)}</> : null}
      <Text style={s.label}>{captures.length < 3 ? 'Film this next' : 'Still to verify'}</Text>
      <Text style={s.item}>{result.service_draft.assessment.needed_evidence[0]}</Text>
      {captures.length < 3 ? <Pressable style={[s.button,{marginTop:16}]} onPress={followUp}><Text style={s.buttonText}>Capture missing evidence →</Text></Pressable> : <Text style={s.small}>Three captures reviewed. Remaining gaps need a new assessment or expert review.</Text>}
      {result.publication_ticket ? <PublishService key={result.publication_ticket} ticket={result.publication_ticket} draft={result.service_draft}/> : null}
      <Pressable onPress={reset} style={{marginTop:14}}><Text style={s.muted}>Start new assessment</Text></Pressable>
      <Pressable onPress={()=>setShowDetails(!showDetails)} style={[s.lightButton,{marginTop:18}]}><Text>{showDetails ? 'Hide details' : 'Service draft & evidence'}</Text></Pressable>
      {showDetails ? <View>
      <Text style={s.label}>SERVICE DRAFT · NOT PUBLISHED</Text>
      <Text style={s.resultTitle}>{result.service_draft.service.name || 'Tell us about your work'}</Text>
      <Text style={s.muted}>{result.service_draft.service.description || 'This capture does not provide enough context to propose a service.'}</Text>
      {result.service_draft.service.proposed_scope.length ? <Text style={s.label}>Proposed scope · review required</Text> : null}
      {result.service_draft.service.proposed_scope.map((t,i)=><Text key={i} style={s.item}>• {t}</Text>)}
      {result.service_draft.service.exclusions_to_confirm.length ? <Text style={s.label}>Confirm what is excluded</Text> : null}
      {result.service_draft.service.exclusions_to_confirm.map((t,i)=><Text key={i} style={s.muted}>• {t}</Text>)}
      <Text style={s.label}>To make this offer ready</Text>
      {result.service_draft.next_questions.map((t,i)=><Text key={i} style={s.item}>• {t}</Text>)}
      <Text style={s.small}>Publishing also needs your identity, service area, availability, contact channel, and approval.</Text>
      <Text style={s.label}>Capture next</Text>
      {result.service_draft.assessment.needed_evidence.map((t,i)=><Text key={i} style={s.muted}>• {t}</Text>)}
      {result.service_draft.evidence.process.steps.length ? <Text style={s.label}>Observed process</Text> : null}
      {result.service_draft.evidence.process.steps.map((step,i)=><Text key={i} style={s.item}>{step.frame_indices.map(n=>'Capture '+((result.service_draft.evidence.sampling.frames[n]?.capture_index ?? 0)+1)+' · ~'+result.service_draft.evidence.sampling.frames[n]?.approx_seconds+'s').join(', ')} · {step.description}</Text>)}
      {result.service_draft.evidence.process.skill_signals.length ? <Text style={s.label}>Visible skill signals · not a proficiency rating</Text> : null}
      {result.service_draft.evidence.process.skill_signals.map((signal,i)=><View key={i} style={{marginBottom:12}}><Text style={s.item}>{signal.skill} · {signal.frame_indices.map(n=>'Capture '+((result.service_draft.evidence.sampling.frames[n]?.capture_index ?? 0)+1)+' · ~'+result.service_draft.evidence.sampling.frames[n]?.approx_seconds+'s').join(', ')}</Text><Text style={s.muted}>{signal.visible_behavior}</Text><Text style={s.small}>{signal.limitation}</Text></View>)}
      <Text style={s.small}>{result.service_draft.evidence.sampling.limitation}</Text>
      <Text style={s.label}>Visible evidence</Text>
      {result.observations.map((t,i)=><Text key={i} style={s.item}>• {t}</Text>)}
      {result.limitations.map((t,i)=><Text key={i} style={s.muted}>• {t}</Text>)}
      <Pressable onPress={()=>setShowData(!showData)} style={[s.lightButton,{marginTop:20}]}><Text>{showData ? 'Hide' : 'View'} agent data</Text></Pressable>
      {showData ? <Text selectable style={s.json}>{JSON.stringify(result.service_draft,null,2)}</Text> : null}
      </View> : null}
    </View> : null}
  </ScrollView></View>;
}
const s = StyleSheet.create({assessment:{backgroundColor:'#f2f6ef',padding:16,borderRadius:14,marginTop:20},input:{backgroundColor:'white',borderRadius:12,padding:15,minHeight:72,fontSize:14,color:'#245c3c'},json:{fontSize:11,lineHeight:17,marginTop:12,color:'#405247'},page:{flex:1,backgroundColor:'#f6f5f0'},content:{width:'100%',maxWidth:580,alignSelf:'center',padding:22,paddingTop:Platform.OS==='web'?28:60,paddingBottom:50},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:32},logo:{fontSize:25,fontWeight:'700',color:'#245c3c'},badge:{fontSize:10,fontWeight:'700',color:'#598267',letterSpacing:1},hero:{marginBottom:22},title:{fontSize:38,fontWeight:'600',letterSpacing:-1.2,color:'#213b2b',marginBottom:10},subtitle:{fontSize:15,lineHeight:23,color:'#6e8073',maxWidth:430},cameraBox:{height:400,borderRadius:22,overflow:'hidden',backgroundColor:'#e6ece4'},camera:{width:'100%',height:'100%'},placeholder:{flex:1,alignItems:'center',justifyContent:'center',gap:18},row:{flexDirection:'row',gap:12,marginTop:18},button:{backgroundColor:'#245c3c',padding:18,borderRadius:14,alignItems:'center',justifyContent:'center'},buttonText:{color:'white',fontSize:15,fontWeight:'600'},lightButton:{backgroundColor:'#e7eee3',padding:18,borderRadius:14,alignItems:'center'},disabled:{opacity:0.4},muted:{color:'#738375',fontSize:13,lineHeight:21},small:{color:'#7d8b80',fontSize:11,lineHeight:17,marginTop:16},error:{color:'#a13d31',fontSize:13,marginTop:14},card:{backgroundColor:'white',padding:24,borderRadius:18,marginTop:25},resultTitle:{fontSize:22,fontWeight:'600',color:'#245c3c',marginVertical:15},item:{fontSize:14,lineHeight:23,color:'#405247',marginBottom:7},label:{fontSize:12,fontWeight:'700',color:'#6e8073',marginTop:14,marginBottom:8}});
