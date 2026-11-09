// Product-owned provisional rubric. It is not a credential or an industry standard.
const text = { type: 'string' };
const strings = { type: 'array', items: text };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const dimensions = ['procedure', 'tool_handling', 'finish_quality', 'outcome_check'];
export const assessmentSchema = object({
  task: { type: ['string', 'null'] },
  domain: { type: 'string', enum: ['general', 'healthcare_or_care', 'safety_critical', 'unclear'] },
  task_difficulty: { type: 'string', enum: ['routine', 'complex', 'unknown'] },
  criteria: { type: 'array', items: object({
    dimension: { type: 'string', enum: dimensions },
    task_criterion: text,
    rating: { type: 'string', enum: ['not_observable', 'emerging', 'developing', 'proficient', 'advanced'] },
    observation_indices: { type: 'array', items: { type: 'integer' } },
    frame_indices: { type: 'array', items: { type: 'integer' } },
    rationale: text, limitation: text, next_evidence: text
  }) },
  next_capture: text,
  improvement_tips: { type: 'array', items: object({ tip: text, frame_indices: { type: 'array', items: { type: 'integer' } } }) },
  summary: text
});
export const assessmentInstructions = `
Also produce task_assessment: a PROVISIONAL, task-specific AI opinion, never a professional certification or validated industry benchmark.
Identify the actual narrow task (not a person's profession). domain healthcare_or_care includes surgery, dentistry, therapy, massage, nursing and eldercare; safety_critical includes gas, mains electrical, structural work and other hazardous work. Uncertain domain = unclear. Do not infer competence from identity, age, appearance, clothing or expensive tools.
Return exactly four criteria, one each: procedure, tool_handling, finish_quality, outcome_check. Adapt task_criterion to this particular task with a concrete observable condition (e.g. joint alignment rather than generic 'good quality'). Do not invent a standard number, regulation, license or an official industry source. This rubric is an AI-adapted PickSell draft.
Use these behavioral anchors consistently:
not_observable: required evidence is missing; NOT a low skill rating.
emerging: a specific visible task-related error or repeated loss of control is shown.
developing: some relevant actions succeed but visible inconsistencies or corrections remain.
proficient: the relevant action/result meets the stated observable criterion within this sample.
advanced: complex task-specific control and successful adaptation are directly shown; a neat finished object alone never qualifies.
Each rated criterion requires both observation_indices pointing to directly visible observations and frame_indices pointing to supplied frames, a rationale describing the evidence, an explicit limitation, and a targeted next_evidence request. Add relevant facts to observations when needed (up to 8). Never use seller claims as evidence for a rating. For not_observable, both reference arrays must be empty and explain what evidence is missing. Never infer an error merely because a step was not filmed. Audio, hidden steps, durability, authorship, repeated reliability and independent working ability are unverified.
For photos: only finish_quality may be rated; all process and outcome_check criteria must be not_observable. Blank images, tools alone, selfies and no identifiable work: all criteria not_observable, task null.
For healthcare_or_care, safety_critical and unclear domains: all ratings not_observable; describe visible facts and task-specific evidence required for qualified human review, never judge clinical competence or safety from this capture.
next_capture: choose ONE highest-value missing piece and write one short filming instruction under 30 words. Prefer a finished-result/function check when process has already been shown; do not ask to repeat the whole process unnecessarily. If the intended result is unclear, ask to show or name the intended result alongside the work. For high-risk domains request qualified review. Provide at most two improvement_tips, each a short concrete action to improve a VISIBLE weakness, with valid frame_indices. Do not invent mistakes from missing footage; return [] if no defensible improvement tip exists. For healthcare_or_care, safety_critical or unclear domains return []. Keep each tip under 25 words. Summary must be at most two short sentences: what can be assessed now, and the main remaining gap. Do not repeat certification disclaimers (the UI supplies them). Summary must discuss only this capture and its limitations, not label the person as a skilled/unskilled professional. Do not propose prices from these ratings.`;

export function validateTaskAssessment(a, analysis, media) {
  if (!a.next_capture.trim()) return false;
  if (a.improvement_tips.length > 2 || (a.domain !== 'general' && a.improvement_tips.length)) return false;
  if (a.improvement_tips.some(t => !t.tip.trim() || !t.frame_indices.length || t.frame_indices.some(i => i < 0 || i >= media.frames.length))) return false;
  if (a.criteria.length !== dimensions.length || new Set(a.criteria.map(c => c.dimension)).size !== dimensions.length) return false;
  if (a.task !== null && !a.task.trim()) return false;
  return a.criteria.every(c => {
    if (![c.task_criterion, c.rationale, c.limitation, c.next_evidence].every(s => s.trim())) return false;
    if (c.rating === 'not_observable') return !c.observation_indices.length && !c.frame_indices.length;
    if (!a.task || !analysis.proposal.supported || a.domain !== 'general') return false;
    if (media.kind === 'photo' && c.dimension !== 'finish_quality') return false;
    if (c.dimension !== 'finish_quality' && media.captures && !c.frame_indices.some(i => media.frames[i]?.media_kind === 'video')) return false;
    return c.observation_indices.length > 0 && c.frame_indices.length > 0 &&
      c.observation_indices.every(i => i >= 0 && i < analysis.observations.length) &&
      c.frame_indices.every(i => i >= 0 && i < media.frames.length);
  });
}

export function buildAssessment(a, media) {
  const rated = a.criteria.filter(c => c.rating !== 'not_observable');
  const byDimension = Object.fromEntries(a.criteria.map(c => [c.dimension, c]));
  const ranks = { emerging: 1, developing: 2, proficient: 3, advanced: 4 };
  const required = ['procedure', 'tool_handling', 'outcome_check'];
  const frames = new Set(rated.flatMap(c => c.frame_indices));
  const sufficient = a.domain === 'general' && media.kind === 'video' && frames.size >= 2 &&
    required.every(d => ranks[byDimension[d].rating]);
  // A short sparse sample cannot establish repeatable advanced expertise.
  const level = sufficient ? ['', 'emerging', 'developing', 'proficient'][Math.min(3, ...rated.map(c => ranks[c.rating]))] : null;
  const review = a.domain !== 'general';
  return {
    unit: 'specific_task_sample', task: a.task, domain: a.domain,
    skill_level: level, status: review ? 'human_review_required' : level ? 'provisional_opinion' : 'insufficient_evidence',
    scope: 'visible_sample_only', summary: a.summary,
    strengths: rated.filter(c => ['proficient','advanced'].includes(c.rating)).slice(0,2).map(c => ({text:c.rationale,frame_indices:c.frame_indices})),
    improvement_tips: a.improvement_tips,
    rubric_version: 'picksell-observable-task-v1',
    rubric: { source: 'picksell_ai_adapted', industry_standard_verified: false, expert_validated: false,
      anchors: { emerging: 'Visible errors or loss of control', developing: 'Partial success with visible inconsistencies', proficient: 'Meets this sample’s observable criteria', advanced: 'Complex control and adaptation; overall level needs repeated expert-reviewed evidence' },
      aggregation: 'Requires procedure, tool handling and outcome evidence across at least two sampled frames. Lowest observed rating; capped at proficient.' },
    coverage: { assessed: rated.length, total: dimensions.length },
    dimensions: a.criteria.map(c => ({ ...c, score: null, evidence_refs: c.frame_indices.map(index => ({ frame_index: index, capture_index: media.frames[index].capture_index ?? 0, approx_seconds: media.frames[index].time ?? 0 })) })),
    task_difficulty: a.task_difficulty, continuous_process_observed: false, assessor_validation: 'not_validated',
    credentials: { status: 'not_verified', requirements: null }, verified_job_count: 0, customer_outcomes: [],
    needed_evidence: [...new Set([a.next_capture, ...[...a.criteria.filter(c => c.rating === 'not_observable'), ...a.criteria.filter(c => c.rating !== 'not_observable')].map(c => c.next_evidence)])],
    limitations: ['AI opinion, not skill certification or a verified industry-standard assessment.', 'Authorship, independent performance and repeatability are unverified.', ...(media.kind === 'photo' ? ['A photo cannot establish process proficiency.'] : ['Sparse sampled frames cannot establish continuous execution.'])]
  };
}
