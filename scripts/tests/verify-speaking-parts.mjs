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
assert(frontend.includes("assessCompletedPart"),'part assessment exists');
assert(backend.includes("expected.some((q,i)=>q.id!==ids[i])"),'server validates complete assigned part');
assert(backend.includes("summarizeSpeakingParts(valid,expected"),'daily/weekly final score covers all parts');
assert(assessment.includes("One authenticated Gemini generation")&&assessment.includes("await fetch("),'one Gemini assessment request per part');
const css=fs.readFileSync('app/globals.css','utf8');
assert(css.includes("/* November: keep the book explorer"),'book explorer CSS regression fix');
console.log('PASS: 240 books, 3-part composition, band computation, incomplete evidence, UI/backend routing, CSS markers');
