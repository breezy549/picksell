import assert from 'node:assert/strict';
import { analysis } from './draft-fixture.mjs';
import { validateAnalysis, createServiceDraft } from '../api/service-draft.mjs';

const media = {kind:'video',mime:'video/mp4',source:'data:video/mp4;base64,YQ==',duration:3,frames:[{index:0,time:0},{index:1,time:1},{index:2,time:2}]};
function example() {
  const value = structuredClone(analysis);
  value.task_assessment.task = 'Wrapping a small gift box';
  value.observations = ['Edges line up in the folded paper.', 'Hands hold the fold while tape is applied.', 'The final fold stays closed when the box is turned.'];
  value.task_assessment.criteria.forEach(c => Object.assign(c, {rating:'proficient',observation_indices:[0,1,2],frame_indices:[0,1,2],rationale:'The observed folds align and stay secured.',limitation:'Repeatability is unknown.'}));
  return value;
}
const evaluate = value => createServiceDraft(value, {}, 'test-model', media).assessment;
const good = example();
assert.equal(validateAnalysis(good, media), true);
assert.equal(evaluate(good).skill_level, 'proficient');
assert.equal(evaluate(good).rubric.industry_standard_verified, false);
assert.equal(evaluate(good).assessor_validation, 'not_validated');
assert.equal(evaluate(good).dimensions[0].evidence_refs[1].approx_seconds, 1);

const mixed = example(); mixed.task_assessment.criteria[0].rating = 'developing';
assert.equal(evaluate(mixed).skill_level, 'developing');
mixed.task_assessment.criteria[0].rating = 'emerging';
assert.equal(evaluate(mixed).skill_level, 'emerging');
const advanced = example(); advanced.task_assessment.criteria.forEach(c => c.rating = 'advanced');
assert.equal(evaluate(advanced).skill_level, 'proficient');
const partial = example(); Object.assign(partial.task_assessment.criteria[3], {rating:'not_observable',observation_indices:[],frame_indices:[]});
assert.equal(validateAnalysis(partial, media), true);
assert.equal(evaluate(partial).skill_level, null); // missing outcome is not a low score
assert.equal(evaluate(partial).coverage.assessed, 3);

const photo = structuredClone(analysis);
Object.assign(photo.task_assessment.criteria[2], {rating:'proficient',observation_indices:[0],frame_indices:[0]});
assert.equal(validateAnalysis(photo), true);
assert.equal(createServiceDraft(photo,{image:'data:image/jpeg;base64,YQ=='},'test').assessment.skill_level, null);
assert.equal(validateAnalysis(good), false); // no process skill from a photo

for (const mutate of [
  v => {v.task_assessment.criteria[0].rating = 'expert';},
  v => {v.task_assessment.criteria[0].observation_indices = [99];},
  v => {v.task_assessment.criteria[0].frame_indices = [-1];},
  v => {v.task_assessment.criteria[0].frame_indices = [];},
  v => {v.task_assessment.criteria[0].dimension = 'finish_quality';},
  v => {v.task_assessment.domain = 'healthcare_or_care';},
  v => {v.task_assessment.domain = 'safety_critical';},
  v => {v.task_assessment.task = null;},
  v => {v.task_assessment.criteria[0].limitation = '';},
]) {
  const value = example(); mutate(value); assert.equal(validateAnalysis(value, media), false);
}
const singleFrame = example(); singleFrame.task_assessment.criteria.forEach(c => c.frame_indices = [0]);
assert.equal(evaluate(singleFrame).skill_level, null);
const clinical = structuredClone(analysis); clinical.task_assessment.domain = 'healthcare_or_care';
assert.equal(validateAnalysis(clinical, media), true);
assert.equal(evaluate(clinical).status, 'human_review_required');
assert.equal(evaluate(clinical).skill_level, null);
console.log('PASS: evidence gates, photo limits, provisional levels, missing evidence, high-risk review, invalid ratings and references.');
