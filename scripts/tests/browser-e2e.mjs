import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {loadTs} from './ts-loader.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'/tmp/speak-playwright/node_modules/playwright');
const {questions}=loadTs('app/lib/questions.ts');
const {defaultContent}=loadTs('app/lib/content.ts');
const ORIGIN=process.env.BROWSER_QA_ORIGIN||'http://127.0.0.1:5173';
fs.mkdirSync('artifacts/browser-qa',{recursive:true});
const checks=[];
function record(name,status,detail=''){checks.push({name,status,detail});console.log(status,name,detail)}
let profile={name:'QA Learner',phone:'',target:'8.0',track:210,exam_date:''};
let tests=[];
let assessmentCalls={1:0,2:0,3:0};
const fakeState=()=>({user:{id:'qa-user',name:'QA Learner',email:'qa@example.test'},profile,
 authProvider:'Google',content:defaultContent,contentRevision:0,attempts:[],saved:[],completed:[],activityDays:[],tests,
 streak:0,stage:{type:'daily',day:1},cooldowns:[],weeklyPassBand:6,aiConfigured:true,connection:{configured:true,source:'qa-mock'},
 storageReady:true,audioStorageReady:false,learningStorage:'progress-only',messages:[],isAdmin:false});
const fakeCriteria=()=>Object.fromEntries(['fluency','lexical','grammar','pronunciation'].map(k=>[k,{observation:'Clear evidence in audio',score:6,evidence:['Speech was understandable'],drill:'Practise this answer once more.'}]));
const reply=async(route,payload,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(payload)});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1366,height:850},permissions:['microphone']});
const page=await context.newPage();page.setDefaultTimeout(18000);
const browserErrors=[];
page.on('pageerror',error=>browserErrors.push(error.message));
await page.addInitScript(()=>{
  const fakeStream={getTracks:()=>[{stop:()=>{},kind:'audio'}],getAudioTracks:()=>[{stop:()=>{},kind:'audio'}]};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>fakeStream}});
  class Recorder{
   static isTypeSupported(){return true}
   constructor(stream,opts){this.state='inactive';this.mimeType=opts?.mimeType||'audio/webm'}
   start(){this.state='recording'}
   stop(){this.state='inactive';this.ondataavailable?.({data:new Blob([new Uint8Array(1200)],{type:'audio/webm'})});this.onstop?.()}
   pause(){this.state='paused'}
   resume(){this.state='recording'}
  }
  window.MediaRecorder=Recorder;
});
await page.route('**/api/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 if(path==='/api/state')return reply(route,fakeState());
 if(path==='/api/questions')return reply(route,{questions});
 if(path==='/api/content')return reply(route,{content:defaultContent});
 if(path==='/api/profile'){
  const body=JSON.parse(req.postData()||'{}');
  profile={...profile,name:body.name||'QA Learner',phone:body.phone||'',target:body.target||'8.0',track:Number(body.track)||210,exam_date:body.examDate||''};
  return reply(route,{ok:true});
 }
 if(path==='/api/transcribe')return reply(route,{transcript:'I enjoy discussing this topic because I have a useful personal experience and some good ideas.'});
 if(path==='/api/assess-part'){
  const body=req.postData()||'';
  const match=body.match(/name="meta"\r?\n\r?\n([\s\S]*?)\r?\n--/);
  if(!match)return reply(route,{error:'Missing multipart meta in QA recorder'},400);
  const meta=JSON.parse(match[1]);assessmentCalls[meta.part]++;
  const feedback={summary:'You answered every question and developed your main ideas.',
   strengths:['Relevant answers'],priorities:['Use more specific examples'],
   corrections:[],gaps:[],vocabulary:[],correctedAnswer:'',structures:[],improved:'',criteria:fakeCriteria(),
   overall:6,transcript:meta.answers.map(a=>'Original answer for '+a.questionId).join(' '),
   questionFeedback:meta.answers.map(a=>({questionId:a.questionId,transcript:'Original answer for '+a.questionId,
    correctedAnswer:'Corrected answer for '+a.questionId,improvedAnswer:'A natural response for '+a.questionId,
    comment:'Explain one more detail.',corrections:[]}))};
  return reply(route,{part:meta.part,feedback,receipts:meta.answers.map(a=>({questionId:a.questionId,receipt:'mock-receipt-'+a.questionId})),assessmentCount:1,official:false});
 }
 if(path==='/api/practice-result'){
  tests.push({id:'mock-test-'+tests.length,kind:'book',milestone:1,answers:JSON.stringify({practiceBand:6,partScores:{1:6,2:6,3:6},passed:true}),completed_at:new Date().toISOString()});
  return reply(route,{band:6,passed:true,partScores:{1:6,2:6,3:6},criteria:{fluency:6,lexical:6,grammar:6,pronunciation:6},message:'Speaking practice completed.'});
 }
 if(path==='/api/complete-stage')return reply(route,{...fakeState(),stageResult:{band:6,partScores:{1:6,2:6,3:6},criteria:{fluency:6,lexical:6,grammar:6,pronunciation:6},passed:true}});
 if(path==='/api/message')return reply(route,{ok:true});
 return reply(route,{error:'Unmocked QA API '+path},404);
});
const capture=async name=>{try{await page.screenshot({path:'artifacts/browser-qa/'+name+'.png',animations:'disabled'});}catch{}};
async function verify(name,fn){
 try{await fn();record(name,'PASS');}
 catch(error){record(name,'FAIL',String(error.message||error).slice(0,250));await capture('failure-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-'));throw error;}
}
try{
 await page.clock.install();
 await page.goto(ORIGIN,{waitUntil:'domcontentloaded',timeout:50000});
 await verify('Authenticated homepage and profile header (mock identity)',async()=>{
  await page.locator('#home').waitFor({state:'visible',timeout:30000});
  await page.locator('.profile-trigger').waitFor();
  assert(await page.getByText('Speak Station',{exact:true}).count()>0);
 });
 await verify('Dashboard, achievements and dated progress',async()=>{
  assert(await page.locator('#progress .progress-dashboard-highlight').count()>=4);
  assert(await page.locator('#progress .progress-activity-panel').count()===1);
  assert(await page.locator('#progress .progress-timeline-panel').count()===1);
  assert(await page.locator('#achievements .achievement').count()>=4);
  assert(await page.locator('#progress .progress-error-panel').count()===1);
  assert(await page.locator('#progress .score-history-table').count()===1);
 });
 await verify('240 complete books and weekly/revision controls',async()=>{
  await page.getByText('Explore 240 complete test books').first().waitFor();
  assert(await page.locator('#books .book-tile').count()>=1);
  assert(await page.locator('#exams .sample-mock-preview').count()===1);
  const weekly=page.locator('#exams .exam-set').first();
  assert(await weekly.count());
  assert(!(await weekly.getByRole('button',{name:/Start exam/}).isDisabled()));
  assert(await page.locator('#exams .exam-set').nth(1).getByRole('button',{name:/Locked/}).isDisabled());
 });
 await verify('Small guidelines below progress (no expanded tutorial)',async()=>{
  const above=await page.locator('#progress').evaluate(e=>e.getBoundingClientRect().top+window.scrollY);
  const below=await page.locator('#academy').evaluate(e=>e.getBoundingClientRect().top+window.scrollY);
  assert(below>above);
  assert(await page.locator('#academy details').count()>0);
 });
 await verify('Profile information and editable settings',async()=>{
  await page.locator('.profile-trigger').click();
  await page.locator('.profile-form').waitFor({state:'visible'});
  assert((await page.locator('.profile-identifiers').innerText()).includes('qa@example.test'));
  await page.getByLabel('Your name',{exact:true}).fill('QA Updated');
  await page.getByRole('button',{name:/Save my preferences/}).click();
  await page.getByText('Your learning preferences are saved.').waitFor();
  assert.equal(profile.name,'QA Updated');
  await page.getByRole('button',{name:/Home/}).first().click();
  await page.locator('#home').waitFor();
 });
 await verify('Responsive mobile and desktop overflow',async()=>{
  await capture('desktop-home');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
  if(overflow>5){const culprits=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+5).slice(0,8).map(e=>e.className||e.tagName));throw Error('Mobile horizontal overflow '+overflow+'px: '+culprits.join(', '))}
  await capture('mobile-home');
  await page.setViewportSize({width:1366,height:850});
 });
 await verify('Speaking book opens with question sidebar and instructions',async()=>{
  await page.getByRole('button',{name:/Start speaking practice/}).click();
  await page.locator('#practice').waitFor({state:'visible'});
  assert(await page.locator('#practice .session-side-panel .side-question-list button').count()===4);
  assert(await page.locator('#practice .record-actions').count()===1);
  assert(await page.locator('#practice .question-navigation').count()===1);
 });
 await verify('Sample assessment exposes every detailed feedback tab',async()=>{
  await page.getByRole('button',{name:/View a complete feedback example/}).click();
  await page.locator('#feedback-report').waitFor();
  for(const label of ['Full answer','Mistake map','Grammar & structure','Missing ideas','Vocabulary','Pronunciation & fluency','Next steps']){
   await page.getByRole('tab',{name:new RegExp(label.replace('&','&'),'i')}).first().click();
   assert(await page.locator('#feedback-report .assessment-body').count()===1);
  }
  await capture('detailed-feedback');
 });
 assert.equal(browserErrors.length,0,'No JavaScript page crashes: '+browserErrors.slice(0,3).join(' | '));
 record('No uncaught browser JavaScript errors','PASS');
}catch(error){console.log('Browser suite stopped at first failed control; see screenshots and error above.');process.exitCode=1}
finally{
 const summary=['## Authenticated browser UI checks (API and microphone simulated)','This test uses a **fake local user and mocked API**, not production Google Login, Gemini or D1.','','| Test | Outcome | Detail |','|---|---|---|',...checks.map(x=>'| '+x.name+' | '+x.status+' | '+x.detail.replace(/\|/g,'/')+' |')].join('\n');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
 await browser.close();
}
