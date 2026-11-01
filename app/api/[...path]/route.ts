import {issueReceipt,readReceipt,receiptResult,type PracticeReceipt} from '../../lib/practice-receipts';
import {summarizeSpeakingParts} from '../../lib/part-scores';
import {buildSpeakingBooks} from '../../lib/speaking-books';
import {readContent,contentSchema,estimatedBand,stageQuestions} from '../../lib/content';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {questions,byId,dailyQuestions,examQuestions,type Question} from '../../lib/questions';
import {nextStage,streak} from '../../lib/learning';
import {WEEKLY_PASS_BAND,weeklyGate,cooldownUntil,passedTest} from '../../lib/weekly-policy';
import {assess} from '../../lib/assessment';
import {assessSpeakingPart,type PartAnswer} from '../../lib/part-assessment';
import {transcribeAudio,validAudio,audioMime} from '../../lib/transcription';
import {z} from 'zod';
import {assessmentFailureMessage,ProviderFailure} from '../../lib/provider-errors';
import {aiConfiguration,connectionStatus,encryptCredential,verifyGemini} from '../../lib/integration';
export const dynamic='force-dynamic';
const E=()=>env as any;
const receiptSecret=()=>String(E().PRACTICE_RECEIPT_SECRET||E().CREDENTIAL_ENCRYPTION_KEY||'');
const proof=(value:unknown,userId:string)=>readReceipt(value,receiptSecret(),userId);
const response=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(msg:string,status=400)=>response({error:msg},status);
const now=()=>new Date().toISOString();
function db(){if(!E().DB)throw new Error('STORAGE_UNAVAILABLE');return E().DB as D1Database;}
const parse=(s:any,fallback:any=null)=>{try{return JSON.parse(s)}catch{return fallback}};
async function rows(sql:string,...args:any[]){return (await db().prepare(sql).bind(...args).all()).results as any[];}
async function execute(sql:string,...args:any[]){return db().prepare(sql).bind(...args).run();}
async function allQuestions(){const changes=await rows('SELECT * FROM question_overrides');const map=new Map(questions.map(q=>[q.id,q]));for(const c of changes){if(c.archived)map.delete(c.id);else map.set(c.id,parse(c.data));}return [...map.values()];}
async function activeCooldowns(uid:string){
 await execute('DELETE FROM question_cooldowns WHERE available_at<=?',now());
 return rows('SELECT question_id,available_at FROM question_cooldowns WHERE user_id=? AND available_at>?',uid,now());
}
async function cleanupOldAudio(){
 const cutoff=new Date(Date.now()-24*3600000).toISOString();
 const expired=await rows('SELECT id,audio_key FROM attempts WHERE created_at<? LIMIT 50',cutoff);
 for(const item of expired){try{if(item.audio_key)await E().BUCKET?.delete(item.audio_key)}catch{}await execute('DELETE FROM attempts WHERE id=?',item.id)}
}
async function learningContext(uid:string){const [profiles,days,tests,content]=await Promise.all([rows('SELECT track FROM profiles WHERE user_id=?',uid),rows('SELECT day FROM days WHERE user_id=?',uid),rows('SELECT kind,milestone,answers FROM tests WHERE user_id=?',uid),readContent(db())]);return {content,stage:nextStage(days.map(d=>d.day),tests,profiles[0]?.track||210,content.exams)};}
async function state(user:any){
 const authProvider=E().AUTH_MODE==='google'?'Google':'ChatGPT';const connection=await connectionStatus(E(),db());const content=await readContent(db());const revisionRow=await rows("SELECT value FROM settings WHERE key='site_content_revision'");const contentRevision=Number(revisionRow[0]?.value||0);
 if(!user)return {authProvider,content,contentRevision,user:null,profile:null,attempts:[],saved:[],completed:[],tests:[],streak:0,stage:{type:'daily',day:1},aiConfigured:connection.configured,connection,storageReady:!!E().DB,audioStorageReady:false,learningStorage:'progress-only',isAdmin:false};
 await execute('INSERT OR IGNORE INTO profiles (user_id,name,track,created_at) VALUES (?,?,?,?)',user.userId,user.displayName,210,now());
 const [profiles,attempts,saved,days,tests,cooldowns]=await Promise.all([rows('SELECT * FROM profiles WHERE user_id=?',user.userId),rows('SELECT * FROM attempts WHERE user_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 100',user.userId,new Date(Date.now()-86400000).toISOString()),rows('SELECT * FROM saved WHERE user_id=?',user.userId),rows('SELECT * FROM days WHERE user_id=? ORDER BY day',user.userId),rows('SELECT * FROM tests WHERE user_id=?',user.userId),activeCooldowns(user.userId)]);
 const complete=days.map(d=>d.day);
 return {authProvider,content,contentRevision,messages:await rows('SELECT id,subject,body,reply,status,created_at FROM messages WHERE user_id=? ORDER BY created_at DESC LIMIT 50',user.userId),user:{id:user.userId,name:user.displayName,email:user.email},profile:profiles[0],attempts:attempts.map(a=>({...a,feedback:parse(a.feedback)})),saved:saved.map(s=>({...s,data:parse(s.data)})),completed:complete,tests,streak:streak(days.map(a=>a.completed_at)),stage:nextStage(complete,tests,profiles[0].track,content.exams),cooldowns,weeklyPassBand:WEEKLY_PASS_BAND,aiConfigured:connection.configured,connection,storageReady:true,audioStorageReady:false,learningStorage:'progress-only',isAdmin:!!E().ADMIN_EMAIL&&user.email.toLowerCase()===E().ADMIN_EMAIL.toLowerCase()};
}
async function handler(req:Request){
 const path=new URL(req.url).pathname.replace(/^\/api\//,'');const user=await getChatGPTUser();
 if(user){const control=(await rows('SELECT status FROM user_access WHERE user_id=?',user.userId))[0];if(control&&control.status!=='active')return fail(control.status==='deleted'?'This account has been removed by the administrator.':'Your account is suspended. Contact the site owner.',403);await execute("INSERT INTO user_access (user_id,email,status,reason,updated_at) VALUES (?,?,'active','',?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email",user.userId,user.email,now());}
 if(req.method==='GET'&&path==='state'){if(user)await cleanupOldAudio();return response(await state(user))}
 if(!user&&E().AUTH_MODE==='google')return fail('Sign in with Google to access Speak Station.',401);
 if(req.method==='GET'&&path==='content')return response({content:await readContent(db())});
 if(req.method==='GET'&&path==='questions')return response({questions:await allQuestions()});
 if(req.method==='POST'&&path==='content-batch'){
  // Service-only updates rely on the dispatch access boundary of this owner-private Site.
  // Disable CONTENT_UPDATES_ALLOWED before changing this Site's audience.
  if(E().CONTENT_UPDATES_ALLOWED!=='owner_private')return fail('Content updates are disabled.',403);
  if(user&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Content edits must start from this website.',403);
  if(user&&(!E().ADMIN_EMAIL||user.email.toLowerCase()!==E().ADMIN_EMAIL.toLowerCase()))return fail('Owner access is required.',403);
  if(Number(req.headers.get('content-length')||0)>256000)return fail('Content batch is too large.',413);
  const schema=z.object({questions:z.array(z.object({id:z.string().regex(/^ADD-\d{4}-\d{2}-\d{2}-P[123]-\d{2}$/),text:z.string().min(15).max(1000),part:z.number().int().min(1).max(3),topic:z.string().min(1).max(80),difficulty:z.string().max(40),duration:z.number().int().min(15).max(180),objective:z.string().max(500),cue:z.array(z.string().max(200)).max(5).optional(),related:z.array(z.string()).max(5)})).min(1).max(60)});
  const batch=schema.parse(await req.json());const bank=await allQuestions();const known=new Set(bank.map(q=>q.text.toLowerCase()));let added=0;
  for(const q of batch.questions){if(known.has(q.text.toLowerCase()))continue;const inserted=await execute('INSERT OR IGNORE INTO question_overrides (id,data,archived) VALUES (?,?,0)',q.id,JSON.stringify(q));if(inserted.meta.changes){known.add(q.text.toLowerCase());added++;}}
  if(added)await execute('INSERT INTO audit VALUES (?,?,?,?,?)',crypto.randomUUID(),user?.userId||'site_content_update','content.batch',`${added} original questions added`,now());return response({added,total:(await allQuestions()).length});
 }
 if(!user)return fail('Sign in to save your learning progress.',401);
 const uid=user.userId;
 const admin=!!E().ADMIN_EMAIL&&user.email.toLowerCase()===E().ADMIN_EMAIL.toLowerCase();
 if(req.method!=='GET'){
  const origin=req.headers.get('origin');if(!origin||new URL(origin).origin!==new URL(req.url).origin)return fail('This action must start from Speak Station.',403);
  const length=Number(req.headers.get('content-length')||0);if(length>(path==='assess-part'?17:9)*1024*1024)return fail(path==='assess-part'?'Combined part audio must be smaller than 17 MB.':'Audio files must be smaller than 8 MB.',413);
 }
 if(req.method==='GET'&&path.startsWith('audio/')){
  const id=path.slice(6);const a=admin?(await rows('SELECT * FROM attempts WHERE id=?',id))[0]:(await rows('SELECT * FROM attempts WHERE id=? AND user_id=?',id,uid))[0];if(!a)return fail('Recording not found.',404);
  const object=await E().BUCKET?.get(a.audio_key);if(!object)return fail('Recording is unavailable.',404);
  return new Response(object.body,{headers:{'Content-Type':a.mime,'Cache-Control':'private, no-store','Content-Disposition':`inline; filename="speak-station-${a.id}.${a.mime.includes('mp4')?'mp4':a.mime.includes('ogg')?'ogg':'webm'}"`,'X-Content-Type-Options':'nosniff'}});
 }
 if(req.method==='GET'&&path==='export')return response(await state(user));
 if(path==='integration'&&req.method==='POST'){
  if(!admin)return fail('Only the site owner can connect an AI provider.',403);
  if(!E().CREDENTIAL_ENCRYPTION_KEY)return fail('Secure credential storage is not configured.',503);
  const body=z.object({key:z.string().min(20).max(300)}).parse(await req.json());
  try{const model=await verifyGemini(body.key);const encrypted=await encryptCredential(body.key,E().CREDENTIAL_ENCRYPTION_KEY);const checkedAt=now();await execute("INSERT INTO settings (key,value) VALUES ('gemini_connection',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({encrypted,model,checkedAt}));await execute('INSERT INTO audit VALUES (?,?,?,?,?)',crypto.randomUUID(),uid,'integration.connected','Gemini connection verified; key stored encrypted',now());return response({ok:true,model,checkedAt});}catch(e){return fail(e instanceof Error?e.message:'Connection could not be verified.',400);}
 }
 if(path==='integration/test'&&req.method==='POST'){
  if(!admin)return fail('Only the site owner can run a connection test.',403);
  const config=await aiConfiguration(E(),db());if(!(config.GEMINI_API_KEY||config.OPENAI_API_KEY))return fail('Connect an AI key first.',503);
  const date=now().slice(0,10),limit=Math.max(1,Math.min(100,Number(E().DAILY_AI_LIMIT)||20));const used=await execute('INSERT INTO usage (user_id,date,count) VALUES (?,?,1) ON CONFLICT(user_id,date) DO UPDATE SET count=count+1 WHERE count<?',uid,date,limit);if(!used.meta.changes)return fail('Daily assessment limit reached. Try again tomorrow.',429);
  try{
   let active=config,refreshed=false;const sample='Synthetic connection test only: I am living in Dhaka since five years. I enjoy my hometown because the people are friendly.';let feedback;
   try{feedback=await assess(active,questions[0],sample,null,'');}
   catch(error){if(!(error instanceof ProviderFailure)||error.httpStatus!==404||!active.GEMINI_API_KEY)throw error;const model=await verifyGemini(active.GEMINI_API_KEY);active={...active,AI_MODEL:model};const rows=await db().prepare("SELECT value FROM settings WHERE key='gemini_connection'").bind().all();const current:any=rows.results?.[0];if(current){const stored=JSON.parse(current.value);stored.model=model;stored.checkedAt=now();await execute("UPDATE settings SET value=? WHERE key='gemini_connection'",JSON.stringify(stored));}feedback=await assess(active,questions[0],sample,null,'');refreshed=true;}
   return response({ok:true,provider:active.AI_PROVIDER||'gemini',model:active.AI_MODEL,modelRefreshed:refreshed,checkedAt:now(),corrections:feedback.corrections.length,vocabulary:feedback.vocabulary.length,summary:feedback.summary,sampleCorrection:feedback.corrections[0]?.corrected||null});
  }catch(e){return fail(assessmentFailureMessage(e),502);}

 }
 if(path==='transcribe'&&req.method==='POST'){
  const config=await aiConfiguration(E(),db());if(!(config.GEMINI_API_KEY||config.OPENAI_API_KEY))return fail('Connect AI to enable automatic audio transcription.',503);
  const f=await req.formData(),audio=f.get('audio'),language=String(f.get('language')||'auto');
  if(!['auto','en-US','bn-BD'].includes(language))return fail('Choose a supported transcription language.');
  if(!(audio instanceof File)||audio.size<500||audio.size>8*1024*1024||!/^audio\/(webm|ogg|mp4|wav|mpeg)$/.test(audioMime(audio.type)))return fail('Use an audio recording of up to 8 MB.');
  const bytes=await audio.arrayBuffer();if(!validAudio(bytes))return fail('This file is not a supported audio recording.');
  const minute='transcribe:'+now().slice(0,16),date='transcribe:'+now().slice(0,10);
  for(const [key,limit] of [[minute,8],[date,600]] as const){const usage=await execute('INSERT INTO usage (user_id,date,count) VALUES (?,?,1) ON CONFLICT(user_id,date) DO UPDATE SET count=count+1 WHERE count<?',uid,key,limit);if(!usage.meta.changes)return fail('Automatic transcription limit reached. Please wait before retrying.',429);}
  try{return response({transcript:await transcribeAudio(config,bytes,audioMime(audio.type),language),source:'audio'});}catch(e){return fail(assessmentFailureMessage(e),502);}
 }

 if(path==='assess-part'&&req.method==='POST'){
  const config=await aiConfiguration(E(),db());
  if(!config.GEMINI_API_KEY)return fail('No usable Gemini connection was found in this Cloudflare environment. Ask the owner to test the existing API connection.',503);
  const form=await req.formData();
  let meta:any;
  try{meta=z.object({
   kind:z.enum(['free','daily','weekly','revision']),
   day:z.number().int().min(0).max(1000),
   part:z.union([z.literal(1),z.literal(2),z.literal(3)]),
   bookNumber:z.number().int().min(1).max(240).optional(),
   answers:z.array(z.object({questionId:z.string().min(1).max(120),transcript:z.string().max(8000),duration:z.number().min(3).max(900)})).min(1).max(8)
  }).parse(JSON.parse(String(form.get('meta')||'{}')))}catch{return fail('Invalid speaking part details.',400)}
  const ids=meta.answers.map((a:any)=>a.questionId);
  if(new Set(ids).size!==ids.length)return fail('Each speaking question must be unique.',400);
  const bank=await allQuestions();
  let assigned:Question[];
  if(meta.kind==='free'){
   if(!meta.bookNumber)return fail('Choose a complete speaking book first.',400);
   const book=buildSpeakingBooks(bank,240)[meta.bookNumber-1];
   if(!book||meta.day!==meta.bookNumber)return fail('This book no longer matches your session.',409);
   assigned=book.questions;
  }else{
   const current=await learningContext(uid);
   if(meta.kind==='daily'){
    if(current.stage.type!=='daily'||current.stage.day!==meta.day)return fail('Your daily practice stage is not active.',409);
    assigned=dailyQuestions(meta.day,bank);
   }else{
    const test=current.content.exams.find(e=>e.kind===meta.kind&&e.day===meta.day);
    if(!test)return fail('This exam does not exist.',404);
    const previous=await rows('SELECT kind,milestone,answers FROM tests WHERE user_id=?',uid);
    const gate=weeklyGate(previous,meta.kind,test.number);
    if(!gate.unlocked)return fail(gate.reason,409);
    if(previous.some(t=>t.kind===meta.kind&&t.milestone===meta.day&&passedTest(t)))return fail('You have already passed this exam.',409);
    assigned=stageQuestions(meta.day,meta.kind,bank,current.content,examQuestions);
   }
  }
  const expected=assigned.filter(q=>q.part===meta.part);
  if(meta.kind==='free'){
   const locked=new Set((await activeCooldowns(uid)).map((v:any)=>v.question_id));
   if(expected.some(q=>locked.has(q.id)))return fail('These practice questions are resting for 15 days. Pick a different book.',409);
  }
  if(!expected.length||expected.length!==ids.length||expected.some((q,i)=>q.id!==ids[i]))return fail('Complete every question in this part before requesting the AI assessment.',409);
  const answers:PartAnswer[]=[];
  let total=0;
  for(const [index,item] of meta.answers.entries()){
   const file=form.get('audio_'+index);
   if(!(file instanceof File)||file.size<500||file.size>7*1024*1024)return fail('Every question requires an audio recording smaller than 7 MB.',413);
   const mime=audioMime(file.type);
   if(!/^audio\/(webm|ogg|mp4|wav|mpeg)$/.test(mime))return fail('Unsupported recorded audio format.',400);
   total+=file.size;if(total>16*1024*1024)return fail('Speaking part audio exceeds the 16 MB upload limit. Use shorter or smaller recordings.',413);
   const buffer=await file.arrayBuffer();
   if(!validAudio(buffer))return fail('One of the uploaded recordings is invalid.',400);
   answers.push({question:expected[index],transcript:item.transcript,audio:buffer,mime,duration:item.duration});
  }
  const date=now().slice(0,10),limit=Math.max(1,Math.min(100,Number(E().DAILY_AI_LIMIT)||20));
  const used=await execute('INSERT INTO usage (user_id,date,count) VALUES (?,?,1) ON CONFLICT(user_id,date) DO UPDATE SET count=count+1 WHERE count<?',uid,date,limit);
  if(!used.meta.changes)return fail('Daily AI assessment limit reached. Try again tomorrow.',429);
  try{
   const feedback=await assessSpeakingPart(config,meta.part,answers);
   const scores=['fluency','lexical','grammar','pronunciation'].map(k=>(feedback.criteria as any)[k].score);
   const receipts=await Promise.all(answers.map(async item=>{
    const id=crypto.randomUUID();
    const receipt=await issueReceipt({id,userId:uid,questionId:item.question.id,kind:meta.kind,day:meta.day,recorded:true,reviewed:true,scores,exp:Date.now()+12*3600000},receiptSecret());
    return {id,questionId:item.question.id,receipt};
   }));
   if(meta.kind==='free'){
    const availableAt=cooldownUntil(now());
    for(const item of answers)await execute('INSERT INTO question_cooldowns (user_id,question_id,available_at) VALUES (?,?,?) ON CONFLICT(user_id,question_id) DO UPDATE SET available_at=excluded.available_at',uid,item.question.id,availableAt);
   }
   return response({part:meta.part,feedback,receipts,assessmentCount:1,official:false});
  }catch(error){return fail(assessmentFailureMessage(error),502)}
 }
 if(path==='submit'&&req.method==='POST'){
  const config=await aiConfiguration(E(),db());if(!(config.OPENAI_API_KEY||config.GEMINI_API_KEY))return fail('Connect Google AI Studio in AI connection first. Your recording stays on this device.',503);
  const f=await req.formData();const bank=await allQuestions();const q=bank.find(q=>q.id===String(f.get('questionId')));if(!q)return fail('Question not found.',404);
  const audio=f.get('audio');const typed=String(f.get('typed')||'').slice(0,20000);const transcript=String(f.get('transcript')||'').slice(0,20000);const duration=Math.round(Number(f.get('duration')||0));const kind=String(f.get('kind')||'free'),day=Number(f.get('day')||0);const hasAudio=audio instanceof File;
  if(!['free','daily','weekly','revision'].includes(kind))return fail('Invalid practice type.');
  if(hasAudio){if(audio.size<500||audio.size>8*1024*1024||!/^audio\/(webm|ogg|mp4|wav|mpeg)/.test(audio.type))return fail('Use an audio file of up to 8 MB.');if(!Number.isFinite(duration)||duration<3||duration>900)return fail('Record at least 3 seconds.');}
  else if(/[\u0980-\u09ff]/.test(typed))return fail('Please write your speaking answer in English.');
  else if(typed.trim().length<15)return fail('Record an answer or enter at least 15 characters for text-only feedback.');
  if(kind!=='free'){if(!hasAudio)return fail('A recorded answer is required for this learning stage.',409);const s=await learningContext(uid);if(s.stage.type!==kind||s.stage.day!==day)return fail('Finish your current learning stage first.',409);if(!(kind==='daily'?dailyQuestions(day,bank):stageQuestions(day,kind,bank,s.content,examQuestions)).some(v=>v.id===q.id))return fail('This question is not assigned to this stage.',409);}
  const date=now().slice(0,10),limit=Math.max(1,Math.min(100,Number(E().DAILY_AI_LIMIT)||20));const used=await execute('INSERT INTO usage (user_id,date,count) VALUES (?,?,1) ON CONFLICT(user_id,date) DO UPDATE SET count=count+1 WHERE count<?',uid,date,limit);if(!used.meta.changes)return fail('Daily assessment limit reached. Try again tomorrow.',429);
  try{const bytes=hasAudio?await audio.arrayBuffer():null;if(bytes){const b=new Uint8Array(bytes);const valid=(b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3)||String.fromCharCode(...b.subarray(0,4))==='OggS'||String.fromCharCode(...b.subarray(0,4))==='RIFF'||String.fromCharCode(...b.subarray(4,8))==='ftyp';if(!valid)return fail('This file is not a supported audio recording.');}const feedback=await assess(config,q,hasAudio?transcript:typed,bytes,hasAudio?audio.type:'');if(hasAudio&&((feedback.transcript||transcript).replace(/\[unclear\]/gi,'').trim().length<5))return fail('No clear spoken answer was detected. Try recording again in a quieter place.',422);const id=crypto.randomUUID();
   const receipt=await issueReceipt({id,userId:uid,questionId:q.id,kind,day,recorded:hasAudio,reviewed:false,scores:['fluency','lexical','grammar','pronunciation'].map(k=>(feedback.criteria as any)[k].score),exp:Date.now()+12*3600000},receiptSecret());
   return response({id,receipt,feedback,audioSaved:false,textOnly:!hasAudio,storage:'session-only'});
  }catch(e){return fail(assessmentFailureMessage(e),502);}
 }
 if(req.method==='POST'&&path==='record')return fail('Permanent recording storage is disabled. Submit your audio directly for temporary assessment.',410);
 if(req.method==='POST'&&path==='evaluate')return fail('New feedback is temporary. Record or type this answer again to assess it in this tab.',410);
 if(req.method==='POST'&&path==='review-attempt'){
  const body:any=await req.json();const receipt=await proof(body?.receipt,uid);if(!receipt)return fail('Assessment proof expired or is invalid. Assess this answer again.',409);
  return response({ok:true,receipt:await issueReceipt({...receipt,reviewed:true},receiptSecret())});
 }
 if(req.method==='POST'&&path==='message'){const b=z.object({subject:z.string().min(3).max(160),body:z.string().min(10).max(5000)}).parse(await req.json());if(/[\u0980-\u09ff]/.test(b.subject+b.body))return fail('Please write your message in English.');const recent=await rows('SELECT id FROM messages WHERE user_id=? AND created_at>?',uid,new Date(Date.now()-3600000).toISOString());if(recent.length>=5)return fail('You can send up to five support messages per hour.',429);await execute("INSERT INTO messages (id,user_id,subject,body,reply,status,created_at) VALUES (?,?,?,?,'','open',?)",crypto.randomUUID(),uid,b.subject,b.body,now());return response({ok:true});}
 if(req.method==='POST'&&path==='practice-result'){
  const b=z.object({receipts:z.array(z.string().max(4000)).min(3).max(20),questionIds:z.array(z.string().max(100)).min(3).max(20),bookNumber:z.number().int().min(1).max(240).optional(),bookMode:z.enum(['practice','exam']).optional()}).parse(await req.json());
  const receipts=await Promise.all(b.receipts.map(v=>proof(v,uid)));if(receipts.some(r=>!r||!r.recorded||!r.reviewed))return fail('Record, assess and review every test answer first.',409);
  const valid=receipts as PracticeReceipt[];if(new Set(b.questionIds).size!==b.questionIds.length||new Set(valid.map(r=>r.questionId)).size!==b.questionIds.length||valid.length!==b.questionIds.length||valid.some(r=>!b.questionIds.includes(r.questionId)))return fail('Each distinct test question needs its own reviewed answer.',409);
  const bank=await allQuestions();if(![1,2,3].every(p=>b.questionIds.some(id=>bank.find(q=>q.id===id)?.part===p)))return fail('A speaking test must include all three parts.',409);
  const threshold=(await readContent(db())).passBand;
  const result=summarizeSpeakingParts(valid,bank.filter(q=>b.questionIds.includes(q.id)),threshold);
  if(!b.bookNumber)return response(result);
  const book=buildSpeakingBooks(bank,240)[b.bookNumber-1];
  if(!book||book.questions.length!==b.questionIds.length||book.questions.some((q,i)=>q.id!==b.questionIds[i]))return fail('This speaking book has changed. Restart with the current question collection.',409);
  const partScores=result.partScores;
  const mode=b.bookMode||'practice';
  await execute('INSERT INTO tests (id,user_id,milestone,kind,answers,completed_at) VALUES (?,?,?,?,?,?)',
   crypto.randomUUID(),uid,b.bookNumber,mode==='exam'?'book-exam':'book',
   JSON.stringify({bookId:book.id,topic:book.topic,practiceBand:result.band,partScores,criteria:result.criteria,passed:result.passed,mode}),now());
  return response({...result,partScores,bookNumber:b.bookNumber});
 }
 if(req.method==='POST'&&path==='complete-stage'){
  const body=z.object({receipts:z.array(z.string().max(4000)).min(1).max(30)}).parse(await req.json());
  const receipts=await Promise.all(body.receipts.map(v=>proof(v,uid)));
  if(receipts.some(r=>!r||!r.recorded||!r.reviewed))return fail('Assess all three speaking parts before completing the exam.',409);
  const valid=receipts as PracticeReceipt[],kind=valid[0].kind,day=valid[0].day;
  if(!['daily','weekly','revision'].includes(kind)||valid.some(r=>r.kind!==kind||r.day!==day))return fail('Assessment receipts do not belong to the same session.',409);
  const context=await learningContext(uid),bank=await allQuestions();
  let assigned:Question[];
  if(kind==='daily'){
   if(context.stage.type!=='daily'||context.stage.day!==day)return fail('This daily stage is not active.',409);
   assigned=dailyQuestions(day,bank);
  }else{
   const exam=context.content.exams.find(t=>t.kind===kind&&t.day===day);
   if(!exam)return fail('This exam is unavailable.',409);
   const previous=await rows('SELECT kind,milestone,answers FROM tests WHERE user_id=?',uid);
   const gate=weeklyGate(previous,kind as 'weekly'|'revision',exam.number);
   if(!gate.unlocked)return fail(gate.reason,409);
   if(previous.some(t=>t.kind===kind&&t.milestone===day&&passedTest(t)))return fail('This exam is already passed.',409);
   assigned=stageQuestions(day,kind,bank,context.content,examQuestions);
  }
  if(valid.length!==assigned.length||new Set(valid.map(r=>r.questionId)).size!==assigned.length||!assigned.every(q=>valid.some(r=>r.questionId===q.id)))return fail('All assigned answers must have completed Part assessments.',409);
  const threshold=kind==='daily'?context.content.passBand:WEEKLY_PASS_BAND;
  const result=summarizeSpeakingParts(valid,assigned,threshold);
  const summary={passed:result.passed,practiceBand:result.band,partScores:result.partScores};
  if(kind==='daily'){
   await execute('INSERT OR IGNORE INTO days (user_id,day,completed_at) VALUES (?,?,?)',uid,day,now());
   await execute('INSERT INTO tests (id,user_id,milestone,kind,answers,completed_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),uid,day,'daily-score',JSON.stringify(summary),now());
  }else{
   // Failed assessments also keep their part scores, but never unlock the next exam.
   await execute('INSERT INTO tests (id,user_id,milestone,kind,answers,completed_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),uid,day,kind,JSON.stringify(summary),now());
  }
  return response({...await state(user),stageResult:result});
 }
 if(req.method==='POST'&&path==='save')return fail('New practice notes and feedback stay in this tab only. Use Download to keep a personal copy.',410);
 if(req.method==='POST'&&path==='profile'){
  const p=z.object({name:z.string().min(1).max(100),phone:z.string().trim().max(25).refine(v=>v===''||/^\+?[0-9][0-9 -]{6,23}$/.test(v),'Enter a valid phone number.').optional().default(''),target:z.enum(['5.0','5.5','6.0','6.5','7.0','7.5','8.0','8.5','9.0']),track:z.union([z.literal(90),z.literal(120),z.literal(180),z.literal(210)]),examDate:z.string().max(10)}).parse(await req.json());
  await execute('UPDATE profiles SET name=?,phone=?,target=?,track=?,exam_date=? WHERE user_id=?',p.name,p.phone,p.target,p.track,p.examDate,uid);return response({ok:true});
 }
 if(req.method==='POST'&&path==='delete-attempt'){
  const {id}=z.object({id:z.string().uuid()}).parse(await req.json());const a=(await rows('SELECT * FROM attempts WHERE id=? AND user_id=?',id,uid))[0];if(!a)return fail('Recording not found.',404);if(a.audio_key)await E().BUCKET?.delete(a.audio_key);await execute('DELETE FROM attempts WHERE id=? AND user_id=?',id,uid);return response({ok:true});
 }
 if(path.startsWith('admin')){
  if(!admin)return fail('Administrator access is required. The owner must configure the administrator email first.',403);
  if(req.method==='GET'&&path==='admin/questions'){const overrides=await rows('SELECT * FROM question_overrides');const map=new Map(questions.map(q=>[q.id,{...q,archived:false}]));for(const row of overrides){const q=parse(row.data);if(q)map.set(row.id,{...q,archived:!!row.archived});}return response({questions:[...map.values()]});}
  if(req.method==='GET'&&path==='admin/learner'){const target=new URL(req.url).searchParams.get('userId');if(!target||target.length>200)return fail('Choose a learner.');const profile=(await rows('SELECT * FROM profiles WHERE user_id=?',target))[0];if(!profile)return fail('Learner not found.',404);return response({profile,attempts:(await rows('SELECT * FROM attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 100',target)).map(a=>({...a,feedback:parse(a.feedback)})),days:await rows('SELECT * FROM days WHERE user_id=?',target),tests:(await rows('SELECT * FROM tests WHERE user_id=? ORDER BY completed_at DESC',target)).map(t=>({...t,details:parse(t.answers)}))});}
  if(req.method==='GET')return response({administratorEmail:user.email,users:await rows('SELECT p.user_id,p.name,p.target,p.track,p.created_at,a.email,a.status FROM profiles p LEFT JOIN user_access a ON a.user_id=p.user_id'),messages:await rows('SELECT m.*,p.name FROM messages m LEFT JOIN profiles p ON p.user_id=m.user_id ORDER BY m.created_at DESC LIMIT 200'),activity:await rows('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100'),statistics:(await rows('SELECT COUNT(*) AS attempts, SUM(duration) AS seconds FROM attempts'))[0]});
  const body:any=await req.json();
  const audit=async(action:string,detail:string)=>execute('INSERT INTO audit VALUES (?,?,?,?,?)',crypto.randomUUID(),uid,action,detail,now());
  if(path==='admin/content'){
   const content=contentSchema.parse(body.content);const current=(await rows("SELECT value FROM settings WHERE key='site_content_revision'"))[0];if(Number(body.expectedRevision)!==Number(current?.value||0))return fail('Content changed in another session. Reload before publishing.',409);
   const bank=await allQuestions();for(const e of content.exams)if(e.questionIds.length&&(![1,2,3].every(p=>e.questionIds.some(id=>bank.find(q=>q.id===id)?.part===p))||e.questionIds.some(id=>!bank.some(q=>q.id===id))))return fail('Each custom exam must contain valid questions from all three speaking parts.');
   const next=Number(current?.value||0)+1;await db().batch([db().prepare("INSERT INTO settings (key,value) VALUES ('site_content',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(content)),db().prepare("INSERT INTO settings (key,value) VALUES ('site_content_revision',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(next))]);await audit('content.publish','Website content revision '+next);return response({ok:true,revision:next});
  }
  if(path==='admin/topic'){
   const b=z.object({action:z.enum(['add','rename','delete']),name:z.string().min(1).max(80),replacement:z.string().max(80).optional()}).parse(body);if(/[\u0980-\u09ff]/.test(b.name+(b.replacement||'')))return fail('Topic names must be in English.');const content=await readContent(db()),bank=await allQuestions();if(b.action==='add'){if(content.topics.some(t=>t.toLowerCase()===b.name.toLowerCase()))return fail('This topic already exists.');content.topics.push(b.name);}else{if(!content.topics.includes(b.name))return fail('Topic not found.',404);if(b.action==='rename'&&(!b.replacement?.trim()||content.topics.includes(b.replacement)))return fail('Choose a unique topic name.');if(b.action==='delete'&&content.exams.some(e=>e.questionIds.some(id=>bank.find(q=>q.id===id)?.topic===b.name)))return fail('Update custom exam questions before deleting this topic.');if(b.action==='delete'&&!bank.some(q=>q.topic!==b.name&&[1,2,3].every(p=>bank.some(v=>v.topic===q.topic&&v.part===p))))return fail('Keep at least one complete speaking topic.');for(const q of bank.filter(q=>q.topic===b.name)){const updated={...q,topic:b.action==='rename'?b.replacement!:q.topic};await execute('INSERT INTO question_overrides (id,data,archived) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,archived=excluded.archived',q.id,JSON.stringify(updated),b.action==='delete'?1:0);}content.topics=content.topics.flatMap(t=>t!==b.name?[t]:b.action==='rename'?[b.replacement!]:[]);}
   await execute("INSERT INTO settings (key,value) VALUES ('site_content',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify(content));await execute("INSERT INTO settings (key,value) VALUES ('site_content_revision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1");await audit('topic.'+b.action,b.name);return response({ok:true});
  }
  if(path==='admin/user'){
   const b=z.object({userId:z.string().min(1).max(200),action:z.enum(['ban','unban','delete-user','override-pass']),reason:z.string().min(8).max(1000),day:z.number().int().min(1).max(210).optional(),kind:z.enum(['daily','weekly','revision']).optional()}).parse(body);const target=(await rows('SELECT p.*,a.email FROM profiles p LEFT JOIN user_access a ON a.user_id=p.user_id WHERE p.user_id=?',b.userId))[0];if(!target)return fail('Learner not found.',404);if(b.userId===uid||target.email?.toLowerCase()===E().ADMIN_EMAIL?.toLowerCase())return fail('The owner account is protected from learner actions.',409);
   if(b.action==='override-pass'){if(!b.day||!b.kind||b.day>target.track)return fail('Choose a valid learning milestone.');if(b.kind==='daily')await execute('INSERT OR IGNORE INTO days (user_id,day,completed_at) VALUES (?,?,?)',b.userId,b.day,now());else{const content=await readContent(db());if(!content.exams.some(e=>e.kind===b.kind&&e.day===b.day))return fail('Choose an existing exam milestone.');await execute('INSERT INTO tests (id,user_id,milestone,kind,answers,completed_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),b.userId,b.day,b.kind,JSON.stringify({override:true,practiceBand:null,reason:b.reason,actor:uid}),now());}}
   else{const status=b.action==='ban'?'banned':b.action==='unban'?'active':'deleted';const old=(await rows('SELECT status FROM user_access WHERE user_id=?',b.userId))[0];if(old?.status==='deleted')return fail('A deleted account cannot be restored by unbanning.',409);if(b.action==='delete-user'){const recordings=await rows('SELECT audio_key FROM attempts WHERE user_id=?',b.userId);for(const a of recordings)if(a.audio_key)await E().BUCKET?.delete(a.audio_key);for(const table of ['attempts','saved','days','tests','messages','usage','profiles'])await execute(`DELETE FROM ${table} WHERE user_id=?`,b.userId);}await execute('INSERT INTO user_access (user_id,email,status,reason,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated_at=excluded.updated_at',b.userId,target.email||'',status,b.reason,now());}
   await audit('user.'+b.action,JSON.stringify({userId:b.userId,reason:b.reason,day:b.day,kind:b.kind}));return response({ok:true});
  }
  if(path==='admin/message'){const b=z.object({id:z.string().uuid(),reply:z.string().min(1).max(5000),status:z.enum(['open','answered','closed'])}).parse(body);if(/[\u0980-\u09ff]/.test(b.reply))return fail('Reply in English.');const m=(await rows('SELECT id FROM messages WHERE id=?',b.id))[0];if(!m)return fail('Message not found.',404);await execute('UPDATE messages SET reply=?,status=? WHERE id=?',b.reply,b.status,b.id);await audit('message.reply',b.id);return response({ok:true});}
  if(path==='admin/question'){
   const q=z.object({id:z.string().min(1).max(100),text:z.string().min(8).max(1000),part:z.number().int().min(1).max(3),topic:z.string().min(1).max(100),difficulty:z.string().max(50),duration:z.number().int().min(15).max(180),objective:z.string().max(1000),cue:z.array(z.string()).optional(),related:z.array(z.string())}).parse(body.question);if(body.archived&&(await readContent(db())).exams.some(e=>e.questionIds.includes(q.id)))return fail('Remove this question from custom exams before archiving it.');if(/[\u0980-\u09ff]/.test(q.text+q.objective+q.topic+(q.cue||[]).join(' ')))return fail('Questions must be written in English.');
   await execute('INSERT INTO question_overrides (id,data,archived) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,archived=excluded.archived',q.id,JSON.stringify(q),body.archived?1:0);
   await execute('INSERT INTO audit VALUES (?,?,?,?,?)',crypto.randomUUID(),uid,'question.update',q.id,now());return response({ok:true});
  }
 }
 return fail('Route not found.',404);
}
export async function GET(req:Request){try{return await handler(req)}catch(e){console.error('Speak Station GET failed',e instanceof Error?e.name:'Unknown');return fail('Your workspace could not load. Please try again.',503);}}
export async function POST(req:Request){try{return await handler(req)}catch(e){if(e instanceof z.ZodError)return fail('Please check the submitted information.');console.error('Speak Station POST failed',e instanceof Error?e.name:'Unknown');return fail('This action could not finish. Please try again.',503);}}
