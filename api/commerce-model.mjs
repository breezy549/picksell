export class CommerceError extends Error {
  constructor(status,message) {super(message);this.status=status;}
}
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(value,name,min,max)=>{
  if(typeof value!=='string' || value.trim().length<min || value.trim().length>max) throw new CommerceError(400,`${name} must be ${min}–${max} characters.`);
  return value.trim();
};
export function validateOffer(input) {
  if (!input || input.publish_consent!==true) throw new CommerceError(400,'Confirm publication before creating a public link.');
  const offer={
    title:text(input.title,'Service name',3,100),description:text(input.description,'Description',10,1000),
    seller_name:text(input.seller_name,'Display name',1,80),scope:text(input.scope,'Included work and completion criteria',5,1500),
    exclusions:text(input.exclusions,'Excluded work',1,1000),service_area:text(input.service_area,'Service area',2,150),
    availability:text(input.availability,'Availability',3,300),timezone:text(input.timezone,'Time zone',3,80),
    pricing_mode:input.pricing_mode,currency:input.currency,amount:null,
    pricing_unit:text(input.pricing_unit,'Pricing unit',1,100)
  };
  try {new Intl.DateTimeFormat('en',{timeZone:offer.timezone}).format();} catch {throw new CommerceError(400,'Use an IANA time zone, e.g. Asia/Seoul.');}
  if(!['quote','starting_at'].includes(offer.pricing_mode) || !['KRW','USD','EUR','GBP','JPY'].includes(offer.currency))throw new CommerceError(400,'Choose a supported pricing mode and currency.');
  if(offer.pricing_mode==='starting_at') {
    if(typeof input.amount!=='number' || !Number.isFinite(input.amount) || input.amount<=0 || input.amount>1e9)throw new CommerceError(400,'Enter a valid positive starting price.');
    if(['KRW','JPY'].includes(offer.currency) && !Number.isInteger(input.amount))throw new CommerceError(400,'This currency requires a whole-number price.');
    offer.amount=input.amount;
  }
  return offer;
}
export function validateQuote(input) {
  if(!input || !uuidPattern.test(input.request_id || ''))throw new CommerceError(400,'request_id must be a UUID; reuse it for retries.');
  const payload={buyer_name:text(input.buyer_name,'Name',1,80),buyer_email:text(input.buyer_email,'Email',3,254),
    scope:text(input.scope,'Requested work',5,2000),preferred_time:text(input.preferred_time,'Preferred time',3,300),
    location:text(input.location,'Location or remote',2,300),budget:input.budget===undefined || input.budget==='' ? null : text(input.budget,'Budget',1,100)};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.buyer_email))throw new CommerceError(400,'Enter a valid reply email.');
  if(input.contact_consent!==true)throw new CommerceError(400,'Confirm sharing your request and reply email with the seller.');
  return {id:input.request_id,payload};
}
export function publicService(row,base) {
  return {schema_version:'picksell.public-service.v1',id:row.id,status:row.status,...row.public_data,created_at:row.created_at,
    booking_status:'quote_request_only',seller_approval_required:true,payment_supported:false,
    links:{page:`${base}/s/${row.id}`,self:`${base}/api/services/${row.id}`,request_quote:`${base}/api/services/${row.id}/requests`,openapi:`${base}/openapi.json`}};
}
