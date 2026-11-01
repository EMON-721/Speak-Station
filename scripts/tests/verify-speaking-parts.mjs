import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function loadTs(path){
 const src=fs.readFileSync(path,'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};
 new Function('module','exports','require',js)(m,m.exports,()=>{throw new Error('Unexpected runtime import in '+path)});
 return m.exports;
}
const {buildSpeakingBooks}=loadTs('app/lib/speaking-books.ts');
const bank=[];
for(const topic of ['Cities','Learning','Traditions']){
 for(const [part,size] of [[1,8],[2,3],[3,10]]){
  for(let n=0;n<size;n++)bank.push({id:topic+'-'+part+'-'+n,part,topic,text:topic+' question '+n});
 }
}
const books=buildSpeakingBooks(bank,240);
assert.equal(books.length,240,'all 240 books generated');
for(const b of books){
 assert.equal(b.questions.length,11,'eleven questions per book');
 assert.deepEqual([1,2,3].map(p=>b.questions.filter(q=>q.part===p).length),[4,1,6]);
 assert.equal(new Set(b.questions.map(q=>q.id)).size,11,'questions do not repeat within a book');
}
const {summarizeSpeakingParts}=loadTs('app/lib/part-scores.ts');
const q=books[0].questions;
const receipts=q.map((question,i)=>({questionId:question.id,scores:Array(4).fill(question.part===1?6:question.part===2?5:7),recorded:true,reviewed:true}));
const report=summarizeSpeakingParts(receipts,q,6.5);
assert.equal(report.partScores[1],6);
assert.equal(report.partScores[2],5);
assert.equal(report.partScores[3],7);
assert.equal(report.band,6,'final band is equally weighted by part, not question count');
assert.equal(report.passed,false);
const missing=summarizeSpeakingParts(receipts.slice(0,-1),q);
assert.equal(missing.band,null,'incomplete part cannot produce final score');
const noPronunciation=receipts.map((r,i)=>i===1?{...r,scores:[6,6,6,null]}:r);
assert.equal(summarizeSpeakingParts(noPronunciation,q).band,null,'missing acoustic evidence prevents a final score');
const frontend=fs.readFileSync('app/workspace.tsx','utf8');
const backend=fs.readFileSync('app/api/[...path]/route.ts','utf8');
const assessment=fs.readFileSync('app/lib/part-assessment.ts','utf8');
assert(frontend.includes("api('assess-part',form)"),'frontend posts a complete part');
assert(!frontend.includes("api('submit',f)"),'frontend does not submit per-question assessments');
assert(frontend.includes("saveQuestionAndContinue"),'recording stays available between questions');
assert(frontend.includes("if(audio&&elapsed>=3){await saveQuestionAndContinue();return}"),'Next question saves a fresh recording automatically');
assert(frontend.includes("const nextPart=session.list.findIndex(q=>q.part>part)"),'completed part navigates directly to the next speaking part');
assert(frontend.includes("disabled={recording||busy||(!answered(selected.id)&&!audio&&!partReports[selected.part])}"),'Next question is available for a recorded but not yet saved answer');
assert(frontend.includes("part-complete-action"),'completed part has a visible continue button');
assert(frontend.includes("'Ready to save'"),'unsaved audio has a clear status');
assert(frontend.includes("assessCompletedPart"),'part assessment exists');
assert(backend.includes("expected.some((q,i)=>q.id!==ids[i])"),'server validates complete assigned part');
assert(backend.includes("summarizeSpeakingParts(valid,expected"),'daily/weekly final score covers all parts');
assert(assessment.includes("One authenticated Gemini generation")&&assessment.includes("await fetch("),'one Gemini assessment request per part');
const css=fs.readFileSync('app/globals.css','utf8');
assert(css.includes("/* November: keep the book explorer"),'book explorer CSS regression fix');
console.log('PASS: 240 books, 3-part composition, band computation, incomplete evidence, UI/backend routing, CSS markers');

const {normalizePartQuestionReviews}=loadTs('app/lib/question-reviews.ts');
const expected=[
 {question:{id:'q1',text:'Where do you live?'},transcript:'I live near the city.'},
 {question:{id:'q2',text:'What do you like about your city?'},transcript:'I like its parks.'},
 {question:{id:'q3',text:'Do you talk about it with friends?'},transcript:'Sometimes with my friends.'},
 {question:{id:'q4',text:'What would you change?'},transcript:'I would improve buses.'}
];
const unsorted=[
 {questionId:'q4',transcript:'Audio answer four.',correctedAnswer:'I would improve the buses.',comment:'Clear choice.'},
 {questionId:'q1',transcript:'Audio answer one.',correctedAnswer:'I live near the city.',comment:'Good start.'},
 {questionId:'unexpected',correctedAnswer:'Wrong correction from a different question.'},
 {questionId:'q2',transcript:'Audio answer two.',correctedAnswer:'I like the parks.',comment:'Explain why.'}
];
const aligned=normalizePartQuestionReviews(unsorted,expected);
assert.deepEqual(aligned.map(a=>a.questionId),['q1','q2','q3','q4'],'question order follows the test, not the AI response');
assert.equal(aligned[0].correctedAnswer,'I live near the city.','first correction stays with question 1');
assert.equal(aligned[1].correctedAnswer,'I like the parks.','second correction stays with question 2');
assert.equal(aligned[2].correctedAnswer,null,'missing correction must never be guessed or borrowed');
assert.equal(aligned[2].transcript,'Sometimes with my friends.','missing AI transcript falls back to recorded browser transcript');
assert.equal(aligned[3].correctedAnswer,'I would improve the buses.','fourth correction stays with question 4');
const prompt=fs.readFileSync('app/lib/part-assessment.ts','utf8');
const feedbackComponentSource=fs.readFileSync('app/feedback-report.tsx','utf8');
const cards=fs.readFileSync('app/question-answer-cards.tsx','utf8');
assert(prompt.includes('questionFeedback')&&prompt.includes('exact questionId'),'one-part Gemini prompt requests stable per-question answer grouping');
assert(frontend.includes('questionReviews={partReports[selected.part]?questionReviewsForPart(selected.part):[]}'),'Part report sends aligned answers to feedback renderer');
assert(frontend.includes('<QuestionAnswerCards answers={questionReviewsForPart(p)}'),'previous parts keep their grouped answers');
assert(feedbackComponentSource.includes('<QuestionAnswerCards answers={questionReviews}'),'full answer tab displays per-question cards');
assert(cards.includes('Your original answer')&&cards.includes('Your corrected answer'),'each card separates original and corrected spoken answers');
console.log('PASS: distinct question/answer mapping, missing model review fallback, and question-specific corrected-answer UI');

