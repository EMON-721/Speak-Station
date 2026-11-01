import assert from 'node:assert/strict';
import {loadTs} from './ts-loader.mjs';
const {questions,dailyQuestions,examQuestions,examSets,revisionSets}=loadTs('app/lib/questions.ts');
const {buildSpeakingBooks}=loadTs('app/lib/speaking-books.ts');
const {defaultContent,contentSchema,stageQuestions}=loadTs('app/lib/content.ts');
assert(questions.length>=1000,'large question collection must remain available');
assert.equal(new Set(questions.map(q=>q.id)).size,questions.length,'all question identifiers must be unique');
for(const q of questions){
 assert([1,2,3].includes(q.part),'each question belongs to Part 1–3');
 assert(q.id&&q.topic&&q.text?.trim(),'question has ID, topic and prompt');
}
const books=buildSpeakingBooks(questions,240);
assert.equal(books.length,240,'240 complete speaking books must render');
for(const book of books){
 assert.equal(book.questions.length,11,'each book includes 11 prompts');
 assert.deepEqual([1,2,3].map(p=>book.questions.filter(q=>q.part===p).length),[4,1,6]);
 assert.equal(new Set(book.questions.map(q=>q.id)).size,11,'no duplicate within a book');
}
assert.equal(examSets.length,30,'30 weekly exams');
assert.equal(revisionSets.length,15,'15 revision exams');
assert(contentSchema.safeParse(defaultContent).success,'site default content is valid');
assert.equal(defaultContent.exams.filter(e=>e.kind==='weekly').length,30);
assert.equal(defaultContent.exams.filter(e=>e.kind==='revision').length,15);
for(const e of defaultContent.exams){
 assert(Number.isInteger(e.day)&&e.day>=1&&e.day<=210);
 const list=stageQuestions(e.day,e.kind,questions,defaultContent,examQuestions);
 assert(list.length>=8,'exam '+e.id+' needs at least eight questions');
 assert.equal(new Set(list.map(q=>q.id)).size,list.length,'exam '+e.id+' needs distinct prompts');
 for(const p of [1,2,3])assert(list.some(q=>q.part===p),'exam '+e.id+' missing Part '+p);
}
for(let day=1;day<=210;day++){
 const list=dailyQuestions(day,questions);
 assert.equal(list.length,8);
 for(const p of [1,2,3])assert(list.some(q=>q.part===p),'daily day '+day+' missing Part '+p);
 assert.equal(new Set(list.map(q=>q.id)).size,list.length,'daily day '+day+' contains duplicate questions');
}
console.log('PASS: '+questions.length+' actual questions, 240 books, 30 weekly and 15 revision exams, 210 daily practices, schema');
