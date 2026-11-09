import {useState} from 'react';
import {apiUrl} from '../lib/api-url';
import {Linking,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';

type Draft = {service:{name:string|null;description:string|null;proposed_scope:string[];exclusions_to_confirm:string[]}};
type Published = {service:{id:string;links:{page:string;self:string;openapi:string}};management_url:string;local_only:boolean};
export default function PublishService({ticket,draft}:{ticket:string;draft:Draft}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[consent,setConsent]=useState(false),[published,setPublished]=useState<Published|null>(null),[showPrivate,setShowPrivate]=useState(false);
 const [form,setForm]=useState({title:draft.service.name||'',description:draft.service.description||'',scope:draft.service.proposed_scope.join('\n'),exclusions:draft.service.exclusions_to_confirm.join('\n')||'None specified',seller_name:'',service_area:'',availability:'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Seoul',pricing_mode:'quote',amount:'',currency:'KRW',pricing_unit:'per job'});
 const update=(name:keyof typeof form,value:string)=>{setForm(old=>({...old,[name]:value}));setError('');};
 async function publish(){
  if(busy||!consent)return;setBusy(true);setError('');
  try{
   const base=apiUrl();
   if(!base)throw Error('Analysis server URL is missing.');
   const response=await fetch(`${base.replace(/\/$/,'')}/api/services`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,amount:form.pricing_mode==='starting_at'?Number(form.amount):null,publication_ticket:ticket,publish_consent:consent}),signal:AbortSignal.timeout(30000)});
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Publishing is temporarily unavailable. Please try again later.');
   const result=await response.json();if(!response.ok)throw Error(result.error||'Could not publish.');setPublished(result);
  }catch(e){setError(e instanceof Error?e.message:'Could not publish.');}finally{setBusy(false);}
 }
 function input(name:keyof typeof form,label:string,placeholder:string,maxLength:number,multiline=false){return <View key={name}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={form[name]} onChangeText={v=>update(name,v)} placeholder={placeholder} placeholderTextColor="#89988c" maxLength={maxLength} multiline={multiline} editable={!busy} style={[s.input,multiline&&{minHeight:78}]} /></View>;}
 if(published)return <View style={s.card}>
  <Text style={s.title}>{published.local_only?'Service created · local preview':'Your service link is ready'}</Text>
  {published.local_only?<Text style={s.note}>This link works on this computer only. After deploying, set PUBLIC_BASE_URL on the server to make links shareable.</Text>:null}
  <Text selectable style={s.link}>{published.service.links.page}</Text>
  <Pressable style={s.button} onPress={()=>Linking.openURL(published.service.links.page)}><Text style={s.buttonText}>Open service page ↗</Text></Pressable>
  <Text style={s.note}>Agents can read your offer and request a quote. Requests are not bookings.</Text>
  <Pressable style={s.secondary} onPress={()=>Linking.openURL(published.service.links.self)}><Text>View agent JSON ↗</Text></Pressable>
  <Pressable style={s.secondary} onPress={()=>setShowPrivate(!showPrivate)}><Text>{showPrivate?'Hide':'Show'} private inbox link</Text></Pressable>
  {showPrivate?<><Text style={s.note}>Save this private link before leaving. Anyone with it can read buyer details and unpublish this service. Do not share it.</Text><Text selectable style={s.link}>{published.management_url}</Text><Pressable style={s.secondary} onPress={()=>Linking.openURL(published.management_url)}><Text>Open seller inbox ↗</Text></Pressable></>:null}
 </View>;
 return <View style={s.card}><Text style={s.title}>Make this a service?</Text><Text style={s.note}>Define what you offer. Your assessment is an AI opinion, not a qualification.</Text>
 {!open?<Pressable style={s.button} onPress={()=>setOpen(true)}><Text style={s.buttonText}>Create service offer →</Text></Pressable>:<>
  {input('title','Service name','What can a buyer request?',100)}
  {input('description','Description','Describe the service in one sentence.',1000,true)}
  {input('scope','Included work & completion criteria','Specify quantity, work and the expected result.',1500,true)}
  {input('exclusions','Not included','Review and confirm exclusions.',1000,true)}
  {input('seller_name','Public display name','Name buyers will see',80)}
  {input('service_area','Service area','Seoul · Mapo, or remote',150)}
  {input('availability','Availability','Weekends, 10:00–17:00 · confirm by quote',300)}
  {input('timezone','Time zone','Asia/Seoul',80)}
  <Text style={s.label}>Pricing</Text><View style={s.row}>{[['quote','Quote required'],['starting_at','Starting price']].map(([value,label])=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:form.pricing_mode===value}} disabled={busy} onPress={()=>update('pricing_mode',value)} style={[s.choice,form.pricing_mode===value&&s.selected]}><Text>{label}</Text></Pressable>)}</View>
  {form.pricing_mode==='starting_at'?input('amount','Starting amount','50000',12):null}
  {input('currency','Currency','KRW / USD / EUR / GBP / JPY',3)}
  {input('pricing_unit','Price applies to','per box / per hour / per job',100)}
  <Text style={s.note}>Publishing saves these conditions and the AI assessment summary publicly. Original photos and videos stay private. Your availability and price require confirmation for each request.</Text>
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}} disabled={busy} onPress={()=>setConsent(!consent)}><Text style={s.note}>{consent?'☑':'☐'} I reviewed the offer and agree to publish it.</Text></Pressable>
  {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
  <Pressable disabled={busy||!consent} style={[s.button,(busy||!consent)&&{opacity:.45}]} onPress={publish}><Text style={s.buttonText}>{busy?'Creating link…':'Publish & create link →'}</Text></Pressable>
  <Pressable disabled={busy} style={s.secondary} onPress={()=>setOpen(false)}><Text>Keep working on my skill</Text></Pressable>
 </>}
 </View>;
}
const s=StyleSheet.create({card:{backgroundColor:'#f1f5ed',padding:18,borderRadius:16,marginTop:24},title:{fontSize:20,fontWeight:'600',color:'#245c3c'},note:{fontSize:12,lineHeight:19,color:'#65776a',marginTop:12},label:{fontSize:12,fontWeight:'600',color:'#405247',marginTop:16,marginBottom:6},input:{backgroundColor:'#fff',padding:12,borderRadius:10,color:'#213b2b',fontSize:14},button:{backgroundColor:'#245c3c',padding:16,borderRadius:12,marginTop:16,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'600'},secondary:{padding:12,marginTop:8,alignItems:'center'},row:{flexDirection:'row',gap:8},choice:{padding:10,borderRadius:10,backgroundColor:'#fff'},selected:{backgroundColor:'#d8e5cf'},error:{color:'#a13d31',marginTop:12,fontSize:13},link:{fontSize:12,lineHeight:20,color:'#245c3c',marginTop:12}});
