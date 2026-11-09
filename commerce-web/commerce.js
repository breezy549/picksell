'use strict';
const content=document.querySelector('#content'),message=document.querySelector('#message');
const parts=location.pathname.split('/').filter(Boolean),isManage=parts[0]==='manage',id=parts[1];
let managementKey=new URLSearchParams(location.hash.slice(1)).get('key');
// Keep the capability in this tab only; do not include it in requests' URLs or referrers.
if(isManage&&id){if(managementKey)sessionStorage.setItem(`picksell-manage:${id}`,managementKey);else managementKey=sessionStorage.getItem(`picksell-manage:${id}`);history.replaceState(null,'',location.pathname);}
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const showError=e=>{message.textContent=e.message||'Unable to load. Please retry.';};
async function api(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Service data is temporarily unavailable. Please try again later.');const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed.');return data;}
function addText(parent,title,text){parent.append(el('h3',title),el('p',text));}
function field(form,name,label,type='text',max=300,min=1){const l=el('label',label),input=el(type==='textarea'?'textarea':'input');input.name=name;input.id=name;input.required=true;input.maxLength=max;input.minLength=min;if(type!=='textarea')input.type=type;l.htmlFor=name;form.append(l,input);return input;}
function displayService(service){
 content.replaceChildren();content.hidden=false;message.textContent='';document.title=`${service.title} · PickSell`;
 content.append(el('span','SELLER-CONFIRMED OFFER','badge'),el('h1',service.title),el('p',`Offered by ${service.seller_name} · Identity not verified`,'muted'),el('p',service.description));
 const card=el('div',undefined,'card'),dl=el('dl');
 const price=service.pricing_mode==='quote'?'Request a quote':`From ${service.amount.toLocaleString()} ${service.currency} / ${service.pricing_unit}`;
 for(const [key,value] of [['Area',service.service_area],['Availability',`${service.availability} (${service.timezone})`],['Price',price]])dl.append(el('dt',key),el('dd',value));
 card.append(dl);addText(card,'Included · completion criteria',service.scope);addText(card,'Not included',service.exclusions);content.append(card);
 const opinion=el('details',undefined,'card opinion');opinion.append(el('summary','About the submitted work'));
 opinion.append(el('p',service.assessment.summary),el('p',`Assessed task: ${service.assessment.task || 'Not specified'}`,'muted'),el('p',`Observed criteria: ${service.assessment.coverage.assessed}/4 · ${service.assessment.capture_count} capture(s)`,'muted'),el('p',service.assessment.disclaimer,'muted'),el('p','Original photos and videos are private. The seller-defined offer may differ from the assessed task.','muted'));content.append(opinion);
 const agent=el('a','Read service JSON ↗');agent.href=service.links.self;content.append(agent);
}
function quoteForm(service){
 const card=el('section',undefined,'card');card.append(el('h2','Ask for a quote'),el('p','Your details go to the seller’s private inbox. This does not book or pay for a service.','muted'));
 const form=el('form');field(form,'buyer_name','Your name','text',80);field(form,'buyer_email','Reply email','email',254);
 field(form,'scope','What do you need?','textarea',2000,5);field(form,'preferred_time',`Preferred date / time (${service.timezone})`,'text',300,3);field(form,'location','Location or remote','text',300,2);
 const budget=field(form,'budget','Budget (optional)','text',100);budget.required=false;
 const label=el('label'),consent=el('input');consent.type='checkbox';consent.name='contact_consent';consent.required=true;label.append(consent,document.createTextNode('Share my request and reply email with this seller.'));form.append(label);
 const button=el('button','Send quote request');button.type='submit';const status=el('p',undefined,'muted');status.setAttribute('role','status');form.append(button,status);card.append(form);content.append(card);
 let requestId=crypto.randomUUID();form.addEventListener('input',()=>{requestId=crypto.randomUUID();});
 form.addEventListener('submit',async event=>{event.preventDefault();if(button.disabled)return;const data=Object.fromEntries(new FormData(form));button.disabled=true;status.textContent='Sending…';try{const result=await api(service.links.request_quote,{method:'POST',body:JSON.stringify({...data,request_id:requestId,contact_consent:consent.checked})});status.textContent=`${result.message} Reference: ${result.id}`;button.textContent='Request sent';for(const input of form.elements)input.disabled=true;}catch(e){status.textContent=e.message;button.disabled=false;}});
}
async function manage(){
 if(!managementKey)throw Error('Open your private management link to view requests.');
 const headers={Authorization:`Bearer ${managementKey}`};const data=await api(`/api/services/${id}/requests`,{headers});displayService(data.service);
 content.prepend(el('p','PRIVATE SELLER INBOX · Do not share your management link.','badge'));
 const section=el('section',undefined,'card');section.append(el('h2',`Quote requests (${data.requests.length})`),el('p','No email notifications or automatic bookings. Refresh this inbox to check requests.','muted'));
 const refresh=el('button','Refresh inbox','secondary');refresh.onclick=()=>manage().catch(showError);section.append(refresh);
 if(!data.requests.length)section.append(el('p','No requests yet. Share your public service link.'));
 for(const request of data.requests){const row=el('div',undefined,'card'),p=request.payload;row.append(el('span',request.status.toUpperCase(),'badge'),el('h3',p.buyer_name),el('p',p.buyer_email,'wrap'),el('p',p.scope));row.append(el('p',`${p.preferred_time}\n${p.location}\nBudget: ${p.budget||'Not specified'}`,'muted'));
 for(const [state,label] of [['reviewing','Mark reviewing'],['declined','Decline']]){const button=el('button',label,'secondary');button.disabled=request.status===state;button.onclick=async()=>{button.disabled=true;try{await api(`/api/services/${id}/requests/${request.id}`,{method:'PATCH',headers,body:JSON.stringify({status:state})});await manage();}catch(e){showError(e);button.disabled=false;}};row.append(button);}section.append(row);}
 content.append(section);
 if(data.service.status==='active'){const close=el('button','Unpublish service','secondary');close.onclick=async()=>{if(!confirm('Stop public access and new quote requests? Existing requests remain in your inbox.'))return;try{await api(`/api/services/${id}`,{method:'PATCH',headers,body:JSON.stringify({status:'closed'})});await manage();}catch(e){showError(e);}};content.append(close);}else content.append(el('p','This service is unpublished.'));
}
async function start(){
 if(isManage){await manage();return;}
 if(id&&parts[0]==='s'){const service=await api(`/api/services/${id}`);displayService(service);quoteForm(service);return;}
 content.hidden=false;message.textContent='';content.append(el('h1','Find a service.'),el('p','Seller-confirmed offers, with transparent AI assessment limits.','muted'));
 const form=el('form'),search=field(form,'q','Search services','search',100);search.required=false;const button=el('button','Search');form.append(button);content.append(form);const list=el('div');content.append(list);
 async function load(){list.replaceChildren();const data=await api(`/api/services?q=${encodeURIComponent(search.value)}`);if(!data.services.length)list.append(el('p','No matching services yet.'));for(const service of data.services){const card=el('div',undefined,'card'),link=el('a',service.title);link.href=service.links.page;card.append(link,el('p',service.description),el('p',service.service_area,'muted'));list.append(card);}}
 form.onsubmit=event=>{event.preventDefault();load().catch(showError);};await load();
}
start().catch(showError);
