import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {questions,byId,dailyQuestions,examQuestions,type Question} from '../../lib/questions';
import {nextStage,streak} from '../../lib/learning';
import {assess} from '../../lib/assessment';
import {transcribeAudio,validAudio,audioMime} from '../../lib/transcription';
import {z} from 'zod';
import {assessmentFailureMessage,ProviderFailure} from '../../lib/provider-errors';
import {aiConfiguration,connectionStatus,encryptCredential,verifyGemini} from '../../lib/integration';
export const dynamic='force-dynamic';
const E=()=>env as any;
const response=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(msg:string,status=400)=>response({error:msg},status);
const now=()=>new Date().toISOString();
function db(){if(!E().DB)throw new Error('STORAGE_UNAVAILABLE');return E().DB as D1Database;}
const parse=(s:any,fallback:any=null)=>{try{return JSON.parse(s)}catch{return fallback}};
async function rows(sql:string,...args:any[]){return (await db().prepare(sql).bind(...args).all()).results as any[];}
async function execute(sql:string,...args:any[]){return db().prepare(sql).bind(...args).run();}
async function allQuestions(){const changes=await rows('SELECT * FROM question_overrides');const map=new Map(questions.map(q=>[q.id,q]));for(const c of changes){if(c.archived)map.delete(c.id);else map.set(c.id,parse(c.data));}return [...map.values()];}
async function state(user:any){
 const connection=await connectionStatus(E(),db());
 if(!user)return {user:null,profile:null,attempts:[],saved:[],completed:[],tests:[],streak:0,stage:{type:'daily',day:1},aiConfigured:connection.configured,connection,storageReady:!!E().DB,isAdmin:false};
 await execute('INSERT OR IGNORE INTO profiles (user_id,name,track,created_at) VALUES (?,?,?,?)',user.userId,user.displayName,210,now());
 const [profiles,attempts,saved,days,tests]=await Promise.all([rows('SELECT * FROM profiles WHERE user_id=?',user.userId),rows('SELECT * FROM attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 500',user.userId),rows('SELECT * FROM saved WHERE user_id=?',user.userId),rows('SELECT * FROM days WHERE user_id=? ORDER BY day',user.userId),rows('SELECT * FROM tests WHERE user_id=?',user.userId)]);
 const complete=days.map(d=>d.day);
 return {user:{name:user.displayName,email:user.email},profile:profiles[0],attempts:attempts.map(a=>({...a,feedback:parse(a.feedback)})),saved:saved.map(s=>({...s,data:parse(s.data)})),completed:complete,tests,streak:streak(attempts.map(a=>a.created_at)),stage:nextStage(complete,tests,profiles[0].track),aiConfigured:connection.configured,connection,storageReady:true,isAdmin:!!E().ADMIN_EMAIL&&user.email.toLowerCase()===E().ADMIN_EMAIL.toLowerCase()};
}
async function handler(req:Request){
 const path=new URL(req.url).pathname.replace(/^\/api\//,'');const user=await getChatGPTUser();
 if(req.method==='GET'&&path==='state')return response(await state(user));
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
  const length=Number(req.headers.get('content-length')||0);if(length>9*1024*1024)return fail('Audio files must be smaller than 8 MB.',413);
 }
 if(req.method==='GET'&&path.startsWith('audio/')){
  const id=path.slice(6);const a=(await rows('SELECT * FROM attempts WHERE id=? AND user_id=?',id,uid))[0];if(!a)return fail('Recording not found.',404);
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
 if(path==='submit'&&req.method==='POST'){
  const config=await aiConfiguration(E(),db());if(!(config.OPENAI_API_KEY||config.GEMINI_API_KEY))return fail('Connect Google AI Studio in AI connection first. Your recording stays on this device.',503);
  const f=await req.formData();const q=(await allQuestions()).find(q=>q.id===String(f.get('questionId')));if(!q)return fail('Question not found.',404);
  const audio=f.get('audio');const typed=String(f.get('typed')||'').slice(0,20000);const transcript=String(f.get('transcript')||'').slice(0,20000);const duration=Math.round(Number(f.get('duration')||0));const kind=String(f.get('kind')||'free'),day=Number(f.get('day')||0);const hasAudio=audio instanceof File;
  if(!['free','daily','weekly','revision'].includes(kind))return fail('Invalid practice type.');
  if(hasAudio){if(audio.size<500||audio.size>8*1024*1024||!/^audio\/(webm|ogg|mp4|wav|mpeg)/.test(audio.type))return fail('Use an audio file of up to 8 MB.');if(!Number.isFinite(duration)||duration<3||duration>900)return fail('Record at least 3 seconds.');}
  else if(typed.trim().length<15)return fail('Record an answer or enter at least 15 characters for text-only feedback.');
  if(kind!=='free'){if(!hasAudio)return fail('A recorded answer is required for this learning stage.',409);const s=await state(user);if(s.stage.type!==kind||s.stage.day!==day)return fail('Finish your current learning stage first.',409);const active=await allQuestions();if(!(kind==='daily'?dailyQuestions(day,active):examQuestions(day,active)).some(v=>v.id===q.id))return fail('This question is not assigned to this stage.',409);}
  const date=now().slice(0,10),limit=Math.max(1,Math.min(100,Number(E().DAILY_AI_LIMIT)||20));const used=await execute('INSERT INTO usage (user_id,date,count) VALUES (?,?,1) ON CONFLICT(user_id,date) DO UPDATE SET count=count+1 WHERE count<?',uid,date,limit);if(!used.meta.changes)return fail('Daily assessment limit reached. Try again tomorrow.',429);
  try{const bytes=hasAudio?await audio.arrayBuffer():null;if(bytes){const b=new Uint8Array(bytes);const valid=(b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3)||String.fromCharCode(...b.subarray(0,4))==='OggS'||String.fromCharCode(...b.subarray(0,4))==='RIFF'||String.fromCharCode(...b.subarray(4,8))==='ftyp';if(!valid)return fail('This file is not a supported audio recording.');}const feedback=await assess(config,q,hasAudio?transcript:typed,bytes,hasAudio?audio.type:'');if(hasAudio&&((feedback.transcript||transcript).replace(/\[unclear\]/gi,'').trim().length<5))return fail('No clear spoken answer was detected. Try recording again in a quieter place.',422);const id=crypto.randomUUID();const keep=f.get('keepAudio')==='true'&&hasAudio;const key=keep?`${uid}/${id}`:'';if(keep){if(!E().BUCKET)return fail('Optional audio storage is unavailable.',503);await E().BUCKET.put(key,bytes,{httpMetadata:{contentType:audio.type}});}
   await execute("INSERT INTO attempts (id,user_id,question_id,kind,day,status,duration,audio_key,mime,transcript,feedback,created_at) VALUES (?,?,?,?,?,'evaluated',?,?,?,?,?,?)",id,uid,q.id,kind,day,hasAudio?duration:0,key,hasAudio?audio.type:'text/plain',hasAudio?(feedback.transcript||transcript):typed,JSON.stringify(feedback),now());return response({id,feedback,audioSaved:keep,textOnly:!hasAudio});
  }catch(e){return fail(assessmentFailureMessage(e),502);}
 }
 if(req.method==='POST'&&path==='record'){
  if(!E().BUCKET)return fail('Recording storage is not available yet.',503);
  const f=await req.formData();const audio=f.get('audio');const id=String(f.get('questionId'));const q=(await allQuestions()).find(q=>q.id===id);if(!q)return fail('Question not found.',404);
  if(!(audio instanceof File)||audio.size<500||audio.size>8*1024*1024||!/^audio\/(webm|ogg|mp4|wav|mpeg)/.test(audio.type))return fail('Upload a valid audio recording (up to 8 MB).');
  const duration=Math.round(Number(f.get('duration')));if(!Number.isFinite(duration)||duration<3||duration>900)return fail('Please record between 3 seconds and 15 minutes.');
  const transcript=String(f.get('transcript')||'').slice(0,20000);const kind=String(f.get('kind')||'free');const day=Number(f.get('day')||0);
  if(!['free','daily','weekly','revision'].includes(kind))return fail('Invalid practice type.');
  if(kind!=='free'){const s=await state(user);if(s.stage.type!==kind||s.stage.day!==day)return fail('Complete the current learning stage first.',409);if(!(kind==='daily'?dailyQuestions(day,await allQuestions()):examQuestions(day,await allQuestions())).some(v=>v.id===id))return fail('This question is not assigned to the current stage.',409);}
  const aid=crypto.randomUUID(),key=`${uid}/${aid}`;const data=await audio.arrayBuffer();const bytes=new Uint8Array(data);
  const valid=(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)||(String.fromCharCode(...bytes.subarray(0,4))==='OggS')||(String.fromCharCode(...bytes.subarray(0,4))==='RIFF')||(String.fromCharCode(...bytes.subarray(4,8))==='ftyp');
  if(!valid)return fail('The file does not contain a supported audio container.');
  await E().BUCKET.put(key,data,{httpMetadata:{contentType:audio.type}});
  try{await execute('INSERT INTO attempts (id,user_id,question_id,kind,day,duration,audio_key,mime,transcript,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',aid,uid,id,kind,day,duration,key,audio.type,transcript,now());}catch(e){await E().BUCKET.delete(key);throw e;}
  return response({id:aid});
 }
 if(req.method==='POST'&&path==='evaluate'){
  const config=await aiConfiguration(E(),db());if(!(config.OPENAI_API_KEY||config.GEMINI_API_KEY))return fail('AI feedback is not connected yet. Your recording is saved. You can retry after an API is connected.',503);
  const {id}=z.object({id:z.string().uuid()}).parse(await req.json());const a=(await rows('SELECT * FROM attempts WHERE id=? AND user_id=?',id,uid))[0];if(!a)return fail('Answer not found.',404);
  if(a.status==='evaluated')return response({feedback:parse(a.feedback)});
  const date=now().slice(0,10);const limit=Math.max(1,Math.min(100,Number(E().DAILY_AI_LIMIT)||20));
  const used=await execute('INSERT INTO usage (user_id,date,count) VALUES (?,?,1) ON CONFLICT(user_id,date) DO UPDATE SET count=count+1 WHERE count<?',uid,date,limit);if(!used.meta.changes)return fail('Daily AI limit reached. Your recording remains saved.',429);
  await execute("UPDATE attempts SET status='failed' WHERE id=? AND user_id=? AND status='evaluating' AND (evaluating_at IS NULL OR evaluating_at<?)",id,uid,new Date(Date.now()-120000).toISOString());
  const claim=await execute("UPDATE attempts SET status='evaluating',evaluating_at=? WHERE id=? AND user_id=? AND status IN ('recorded','failed')",now(),id,uid);if(!claim.meta.changes)return fail('This answer is already being evaluated.',409);
  try{
   const q=(await allQuestions()).find(q=>q.id===a.question_id);if(!q)throw new Error('QUESTION_UNAVAILABLE');const audio=await E().BUCKET.get(a.audio_key);if(!audio)throw new Error('AUDIO_UNAVAILABLE');
   const feedback=await assess(config,q,a.transcript,await audio.arrayBuffer(),a.mime);
   await execute("UPDATE attempts SET status='evaluated',feedback=? WHERE id=? AND user_id=?",JSON.stringify(feedback),id,uid);
   return response({feedback});
  }catch(e){await execute("UPDATE attempts SET status='failed' WHERE id=? AND user_id=?",id,uid);return fail(assessmentFailureMessage(e),502);}
 }
 if(req.method==='POST'&&path==='review-attempt'){
  const {id}=z.object({id:z.string().uuid()}).parse(await req.json());const a=(await rows("SELECT * FROM attempts WHERE id=? AND user_id=? AND status='evaluated'",id,uid))[0];if(!a)return fail('Valid feedback is required before marking this answer reviewed.',409);
  await execute('UPDATE attempts SET reviewed=1 WHERE id=? AND user_id=?',id,uid);return response({ok:true});
 }
 if(req.method==='POST'&&path==='complete-stage'){
  const s=await state(user),stage=s.stage;const activeBank=await allQuestions();if(stage.type==='complete')return fail('Track already complete.');const expected=stage.type==='daily'?dailyQuestions(stage.day,activeBank):examQuestions(stage.day,activeBank);
  const answers=await rows("SELECT * FROM attempts WHERE user_id=? AND kind=? AND day=? AND status='evaluated' AND reviewed=1",uid,stage.type,stage.day);
  if(!expected.every(q=>answers.some(a=>a.question_id===q.id)))return fail('Record, evaluate and review every assigned answer before completing this stage.',409);
  if(stage.type==='daily')await execute('INSERT OR IGNORE INTO days (user_id,day,completed_at) VALUES (?,?,?)',uid,stage.day,now());
  else await execute('INSERT INTO tests (id,user_id,milestone,kind,answers,completed_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),uid,stage.day,stage.type,JSON.stringify(answers.map(a=>a.id)),now());
  return response(await state(user));
 }
 if(req.method==='POST'&&path==='save'){
  const data=z.object({type:z.enum(['bookmark','vocabulary','correction']),key:z.string().min(1).max(1000),data:z.unknown(),remove:z.boolean().optional(),reviewed:z.boolean().optional()}).parse(await req.json());
  if(data.remove)await execute('DELETE FROM saved WHERE user_id=? AND type=? AND key=?',uid,data.type,data.key);
  else await execute('INSERT INTO saved (user_id,type,key,data,reviewed) VALUES (?,?,?,?,?) ON CONFLICT(user_id,type,key) DO UPDATE SET data=excluded.data,reviewed=excluded.reviewed',uid,data.type,data.key,JSON.stringify(data.data).slice(0,20000),data.reviewed?1:0);
  return response({ok:true});
 }
 if(req.method==='POST'&&path==='profile'){
  const p=z.object({name:z.string().min(1).max(100),target:z.enum(['5.0','5.5','6.0','6.5','7.0','7.5','8.0','8.5','9.0']),track:z.union([z.literal(90),z.literal(120),z.literal(180),z.literal(210)]),examDate:z.string().max(10)}).parse(await req.json());
  await execute('UPDATE profiles SET name=?,target=?,track=?,exam_date=? WHERE user_id=?',p.name,p.target,p.track,p.examDate,uid);return response({ok:true});
 }
 if(req.method==='POST'&&path==='delete-attempt'){
  const {id}=z.object({id:z.string().uuid()}).parse(await req.json());const a=(await rows('SELECT * FROM attempts WHERE id=? AND user_id=?',id,uid))[0];if(!a)return fail('Recording not found.',404);await E().BUCKET.delete(a.audio_key);await execute('DELETE FROM attempts WHERE id=? AND user_id=?',id,uid);return response({ok:true});
 }
 if(path.startsWith('admin')){
  if(!admin)return fail('Administrator access is required. The owner must configure the administrator email first.',403);
  if(req.method==='GET')return response({users:await rows('SELECT user_id,name,target,track,created_at FROM profiles'),activity:await rows('SELECT * FROM audit ORDER BY created_at DESC LIMIT 50'),statistics:(await rows('SELECT COUNT(*) AS attempts, SUM(duration) AS seconds FROM attempts'))[0],usage:await rows('SELECT date,SUM(count) AS requests FROM usage GROUP BY date ORDER BY date DESC LIMIT 30')});
  const body:any=await req.json();
  if(path==='admin/question'){
   const q=z.object({id:z.string().min(1).max(100),text:z.string().min(8).max(1000),part:z.number().int().min(1).max(3),topic:z.string().min(1).max(100),difficulty:z.string().max(50),duration:z.number().int().min(15).max(180),objective:z.string().max(1000),cue:z.array(z.string()).optional(),related:z.array(z.string())}).parse(body.question);
   await execute('INSERT INTO question_overrides (id,data,archived) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,archived=excluded.archived',q.id,JSON.stringify(q),body.archived?1:0);
   await execute('INSERT INTO audit VALUES (?,?,?,?,?)',crypto.randomUUID(),uid,'question.update',q.id,now());return response({ok:true});
  }
 }
 return fail('Route not found.',404);
}
export async function GET(req:Request){try{return await handler(req)}catch(e){console.error('Speak Station GET failed',e instanceof Error?e.name:'Unknown');return fail('Your workspace could not load. Please try again.',503);}}
export async function POST(req:Request){try{return await handler(req)}catch(e){if(e instanceof z.ZodError)return fail('Please check the submitted information.');console.error('Speak Station POST failed',e instanceof Error?e.name:'Unknown');return fail('This action could not finish. Please try again.',503);}}
