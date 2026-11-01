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

const policy=fs.readFileSync('app/lib/session-policy.ts','utf8');
assert(policy.includes('PRACTICE_INTERVAL_MS=6*60*60*1000'));
assert(policy.includes('TEST_INTERVAL_MS=7*24*60*60*1000'));
assert(ui.includes("api('begin-session'"),'session start must be admitted by D1');
assert(api.includes('requireStudySession('),'AI assessment and score submission must verify the server-issued session');
console.log('PASS: server-enforced study schedules and quota display preserved');

assert(ui.includes('member-number'),'profile name retains joining number');
assert(ui.includes('data.user.memberNumber'),'user number appears in profile');
assert(api.includes('INSERT OR IGNORE INTO member_numbers'),'member number assigned only once');
assert(api.includes('member_number FROM member_numbers WHERE user_id=?'),'member number lookup is user-scoped');
assert(api.includes("started_at>?)<3"),'D1 enforces three practices in a rolling day');
console.log('PASS: numbered private profiles and server-side three-practice limit');

// Admin visibility is also a security boundary: a regular learner must not
// enter the editor through UI navigation, modal state, or any admin API.
assert(ui.includes("data.isAdmin&&<div className=\"owner-bar\""),'owner-only toolbar must not render to ordinary members');
assert(ui.includes("if(v==='admin'&&!data.isAdmin)return"),'non-owner cannot navigate to admin view');
assert(ui.includes("view==='admin'&&data.isAdmin"),'admin dashboard must not mount for regular members');
assert(ui.includes("modal==='layout'&&data.isAdmin"),'layout editor must not mount for regular members');
assert(api.includes('isVerifiedGoogleOwner(user,E())'),'backend verifies Google owner from trusted session');
assert(api.includes("if(!admin)return fail('Administrator access"),'admin endpoints deny non-owner');
assert(api.includes("if(!isVerifiedGoogleOwner(user,E()))return fail('Owner access"),'CMS batch cannot be changed by a normal user or unauthenticated request');
console.log('PASS: owner-only controls and CMS/API routes remain isolated from regular learners');
