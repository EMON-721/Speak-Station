// Standalone Cloudflare hosting uses verified Google identity instead of Sites headers.
const encoder=new TextEncoder();
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const cookie=(req:Request,name:string)=>req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';
const safeReturn=(value:string|null)=>value?.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!/^\/(?:signin-with-chatgpt|signout-with-chatgpt|callback)(?:[/?#]|$)/.test(value)?value:'/';
let cachedSecret='',cachedKey:CryptoKey|undefined;
async function key(secret:string){if(!cachedKey||cachedSecret!==secret){cachedKey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);cachedSecret=secret;}return cachedKey;}
export async function signAuth(value:unknown,secret:string){const payload=b64(encoder.encode(JSON.stringify(value))),signature=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload));return payload+'.'+b64(new Uint8Array(signature));}
export async function verifyAuth(value:string,secret:string):Promise<any|null>{try{const [payload,signature,extra]=value.split('.');if(extra||!payload||!signature||!await crypto.subtle.verify('HMAC',await key(secret),decode(signature),encoder.encode(payload)))return null;const v=JSON.parse(new TextDecoder().decode(decode(payload)));return typeof v.exp==='number'&&v.exp>Date.now()?v:null;}catch{return null;}}

const emailAddress=(v:unknown)=>typeof v==='string'?v.trim().toLowerCase():'';
const validEmail=(v:string)=>v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validLoginId=(v:string)=>/^[a-z][a-z0-9._-]{3,29}$/.test(v);
const bytesToHex=(v:Uint8Array)=>Array.from(v).map(n=>n.toString(16).padStart(2,'0')).join('');
const hashPassword=async(password:string,salt:Uint8Array)=>{
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return bytesToHex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(salt).buffer,iterations:210000},material,256)));
};
const authJson=(message:string,status:number)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const secretEqual=(a:string,b:string)=>{let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;};
async function emailAuth(request:Request,env:any,secret:string,origin:string){
 const url=new URL(request.url);
 if(request.method!=='POST')return authJson('Method not allowed.',405);
 if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return authJson('Request origin is not allowed.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return authJson('JSON request required.',415);
 if(Number(request.headers.get('content-length')||0)>8192)return authJson('Request is too large.',413);
 if(!env.DB)return authJson('Account storage is not available.',503);
 let body:any;
 try{const source=await request.text();if(source.length>8192)return authJson('Request is too large.',413);body=JSON.parse(source);}catch{return authJson('Invalid request.',400);}
 const register=url.pathname==='/email-auth/signup';
 const email=emailAddress(body?.email),loginId=typeof body?.loginId==='string'?body.loginId.trim().toLowerCase():'',password=body?.password;
 if(register&&!validLoginId(loginId))return authJson('User ID must be 4–30 characters, starting with a letter; use lowercase letters, numbers, dots, underscores or hyphens.',400);
 if(!register&&!validLoginId(loginId)&&!validEmail(loginId))return authJson('Enter your User ID and password.',400);
 if((register&&!validEmail(email))||typeof password!=='string'||password.length<8||password.length>128)return authJson('Enter a valid email and password of at least 8 characters.',400);
 const db=env.DB as D1Database;
 // Account-level throttling. Failure records are never returned to the browser.
 const limitKey=bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode('email-auth:'+loginId))));
 const now=Date.now(),windowMs=15*60*1000;
 const limit=await db.prepare('SELECT attempts,reset_at FROM email_auth_limits WHERE key=?').bind(limitKey).first() as any;
 if(limit&&Number(limit.reset_at)>now&&Number(limit.attempts)>=8)return authJson('Too many attempts. Try again later.',429);
 if(!register&&url.pathname!=='/email-auth/login')return authJson('Not found.',404);
 if(register){
  const name=typeof body?.name==='string'?body.name.trim():'';
  if(name.length<2||name.length>100)return authJson('Enter your name (2–100 characters).',400);
  const existing=await db.prepare('SELECT user_id FROM email_accounts WHERE email=? OR login_id=?').bind(email,loginId).first();
  if(existing)return authJson('This email or User ID is already registered. Please log in.',409);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const passhash=await hashPassword(password,salt);
  const id='email:'+crypto.randomUUID();
  try{
   await db.prepare('INSERT INTO email_accounts(email,user_id,name,salt,password_hash,created_at,login_id) VALUES(?,?,?,?,?,?,?)').bind(email,id,name,bytesToHex(salt),passhash,new Date().toISOString(),loginId).run();
  }catch{return authJson('Unable to register. This email may already be in use.',409);}
  // Reserve a permanent member number from the configured 9057+ range. Existing Google numbers are preserved.
  await db.prepare('INSERT OR IGNORE INTO member_numbers(user_id) VALUES (?)').bind(id).run();
  await db.prepare('INSERT OR IGNORE INTO profiles(user_id,name,track,created_at) VALUES(?,?,?,?)').bind(id,name,210,new Date().toISOString()).run();
  const session=await signAuth({sub:id,provider:'email',email,name,exp:Date.now()+7*86400000},secret);
  return new Response(JSON.stringify({ok:true}),{status:201,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':setCookie('__Host-speak-session',session,7*86400)}});
 }
 const found=await db.prepare('SELECT user_id,name,email,salt,password_hash FROM email_accounts WHERE login_id=? OR (login_id IS NULL AND email=?)').bind(loginId,loginId).first() as any;
 // Evaluate a password hash even for missing users to reduce account probing.
 const salt=found?.salt?new Uint8Array(found.salt.match(/.{2}/g).map((n:string)=>parseInt(n,16))):new Uint8Array(16);
 const candidate=await hashPassword(password,salt);
 if(!found||!secretEqual(candidate,String(found.password_hash))){
  await db.prepare('INSERT INTO email_auth_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END').bind(limitKey,now+windowMs,now,now).run();
  return authJson('Invalid email or password.',401);
 }
 await db.prepare('DELETE FROM email_auth_limits WHERE key=?').bind(limitKey).run();
 const access=await db.prepare('SELECT status FROM user_access WHERE user_id=?').bind(found.user_id).first() as any;
 if(access&&access.status!=='active')return authJson('This account is not available.',403);
 const session=await signAuth({sub:found.user_id,provider:'email',email:found.email,name:found.name,exp:Date.now()+7*86400000},secret);
 return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':setCookie('__Host-speak-session',session,7*86400)}});
}

function redirect(url:string,cookies:string[]=[]){const headers=new Headers({'Location':url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(null,{status:302,headers});}
const setCookie=(name:string,value:string,age:number)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function standaloneIdentity(request:Request,env:any,standaloneBuild=false):Promise<Request|Response>{
 if(standaloneBuild&&env.AUTH_MODE!=='google')return new Response('Secure sign-in is not configured.',{status:503,headers:{'Cache-Control':'no-store'}});
 if(env.AUTH_MODE!=='google')return request;
 const url=new URL(request.url),secret=String(env.AUTH_SECRET||''),headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.toLowerCase().startsWith('oai-authenticated-'))headers.delete(name);
 let applicationOrigin='';try{const origin=new URL(env.APP_ORIGIN);if(origin.protocol==='https:'&&!origin.username&&!origin.password)applicationOrigin=origin.origin;}catch{}
 const configured=secret.length>=32&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&applicationOrigin;
 if(['/signin-with-chatgpt','/callback','/signout-with-chatgpt','/email-auth/signup','/email-auth/login'].includes(url.pathname)){
  if(!configured)return new Response('Sign-in is not configured yet. The owner must add the Google sign-in settings in Cloudflare Worker secrets.',{status:503,headers:{'Content-Type':'text/plain;charset=UTF-8','Cache-Control':'no-store'}});
  const origin=applicationOrigin;
  if(url.origin!==origin)return new Response('Open the configured application address to sign in.',{status:400});
  if(url.pathname.startsWith('/email-auth/'))return emailAuth(request,env,secret,origin);
  if(url.pathname==='/signout-with-chatgpt')return redirect(origin+safeReturn(url.searchParams.get('return_to')),[setCookie('__Host-speak-session','',0),setCookie('__Host-speak-oauth','',0)]);
  if(url.pathname==='/signin-with-chatgpt'){
   const state=b64(crypto.getRandomValues(new Uint8Array(32))),verifier=b64(crypto.getRandomValues(new Uint8Array(32))),challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
   const pending=await signAuth({state,verifier,returnTo:safeReturn(url.searchParams.get('return_to')),exp:Date.now()+600000},secret);
   const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');for(const [k,v] of Object.entries({client_id:String(env.GOOGLE_CLIENT_ID),redirect_uri:origin+'/callback',response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',access_type:'online',prompt:'select_account'}))target.searchParams.set(k,v);
   return redirect(target.href,[setCookie('__Host-speak-oauth',pending,600)]);
  }
  const pending=await verifyAuth(cookie(request,'__Host-speak-oauth'),secret),code=url.searchParams.get('code');
  if(!pending||pending.state!==url.searchParams.get('state')||!code||url.searchParams.has('error'))return new Response('Sign-in expired or could not be verified. Start sign-in again.',{status:400,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':setCookie('__Host-speak-oauth','',0)}});
  let oauthStage='token_exchange';
  try{
   const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:origin+'/callback',grant_type:'authorization_code',code_verifier:pending.verifier}),signal:AbortSignal.timeout(20000)});if(!tokenResponse.ok){console.error('GOOGLE_OAUTH_FAILURE',JSON.stringify({stage:oauthStage,status:tokenResponse.status}));throw new Error('TOKEN_EXCHANGE_FAILED');}const token:any=await tokenResponse.json();if(!token.access_token)throw new Error('MISSING_TOKEN');
   oauthStage='profile_fetch';
   const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{redirect:'manual',headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(20000)});if(!profileResponse.ok){console.error('GOOGLE_OAUTH_FAILURE',JSON.stringify({stage:oauthStage,status:profileResponse.status}));throw new Error('PROFILE_FAILED');}const profile:any=await profileResponse.json();
   oauthStage='identity_validation';
   if(typeof profile.sub!=='string'||typeof profile.email!=='string'||profile.email_verified!==true)throw new Error('VERIFIED_IDENTITY_REQUIRED');
   oauthStage='session_signing';
   const session=await signAuth({sub:profile.sub,email:profile.email,name:typeof profile.name==='string'?profile.name:profile.email,exp:Date.now()+7*86400000},secret);
   return redirect(origin+safeReturn(pending.returnTo),[setCookie('__Host-speak-session',session,7*86400),setCookie('__Host-speak-oauth','',0)]);
  }catch(error){if(!(error instanceof Error&&['TOKEN_EXCHANGE_FAILED','PROFILE_FAILED'].includes(error.message)))console.error('GOOGLE_OAUTH_FAILURE',JSON.stringify({stage:oauthStage,reason:'unexpected_failure',errorType:error instanceof Error&&['TypeError','TimeoutError','AbortError','SyntaxError','InvalidStateError'].includes(error.name)?error.name:'OtherError'}));return new Response('Google sign-in could not finish. Please start again.',{status:502,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':setCookie('__Host-speak-oauth','',0)}});}
 }
 const session=configured?await verifyAuth(cookie(request,'__Host-speak-session'),secret):null;
 if(session&&typeof session.sub==='string'&&typeof session.email==='string'){
  headers.set('oai-authenticated-user-id',session.provider==='email'&&String(session.sub).startsWith('email:')?session.sub:'google:'+session.sub);headers.set('oai-authenticated-user-email',session.email);headers.set('oai-authenticated-user-full-name',encodeURIComponent(String(session.name||session.email)));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');
 }
 return new Request(request,{headers});
}
