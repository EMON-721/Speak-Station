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
console.log('PASS: 240 practice books, three-part scoring and missing-evidence handling');

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
assert.equal(normalizePartQuestionReviews(aligned,expected)[2].transcriptSource,'browser','re-render keeps its original browser transcript provenance');
assert.equal(aligned[3].correctedAnswer,'I would improve the buses.','fourth correction stays with question 4');
console.log('PASS: question-ID answer alignment, transcript provenance and independent corrections');

const {weeklyGate,passedTest,cooldownUntil,isCoolingDown}=loadTs('app/lib/weekly-policy.ts');
const pass=(kind,number)=>({kind,milestone:number*(kind==='weekly'?7:14),answers:JSON.stringify({passed:true,practiceBand:6,partScores:{1:6,2:6,3:6}})});
const fail=(kind,number)=>({kind,milestone:number*(kind==='weekly'?7:14),answers:JSON.stringify({passed:false,practiceBand:5.5,partScores:{1:5,2:6,3:5.5}})});
assert.equal(weeklyGate([], 'weekly', 1).unlocked,true,'first weekly test opens immediately');
assert.equal(weeklyGate([], 'weekly', 2).unlocked,false,'weekly 2 remains locked before weekly 1');
assert.equal(weeklyGate([fail('weekly',1)],'weekly',2).unlocked,false,'failed weekly result cannot unlock the next exam');
assert.equal(weeklyGate([pass('weekly',1)],'weekly',2).unlocked,true,'a 6.0 result unlocks the following weekly test');
assert.equal(weeklyGate([pass('weekly',1),pass('weekly',2)],'weekly',3).unlocked,false,'weekly 3 requires a mandatory revision');
assert.equal(weeklyGate([pass('weekly',1),pass('weekly',2)],'revision',1).unlocked,true,'revision unlocks after two passed weekly tests');
assert.equal(weeklyGate([pass('weekly',1),pass('weekly',2),fail('revision',1)],'weekly',3).unlocked,false,'failed revision does not unlock weekly 3');
assert.equal(weeklyGate([pass('weekly',1),pass('weekly',2),pass('revision',1)],'weekly',3).unlocked,true,'passed revision unlocks weekly 3');
assert.equal(weeklyGate([pass('weekly',1),pass('weekly',2),pass('revision',1),pass('weekly',3),pass('weekly',4)],'weekly',5).unlocked,false,'revision gates repeat after every two weekly tests');
assert.equal(passedTest(pass('weekly',1)),true);
const completeAt='2026-11-01T06:00:00.000Z';
const expiry=cooldownUntil(completeAt);
assert.equal(expiry,'2026-11-16T06:00:00.000Z','practice question cooldown is exactly 15 days');
assert.equal(isCoolingDown(expiry,new Date('2026-11-15T00:00:00Z')),true);
assert.equal(isCoolingDown(expiry,new Date('2026-11-16T06:00:00Z')),false);
console.log('PASS: weekly unlock, revision gating, 6.0 threshold and 15-day cooldown');
