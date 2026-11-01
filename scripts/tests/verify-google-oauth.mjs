import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {loadTs} from './ts-loader.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const {standaloneIdentity,signAuth,verifyAuth}=loadTs('worker/google-auth.ts');
const env={AUTH_MODE:'google',AUTH_SECRET:'0123456789abcdef0123456789abcdef',GOOGLE_CLIENT_ID:'fake-client',GOOGLE_CLIENT_SECRET:'fake-secret',APP_ORIGIN:'https://speak.test'};
const noSession=await standaloneIdentity(new Request('https://speak.test/',{headers:{'oai-authenticated-user-id':'injected','oai-authenticated-user-email':'evil@example.com'}}),env);
assert(noSession instanceof Request);
assert.equal(noSession.headers.has('oai-authenticated-user-id'),false,'forged identity headers are stripped');
const notConfigured=await standaloneIdentity(new Request('https://speak.test/signin-with-chatgpt'),{AUTH_MODE:'google'});
assert.equal(notConfigured.status,503);
const start=await standaloneIdentity(new Request('https://speak.test/signin-with-chatgpt?return_to=%2Fprofile'),env);
assert.equal(start.status,302);
const oauth=new URL(start.headers.get('location'));
assert.equal(oauth.hostname,'accounts.google.com');
assert.equal(oauth.searchParams.get('code_challenge_method'),'S256','OAuth PKCE is enforced');
assert.equal(oauth.searchParams.get('redirect_uri'),'https://speak.test/callback');
const pending=start.headers.get('set-cookie').match(/__Host-speak-oauth=([^;]+)/)[1];
const fakeToken=await verifyAuth(pending,env.AUTH_SECRET);
assert.equal(fakeToken.returnTo,'/profile');
const malicious=await standaloneIdentity(new Request('https://speak.test/signin-with-chatgpt?return_to=https%3A%2F%2Fevil.example'),env);
const malCookie=malicious.headers.get('set-cookie').match(/__Host-speak-oauth=([^;]+)/)[1];
assert.equal((await verifyAuth(malCookie,env.AUTH_SECRET)).returnTo,'/','external redirect is rejected');
const invalid=await standaloneIdentity(new Request('https://speak.test/callback?state=wrong&code=sample',{headers:{cookie:'__Host-speak-oauth='+pending}}),env);
assert.equal(invalid.status,400,'invalid OAuth state is rejected');
const signed=await signAuth({sub:'test-user',email:'qa@example.com',name:'QA',exp:Date.now()+100000},env.AUTH_SECRET);
const loggedIn=await standaloneIdentity(new Request('https://speak.test/api/state',{headers:{cookie:'__Host-speak-session='+signed,'oai-authenticated-user-id':'spoof'}}),env);
assert.equal(loggedIn.headers.get('oai-authenticated-user-id'),'google:test-user');
assert.equal(loggedIn.headers.get('oai-authenticated-user-email'),'qa@example.com');
const logout=await standaloneIdentity(new Request('https://speak.test/signout-with-chatgpt?return_to=%2F'),env);
assert.equal(logout.status,302);
assert.equal(logout.headers.get('location'),'https://speak.test/');
// Simulate a full successful Google OAuth exchange without a real person's credentials.
// The same callback path signs the session cookie that the production app reads.
const googleFetch=globalThis.fetch;
try{
 let tokenCalls=0,profileCalls=0;
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://oauth2.googleapis.com/token'){
   tokenCalls++;
   assert.equal(options.method,'POST');
   const form=options.body;
   assert.equal(form.get('code'),'one-time-test-code');
   assert.equal(form.get('code_verifier'),fakeToken.verifier);
   assert.equal(form.get('redirect_uri'),'https://speak.test/callback');
   return Response.json({access_token:'qa-test-access-token'});
  }
  if(String(url)==='https://openidconnect.googleapis.com/v1/userinfo'){
   profileCalls++;
   assert.equal(options.headers.Authorization,'Bearer qa-test-access-token');
   return Response.json({sub:'real-shape-sub',email:'test@example.com',email_verified:true,name:'Test User'});
  }
  throw Error('Unexpected upstream URL in OAuth test: '+url);
 };
 const callback=new Request('https://speak.test/callback?state='+encodeURIComponent(oauth.searchParams.get('state'))+'&code=one-time-test-code',{headers:{cookie:'__Host-speak-oauth='+pending}});
 const done=await standaloneIdentity(callback,env);
 assert.equal(done.status,302,'valid callback should complete sign-in');
 assert.equal(done.headers.get('Location'),'https://speak.test/profile');
 const headers=done.headers.getSetCookie?.()||[done.headers.get('set-cookie')];
 const signedCookie=headers.find(value=>value?.startsWith('__Host-speak-session='));
 assert(signedCookie,'verified OAuth must set a signed session cookie');
 assert(signedCookie.includes('HttpOnly')&&signedCookie.includes('Secure')&&signedCookie.includes('SameSite=Lax'));
 const sessionValue=signedCookie.match(/^__Host-speak-session=([^;]+)/)[1];
 const verified=await verifyAuth(sessionValue,env.AUTH_SECRET);
 assert.equal(verified.sub,'real-shape-sub');
 assert.equal(verified.email,'test@example.com');
 const following=await standaloneIdentity(new Request('https://speak.test/api/state',{headers:{cookie:'__Host-speak-session='+sessionValue}}),env);
 assert.equal(following.headers.get('oai-authenticated-user-id'),'google:real-shape-sub');
 assert.equal(following.headers.get('oai-authenticated-user-email'),'test@example.com');
 assert.equal(tokenCalls,1);
 assert.equal(profileCalls,1);
 // An email that Google did not verify must not be allowed to log in.
 globalThis.fetch=async(url)=>String(url).includes('/token')?Response.json({access_token:'token'}):Response.json({sub:'fake',email:'unverified@example.com',email_verified:false});
 const denied=await standaloneIdentity(callback,env);
 assert.equal(denied.status,502,'unverified Google identity rejected');
 console.log('PASS: complete mocked Google callback, token exchange, PKCE verifier, signed session, verified email and account replay');
}finally{globalThis.fetch=googleFetch}

console.log('PASS: OAuth PKCE, state, safe redirect, signed session, forgery rejection and signout');
