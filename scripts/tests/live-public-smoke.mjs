import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=(process.env.SPEAK_PUBLIC_URL||'https://speak-station.emon721.workers.dev').replace(/\/$/,'');
const results=[];
async function check(name,pathname,options,verify){
 const url=base+pathname;
 try{
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(14000),...options,headers:{'User-Agent':'SpeakStation-CI-QA/1.0',...(options?.headers||{})}});
  const body=await response.text();
  const value=verify(response,body);
  results.push({name,status:'PASS',http:response.status,detail:value||''});
 }catch(error){results.push({name,status:'FAIL',detail:String(error?.message||error).slice(0,170)})}
}
await check('Homepage renders','/',{},(r,body)=>{
 assert.equal(r.status,200,'homepage should render');
 assert(/Speak Station/i.test(body),'homepage must identify the application');
 assert(!/This is a temporary setup page/i.test(body),'setup placeholder is still deployed');
});
await check('Google login begins PKCE flow','/signin-with-chatgpt?return_to=%2F',{},r=>{
 assert.equal(r.status,302,'Google sign-in should redirect');
 assert.equal(new URL(r.headers.get('location')).hostname,'accounts.google.com','Google OAuth should be configured');
});
await check('Unauthenticated state API','/api/state',{},(r,body)=>{
 assert.equal(r.status,200);
 const data=JSON.parse(body);
 assert.equal(data.user,null,'anonymous state should never expose a learner');
 assert.equal(typeof data.content,'object');
});
await check('Question bank requires login','/api/questions',{},r=>assert([401,403].includes(r.status),'question bank should be protected'));
await check('Admin endpoint requires login','/api/admin/questions',{},r=>assert([401,403].includes(r.status),'admin API must be protected'));
await check('Session-changing request rejects unauthenticated submission','/api/record',{method:'POST'},r=>assert([401,403,405].includes(r.status),'unauthenticated post is rejected'));
await check('Favicon loads','/favicon.svg',{},(r,body)=>{assert.equal(r.status,200);assert(/<svg/.test(body),'favicon must be SVG')});
for(const r of results)console.log(r.status.padEnd(5),r.name,r.http||'—',r.detail);
const summary=['## Public production smoke test','Target: '+base,'','| Check | Status | HTTP | Note |','|---|---|---|---|',...results.map(r=>'| '+r.name+' | '+r.status+' | '+(r.http||'—')+' | '+(r.detail||'')+' |')].join('\n');
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
const failed=results.filter(r=>r.status==='FAIL');
console.log('RESULT:',results.length-failed.length,'/',results.length,'public-site checks passed.');
if(failed.length)process.exitCode=1;
