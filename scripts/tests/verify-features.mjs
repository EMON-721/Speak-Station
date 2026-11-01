import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync('app/workspace.tsx','utf8');
const feedback=fs.readFileSync('app/feedback-report.tsx','utf8');
const cards=fs.readFileSync('app/question-answer-cards.tsx','utf8');
const api=fs.readFileSync('app/api/[...path]/route.ts','utf8');

// This is a feature-preservation contract, not a brittle test of UI wording.
// If a core learner section is intentionally removed, change this test only
// after explicit owner approval and a documented replacement.
function hasSection(id){return ui.includes('id="'+id+'"')}
for(const id of ['home','progress','achievements','academy']){
 assert(hasSection(id),'Protected learner feature missing: '+id);
}
assert(ui.indexOf('id="academy"')>ui.indexOf('id="progress"'),'compact guidelines remain below progress');
assert(ui.includes('progress-dashboard-highlights'),'dashboard KPI summaries remain available');
assert(ui.includes('progress-activity-panel'),'seven-day activity visualization must remain');
assert(ui.includes('progress-timeline-item'),'day-wise completion history must remain');
assert(ui.includes('progress-error-panel'),'error category analysis must remain');
assert(ui.includes('achievement-grid'),'achievements must remain');
assert(ui.includes('score-history-table'),'part and overall score history must remain');
assert(ui.includes("{view==='profile'"),'learner profile editing must remain');
assert(ui.includes('profile-identifiers'),'profile name, account ID and email must remain');
assert(ui.includes('compact-guidelines-list'),'small expandable guidelines remain');
assert(feedback.includes("['mistakes','Mistake map']"),'explicit mistake map must remain');
assert(feedback.includes("['corrections','Grammar & structure']"),'question grammar feedback must remain');
assert(feedback.includes("['pronunciation','Pronunciation & fluency']"),'audio pronunciation and fluency guidance must remain');
assert(feedback.includes("['vocabulary','Vocabulary']"),'word-choice and vocabulary guidance must remain');
assert(feedback.includes("['gaps','Missing ideas']"),'answer development feedback must remain');
assert(cards.includes('Your original answer')&&cards.includes('Your corrected answer'),'each question keeps separate full answer and correction');
assert(api.includes('activityDays:days.map('),'server must return real dated activity history');
assert(api.includes('durationSeconds:result.durationSeconds'),'score history keeps numerical duration but not raw audio');
assert(api.includes('compactIssueCounts('),'server must derive safe error-category totals');
console.log('PASS: Protected dashboard, achievements, profile, guidelines and detailed feedback preserved');
