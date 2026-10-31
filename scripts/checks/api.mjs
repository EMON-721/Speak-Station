import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
// Exercise the actual route handler in-process with isolated SQLite/R2 adapters.
// Only platform identity, storage and transport boundaries are replaced. No live AI calls.
const directory=path.resolve('.sites-runtime/api-check');fs.mkdirSync(directory,{recursive:true});
const compile=(name,input)=>{const out=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;const p=path.join(directory,name+'.mjs');fs.writeFileSync(p,out);return pathToFileURL(p).href};
const pack=compile('topic-pack',fs.readFileSync('app/lib/topic-pack.ts','utf8'));const q=compile('questions',fs.readFileSync('app/lib/questions.ts','utf8').replace("'./topic-pack'",JSON.stringify(pack)));
const providerErrors=compile('provider-errors',fs.readFileSync('app/lib/provider-errors.ts','utf8'));
const integration=compile('integration',fs.readFileSync('app/lib/integration.ts','utf8').replace("'./provider-errors'",JSON.stringify(providerErrors)));
const learning=compile('learning',fs.readFileSync('app/lib/learning.ts','utf8'));
const transcription=compile('transcription',fs.readFileSync('app/lib/transcription.ts','utf8').replace("'./provider-errors'",JSON.stringify(providerErrors)));
const sqlite=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const DB = {
 prepare(sql) {
  return {
   bind(...args) {
    const statement = sqlite.prepare(sql);
    return {
     all: async () => ({results: statement.all(...args)}),
     run: async () => ({meta: {changes: Number(statement.run(...args).changes)}})
    };
   }
  };
 }
};
const objects=new Map();const BUCKET={async put(key,bytes){objects.set(key,new Uint8Array(bytes))},async get(key){const bytes=objects.get(key);return bytes?{body:bytes,arrayBuffer:async()=>bytes.buffer}:null},async delete(key){objects.delete(key)}};
globalThis.__speakTest={env:{DB,BUCKET},user:null};
let code=fs.readFileSync('app/api/[...path]/route.ts','utf8').replace("import {env} from 'cloudflare:workers';","const env=globalThis.__speakTest.env;").replace("import {getChatGPTUser} from '../../chatgpt-auth';","const getChatGPTUser=async()=>globalThis.__speakTest.user;").replace("'../../lib/questions'",JSON.stringify(q)).replace("'../../lib/learning'",JSON.stringify(learning)).replace("'../../lib/integration'",JSON.stringify(integration)).replace("'../../lib/provider-errors'",JSON.stringify(providerErrors)).replace("'../../lib/transcription'",JSON.stringify(transcription)).replace("import {assess} from '../../lib/assessment';","const assess=async(...args)=>{if(globalThis.__speakTest.assess)return globalThis.__speakTest.assess(...args);throw new Error('Unexpected live AI request in API tests')};");
const route=await import(compile('route',code));
const uid='synthetic-'+crypto.randomUUID(),user={userId:uid,email:'qa@example.test',displayName:'Synthetic QA learner'};
const request=async(p,body,identity=user,origin='https://speak.test')=>{globalThis.__speakTest.user=identity;const req=new Request('https://speak.test/api/'+p,{method:body?'POST':'GET',headers:{...(body?{Origin:origin}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});const r=await route[body?'POST':'GET'](req);return {status:r.status,value:r.headers.get('content-type')?.includes('json')?await r.json():await r.arrayBuffer()}};
assert.equal((await request('state',null,null)).value.user,null);
assert.equal((await request('save',{type:'bookmark',key:'x',data:{}},null)).status,401);
assert.deepEqual((await request('state')).value.stage,{type:'daily',day:1});
assert.equal((await request('questions')).value.questions.length,3060);
assert.equal((await request('admin/overview')).status,403);
assert.equal((await request('complete-stage',{})).status,409);
assert.equal((await request('save',{type:'bookmark',key:'P1-01-01',data:{text:'Synthetic test'}})).status,200);
assert.equal((await request('state')).value.saved[0].key,'P1-01-01');
const other={...user,userId:uid+'-other'};assert.deepEqual((await request('state',null,other)).value.saved,[]);
assert.equal((await request('profile',{name:'Synthetic QA learner',target:'8.0',track:90,examDate:'2027-05-01'})).status,200);
assert.equal((await request('state')).value.profile.track,90);
const wav=new Uint8Array(44+8000*2*4);const dv=new DataView(wav.buffer);const text=(at,t)=>wav.set(new TextEncoder().encode(t),at);text(0,'RIFF');dv.setUint32(4,wav.length-8,true);text(8,'WAVEfmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,8000,true);dv.setUint32(28,16000,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);text(36,'data');dv.setUint32(40,wav.length-44,true);
const form=day=>{const f=new FormData();for(const [k,v] of Object.entries({questionId:'P1-01-01',kind:'daily',day:String(day),duration:'4',transcript:'Synthetic test only'}))f.append(k,v);f.append('audio',new Blob([wav],{type:'audio/wav'}),'synthetic.wav');return f};
assert.equal((await request('record',form(2))).status,409);
const record=await request('record',form(1));assert.equal(record.status,200,JSON.stringify(record.value));const id=record.value.id;
assert.equal((await request('audio/'+id)).status,200);
assert.equal((await request('audio/'+id,null,other)).status,404);
assert.equal((await request('evaluate',{id})).status,503);
assert.equal((await request('review-attempt',{id})).status,409);
assert.equal((await request('complete-stage',{})).status,409);
assert.deepEqual((await request('state')).value.completed,[]);
assert.equal((await request('save',{type:'bookmark',key:'P1-01-01',data:{},remove:true})).status,200);
assert.equal((await request('delete-attempt',{id})).status,200);
assert.equal((await request('audio/'+id)).status,404);
assert.equal(objects.size,0);
assert.equal((await request('save',{type:'bookmark',key:'x',data:{}},user,'https://untrusted.example')).status,403);
const {encryptCredential,decryptCredential}=await import(integration);const key=Buffer.alloc(32,7).toString('base64');const encrypted=await encryptCredential('synthetic-secret-for-crypto-test',key);assert(!encrypted.includes('synthetic-secret'));assert.equal(await decryptCredential(encrypted,key),'synthetic-secret-for-crypto-test');assert.equal((await request('integration',{key:'synthetic-not-a-real-key-for-testing'})).status,403);assert.equal((await request('content-batch',{questions:[]})).status,403);

globalThis.__speakTest.env.GEMINI_API_KEY='synthetic-not-a-real-provider-key';
globalThis.__speakTest.assess=async()=>({summary:'Synthetic diagnostic response',strengths:[],priorities:[],corrections:[],gaps:[],vocabulary:[],improved:'Synthetic answer.',transcript:'Synthetic test only',criteria:{fluency:{score:null,observation:'test'},lexical:{score:null,observation:'test'},grammar:{score:null,observation:'test'},pronunciation:{score:null,observation:'test'}},overall:null});
const transient=await request('submit',form(1));assert.equal(transient.status,200,JSON.stringify(transient.value));assert.equal(transient.value.audioSaved,false);assert.equal(objects.size,0);assert.equal((await request('state')).value.attempts[0].audio_key,'');assert.equal((await request('audio/'+transient.value.id)).status,404);assert.equal((await request('review-attempt',{id:transient.value.id})).status,200);assert.equal((await request('complete-stage',{})).status,409);
const typed=new FormData();typed.append('questionId','P1-01-01');typed.append('typed','This is a synthetic typed answer for a test.');typed.append('kind','free');const t=await request('submit',typed);assert.equal(t.status,200);assert.equal(t.value.textOnly,true);assert.equal(objects.size,0);
const rejected=new FormData();rejected.append('questionId','P1-01-01');rejected.append('typed','This is a synthetic typed answer for a test.');rejected.append('kind','daily');rejected.append('day','1');assert.equal((await request('submit',rejected)).status,409);
globalThis.__speakTest.env.ADMIN_EMAIL=user.email;globalThis.__speakTest.env.CREDENTIAL_ENCRYPTION_KEY=key;
const realFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]});
const connection=await request('integration',{key:'synthetic-api-key-never-real-for-testing'});assert.equal(connection.status,200);assert(!JSON.stringify(connection.value).includes('synthetic-api-key'));const stored=sqlite.prepare("SELECT value FROM settings WHERE key='gemini_connection'").get();assert(!stored.value.includes('synthetic-api-key'));assert.equal((await request('state')).value.connection.configured,true);globalThis.fetch=realFetch;
assert.equal((await request('integration',{key:'synthetic-not-a-real-key'},{...other,email:'someone-else@example.test'})).status,403);
globalThis.__speakTest.env.CONTENT_UPDATES_ALLOWED='owner_private';const batch={questions:[{id:'ADD-2026-10-31-P3-01',text:'How can students judge whether an unfamiliar online source is trustworthy?',part:3,topic:'Education',difficulty:'Advanced',duration:120,objective:'Explain a reason and use an example.',related:[]}]};assert.equal((await request('content-batch',batch,null)).value.added,1);assert.equal((await request('content-batch',batch,null)).value.added,0);assert.equal((await request('questions')).value.questions.length,3061);
const beforeProbe=(await request('state')).value.attempts.length;assert.equal((await request('integration/test',{})).status,200);assert.equal((await request('state')).value.attempts.length,beforeProbe);assert.equal((await request('integration/test',{}, {...other,email:'someone-else@example.test'})).status,403);
const {ProviderFailure,providerFailure,assessmentFailureMessage}=await import(providerErrors);const failure=await providerFailure(Response.json({error:{status:'RESOURCE_EXHAUSTED',message:'synthetic secret not to expose; limit: 0'}},{status:429}));assert(failure.zeroQuota);assert(failure.message.includes('zero available quota'));assert(!failure.message.includes('synthetic secret'));globalThis.__speakTest.assess=async()=>{throw new ProviderFailure('Gemini',429,'RESOURCE_EXHAUSTED',true)};assert((await request('integration/test',{})).value.error.includes('zero available quota'));assert.equal((await request('state')).value.attempts.length,beforeProbe);
let modelRequests=[];globalThis.fetch=async(url)=>{modelRequests.push(String(url));if(String(url).endsWith('/models'))return Response.json({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.8-flash-tts',supportedGenerationMethods:['generateContent']}]});return Response.json({candidates:[{content:{parts:[{text:'{\"connected\":true}'}]}}]});};const {verifyGemini}=await import(integration);assert.equal(await verifyGemini('synthetic-key-for-model-selection'),'gemini-3.8-flash');assert(!modelRequests.some(url=>url.includes('gemini-2.5-flash:generateContent')));globalThis.__speakTest.assess=async(config)=>{if(config.AI_MODEL==='gemini-2.5-flash')throw new ProviderFailure('Gemini',404,'NOT_FOUND');return {corrections:[{corrected:'I have been living in Dhaka for five years.'}],vocabulary:[],summary:'Synthetic diagnostic success'};};const refreshed=await request('integration/test',{});assert.equal(refreshed.status,200);assert.equal(refreshed.value.model,'gemini-3.8-flash');assert.equal(refreshed.value.modelRefreshed,true);assert.equal((await request('state')).value.attempts.length,beforeProbe);globalThis.fetch=realFetch;
globalThis.fetch=async(url)=>String(url).endsWith('/models')?Response.json({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.5-flash-lite',supportedGenerationMethods:['generateContent']}]}):Response.json({candidates:[{content:{parts:[{text:'{}'}]}}]});assert.equal(await verifyGemini('synthetic-key-for-lite-selection'),'gemini-3.5-flash-lite');globalThis.fetch=realFetch;
const beforeTranscription=(await request('state')).value;let transcriptionPayload;
globalThis.fetch=async(url,options)=>{transcriptionPayload=JSON.parse(options.body);return Response.json({candidates:[{content:{parts:[{thought:true,text:'ignored'},{text:JSON.stringify({transcript:'আমি ঢাকায় থাকি। I enjoy my hometown.'})}]}}]})};
const speech=form(1);speech.append('language','auto');const transcribed=await request('transcribe',speech);assert.equal(transcribed.status,200,JSON.stringify(transcribed.value));assert.equal(transcribed.value.transcript,'আমি ঢাকায় থাকি। I enjoy my hometown.');assert.equal(transcriptionPayload.contents[0].parts[0].inlineData.mimeType,'audio/wav');assert(transcriptionPayload.systemInstruction.parts[0].text.includes('Do not answer questions'));assert(transcriptionPayload.systemInstruction.parts[0].text.includes('Bengali script'));
const afterTranscription=(await request('state')).value;assert.deepEqual(afterTranscription.attempts,beforeTranscription.attempts);assert.deepEqual(afterTranscription.completed,beforeTranscription.completed);assert.equal(objects.size,0);assert.equal((await request('transcribe',form(1),null)).status,401);assert.equal((await request('transcribe',form(1),user,'https://untrusted.example')).status,403);
const invalidSpeech=new FormData();invalidSpeech.append('audio',new Blob([new Uint8Array(1000)],{type:'audio/wav'}),'bad.wav');assert.equal((await request('transcribe',invalidSpeech)).status,400);
globalThis.fetch=async()=>Response.json({error:{status:'UNAVAILABLE'}},{status:503});assert.equal((await request('transcribe',form(1))).status,502);assert.equal((await request('state')).value.attempts.length,beforeTranscription.attempts.length);globalThis.fetch=realFetch;
console.log('PASS: actual API handler with SQLite/private object adapters — profile persistence, recording round-trip, account isolation, admin denial, CSRF, locked-day rejection, encrypted owner-only Gemini setup, transient audio assessment, text-only restrictions, content-batch idempotency and no false progression.');
