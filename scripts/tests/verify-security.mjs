import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {privateFile} from '../check-private-files.mjs';

// Exercise the real routes and SQL against an empty, synthetic database only.
const sqlite=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(sql){const run=(args)=>({
 all:async()=>({results:sqlite.prepare(sql).all(...args)}),
 run:async()=>({success:true,meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}})
});return {bind:(...args)=>run(args),...run([])};},batch:async items=>Promise.all(items.map(i=>i.run()))};
const env={DB,AUTH_MODE:'google',ADMIN_EMAIL:'owner@example.test',GEMINI_API_KEY:'synthetic-provider-placeholder'};
let identity=null,bucketReads=0;
const BUCKET={get:async()=>{bucketReads++;return {body:'synthetic audio'};},delete:async()=>{}};env.BUCKET=BUCKET;
const native=createRequire(import.meta.url),cache=new Map();
const overrides={'cloudflare:workers':{env},'next/headers':{headers:async()=>new Headers(identity?{'oai-authenticated-user-id':identity.userId,'oai-authenticated-user-email':identity.email}:{} )},'next/navigation':{redirect(){throw Error('unexpected redirect')}}};
function load(file){
 const full=path.resolve(file);if(cache.has(full))return cache.get(full).exports;
 if(full.endsWith('.json'))return JSON.parse(fs.readFileSync(full,'utf8'));
 const mod={exports:{}};cache.set(full,mod);
 const code=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const req=name=>{if(name in overrides)return overrides[name];if(!name.startsWith('.'))return native(name);const target=path.resolve(path.dirname(full),name);return load(fs.existsSync(target)?target:target+'.ts');};
 new Function('require','module','exports',code)(req,mod,mod.exports);return mod.exports;
}
const route=load('app/api/[...path]/route.ts'),{protectMutation}=load('app/lib/request-security.ts');
const origin='https://security.example.test';
const owner={userId:'google:synthetic-owner',email:env.ADMIN_EMAIL},alice={userId:'google:synthetic-alice',email:'alice@example.test'},bob={userId:'google:synthetic-bob',email:'bob@example.test'};
async function call(url,user=null,body=undefined,headers={}){
 identity=user;const request=new Request(origin+'/api/'+url,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{origin,'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await route[request.method](request);return {status:result.status,headers:result.headers,value:await result.json()};
}
assert.equal((await call('admin')).status,401);
assert.equal((await call('admin',alice)).status,403);
for(const endpoint of ['integration','integration/test','admin/content','admin/user','admin/message','admin/question','content-batch'])assert.equal((await call(endpoint,alice,{key:'synthetic rejected value'})).status,403,endpoint+' denies non-owner');
const anonymous=await call('state');assert(!('connection' in anonymous.value));assert.equal(anonymous.headers.get('cache-control'),'private, no-store');
const a=await call('state',alice),b=await call('state',bob);assert(!('connection' in a.value));assert.equal(a.value.isAdmin,false);assert.equal(b.value.user.id,bob.userId);
const admin=await call('state',owner);assert.equal(admin.value.isAdmin,true);assert.equal(admin.value.connection.configured,true);
assert(!JSON.stringify(admin.value).includes(env.GEMINI_API_KEY),'even owner state never serializes API key');
const stamp=new Date().toISOString(),record=crypto.randomUUID();
sqlite.prepare('INSERT INTO attempts(id,user_id,question_id,duration,audio_key,mime,transcript,created_at) VALUES (?,?,?,?,?,?,?,?)').run(record,bob.userId,'synthetic-question',12,'private/bob/audio','audio/webm','BOB_PRIVATE_TRANSCRIPT',stamp);
sqlite.prepare("INSERT INTO messages VALUES (?,?,?,?,?,'open',?)").run(crypto.randomUUID(),bob.userId,'Private synthetic support','BOB_PRIVATE_MESSAGE','',stamp);
sqlite.prepare("INSERT INTO days VALUES (?,?,?)").run(bob.userId,1,stamp);
for(const endpoint of ['state','export']){
 const result=await call(endpoint,alice);assert.equal(result.status,200);const text=JSON.stringify(result.value);assert(!text.includes('BOB_PRIVATE_'));assert(!text.includes(bob.userId));assert.equal(result.value.completed.length,0);
}
assert.equal((await call('audio/'+record,alice)).status,404);assert.equal(bucketReads,0,'cross-user audio denied before reading bucket');
assert.equal((await call('delete-attempt',alice,{id:record})).status,404);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM attempts WHERE id=?').get(record).n,1,'another learner cannot delete audio');
for(const spoofOrigin of ['https://evil.example','null','https://security.example.test.evil.example','not a URL'])assert.equal((await call('message',alice,{subject:'Synthetic subject',body:'Synthetic support message'},{origin:spoofOrigin})).status,403);
assert.equal((await call('message',alice,{subject:'Synthetic subject',body:'Synthetic support message'},{'sec-fetch-site':'cross-site'})).status,403);
const large=new Request(origin+'/api/integration',{method:'POST',headers:{origin,'content-type':'application/json'},body:'x'.repeat(2049)});
await assert.rejects(()=>protectMutation(large),error=>error.status===413,'real bytes are limited without Content-Length');
const lied=new Request(origin+'/api/integration',{method:'POST',headers:{origin,'content-length':'1'},body:'x'.repeat(2049)});
await assert.rejects(()=>protectMutation(lied),error=>error.status===413,'a false declared length cannot bypass the byte limit');
const {assessmentFailureMessage}=load('app/lib/provider-errors.ts');
assert(!assessmentFailureMessage(Error('SYNTHETIC_SECRET_SENTINEL')).includes('SYNTHETIC_SECRET_SENTINEL'));
const {encryptCredential,decryptCredential}=load('app/lib/integration.ts');
const encryption=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
const first=await encryptCredential('synthetic-value',encryption),second=await encryptCredential('synthetic-value',encryption);
assert.notEqual(first,second,'AES-GCM uses fresh random IVs');assert(!first.includes('synthetic-value'));assert.equal(await decryptCredential(first,encryption),'synthetic-value');
const corrupt=JSON.parse(first);corrupt.cipher[0]^=1;await assert.rejects(()=>decryptCredential(JSON.stringify(corrupt),encryption));
for(const name of ['.env','.env.production','.dev.vars','data.sqlite','data.sqlite-wal','backups/data.json','artifacts/trace.zip','server.log','service-account.json','keys/private.pem'])assert(privateFile(name),name+' forbidden in Git');
for(const name of ['.env.example','drizzle/0000_schema.sql','db/schema.ts','scripts/tests/verify-security.mjs','.openai/hosting.json'])assert(!privateFile(name),name+' is legitimate source');
console.log('PASS: real API authorization, cross-user read/delete denial, owner-only integration, private state, CSRF, actual upload bytes, sanitized errors, authenticated encryption and private-file guard. Synthetic data only; no live learner or credential access.');

// A private service token is never a learner/admin session. Only native Sites
// may use the dispatch-authenticated append-only updater; standalone rejects it.
const originalMode=env.AUTH_MODE;delete env.AUTH_MODE;env.CONTENT_UPDATES_ALLOWED='owner_private';identity=null;
const update={questions:[{id:'ADD-2026-11-01-P1-99',text:'What do you enjoy learning about in your spare time?',part:1,topic:'Education',difficulty:'Foundation',duration:45,objective:'Give a personal explanation.',related:[]}]};
const serviceRequest=new Request(origin+'/api/content-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(update)});
const serviceResult=await route.POST(serviceRequest);
assert.equal(serviceResult.status,process.env.SPEAK_TEST_NATIVE==='1'?200:403,'private updater stays native-only');
assert.equal((await call('export')).status,401,'service access cannot export learner records');
assert.equal((await call('admin')).status,401,'service access cannot access administrator records');
env.AUTH_MODE=originalMode;delete env.CONTENT_UPDATES_ALLOWED;
console.log('PASS: service identity cannot export learner data or enter admin APIs');

const {secureResponse}=load('app/lib/request-security.ts');
const secured=secureResponse(new Response('synthetic',{headers:{'Set-Cookie':'synthetic-cookie','Content-Type':'text/plain'}}));
assert.equal(secured.headers.get('Referrer-Policy'),'no-referrer');assert.equal(secured.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(secured.headers.get('Set-Cookie'),'synthetic-cookie');
console.log('PASS: security response headers preserve response and session cookies');
