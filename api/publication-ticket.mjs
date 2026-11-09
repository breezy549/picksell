import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
const temporarySecret = randomBytes(32).toString('hex');
const secret = () => process.env.PUBLICATION_SECRET || temporarySecret;
const sign = value => createHmac('sha256', secret()).update(value).digest('base64url');

export function createPublicationTicket(draft) {
  const a = draft.assessment;
  if (!draft.service.name || a.domain !== 'general' || !a.coverage?.assessed || a.skill_level === 'emerging') return null;
  const payload = Buffer.from(JSON.stringify({id:randomUUID(),expires:Date.now()+24*60*60*1000,
    assessment:{task:a.task,skill_level:a.skill_level,status:a.status,summary:a.summary,coverage:a.coverage,rubric_version:a.rubric_version,
      disclaimer:'Provisional AI opinion about submitted work. Not skill certification; identity and authorship are unverified.',
      capture_count:draft.evidence.capture_count || 1,model:draft.generation.model,assessed_at:draft.evidence.received_at}
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function readPublicationTicket(ticket) {
  if (typeof ticket !== 'string' || ticket.length > 20000) throw Error('Analyze your work again before publishing.');
  const [payload, signature, extra] = ticket.split('.');
  const expected = Buffer.from(sign(payload || '')), actual = Buffer.from(signature || '');
  if (extra || expected.length !== actual.length || !timingSafeEqual(expected,actual)) throw Error('Analyze your work again before publishing.');
  const data = JSON.parse(Buffer.from(payload,'base64url').toString());
  if (!data.id || data.expires < Date.now()) throw Error('Assessment expired. Analyze your work again.');
  return data;
}
export const managementToken = receiptId => sign(`manage:${receiptId}`);
