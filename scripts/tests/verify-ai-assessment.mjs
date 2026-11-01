import assert from 'node:assert/strict';
import {loadTs} from './ts-loader.mjs';
const {assessSpeakingPart}=loadTs('app/lib/part-assessment.ts');
const criteria=(score=6)=>Object.fromEntries(['fluency','lexical','grammar','pronunciation'].map(k=>[k,{observation:'Evidence-based observation for '+k,score,evidence:['Speaker was audible and provided a relevant complete answer'],drill:'Practise one sentence and review the audio.'}]));
const makeResponse=ids=>({
 summary:'All answers addressed their assigned questions with some development.',
 strengths:['Clear responses'],priorities:['Use more examples'],
 corrections:[],gaps:[],vocabulary:[],correctedAnswer:'',structures:[],
 improved:'',criteria:criteria(),overall:null,
 transcript:'I want to speak about the topic because it is relevant to my daily life. I have different experiences and some useful examples to explain my opinion.',
 questionFeedback:ids.slice().reverse().map(id=>({questionId:id,transcript:'Original answer for '+id,correctedAnswer:'Corrected answer for '+id,improvedAnswer:'Better answer for '+id,comment:'Relevant response for '+id,corrections:[{original:'go',corrected:'went',explanation:'Past tense',category:'Grammar'}]}))
});
const build=(part,count)=>Array.from({length:count},(_,i)=>({question:{id:'test-p'+part+'-'+i,part,text:'Describe topic number '+i,cue:[],topic:'QA'},transcript:'My answer is relevant to this particular speaking question and includes a personal example.',audio:new Uint8Array([1,2,3,4,5,6]).buffer,mime:'audio/webm',duration:10}));
const prior=globalThis.fetch;
try{
 for(const [part,count] of [[1,4],[2,1],[3,6]]){
  const answers=build(part,count);let requests=0;
  globalThis.fetch=async(url,init)=>{requests++;assert(String(url).includes('generativelanguage.googleapis.com'));
   assert.equal(init.method,'POST');
   assert.equal(init.headers['x-goog-api-key'],'mock-key');
   const body=JSON.parse(init.body);
   assert.equal(body.contents[0].parts.filter(p=>p.inlineData).length,count,'one audio item per question');
   for(const answer of answers)assert(body.contents[0].parts.some(p=>p.text?.includes(answer.question.id)),'question IDs stay paired with audio');
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(makeResponse(answers.map(a=>a.question.id)))}]}}]}),{status:200,headers:{'content-type':'application/json'}});
  };
  const result=await assessSpeakingPart({GEMINI_API_KEY:'mock-key',AI_MODEL:'test-model'},part,answers);
  assert.equal(requests,1,'exactly ONE AI request per completed part');
  assert.equal(result.questionFeedback.length,count);
  assert.deepEqual(result.questionFeedback.map(q=>q.questionId),answers.map(q=>q.question.id),'responses map by question ID despite reversed order');
  assert.equal(result.questionFeedback[0].correctedAnswer,'Corrected answer for '+answers[0].question.id);
  assert.equal(result.questionFeedback[0].corrections[0].category,'Grammar');
  assert.equal(result.overall,6,'four rubric scores should generate the part practice band');
 }
 let failed=false;
 try{await assessSpeakingPart({GEMINI_API_KEY:''},1,build(1,4))}catch{failed=true}
 assert(failed,'missing provider secret must fail before trying to assess');
 console.log('PASS: all three Parts, exact question mapping, one AI request per part, four rubric scores and missing key');
}finally{globalThis.fetch=prior}
