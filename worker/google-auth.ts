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
function redirect(url:string,cookies:string[]=[]){const headers=new Headers({'Location':url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(null,{status:302,headers});}
const setCookie=(name:string,value:string,age:number)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function standaloneIdentity(request:Request,env:any,standaloneBuild=false):Promise<Request|Response>{
 if(standaloneBuild&&env.AUTH_MODE!=='google')return new Response('Secure sign-in is not configured.',{status:503,headers:{'Cache-Control':'no-store'}});
 if(env.AUTH_MODE!=='google')return request;
 const url=new URL(request.url),secret=String(env.AUTH_SECRET||''),headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.toLowerCase().startsWith('oai-authenticated-'))headers.delete(name);
 let applicationOrigin='';try{const origin=new URL(env.APP_ORIGIN);if(origin.protocol==='https:'&&!origin.username&&!origin.password)applicationOrigin=origin.origin;}catch{}
 const configured=secret.length>=32&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&applicationOrigin;
 if(['/signin-with-chatgpt','/callback','/signout-with-chatgpt'].includes(url.pathname)){
  if(!configured)return new Response('Sign-in is not configured yet. The owner must add the Google sign-in settings in Cloudflare Worker secrets.',{status:503,headers:{'Content-Type':'text/plain;charset=UTF-8','Cache-Control':'no-store'}});
  const origin=applicationOrigin;
  if(url.origin!==origin)return new Response('Open the configured application address to sign in.',{status:400});
  if(url.pathname==='/signout-with-chatgpt')return redirect(origin+safeReturn(url.searchParams.get('return_to')),[setCookie('__Host-speak-session','',0),setCookie('__Host-speak-oauth','',0)]);
  if(url.pathname==='/signin-with-chatgpt'){
   const state=b64(crypto.getRandomValues(new Uint8Array(32))),verifier=b64(crypto.getRandomValues(new Uint8Array(32))),challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
   const pending=await signAuth({state,verifier,returnTo:safeReturn(url.searchParams.get('return_to')),exp:Date.now()+600000},secret);
   const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');for(const [k,v] of Object.entries({client_id:String(env.GOOGLE_CLIENT_ID),redirect_uri:origin+'/callback',response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',access_type:'online',prompt:'select_account'}))target.searchParams.set(k,v);
   return redirect(target.href,[setCookie('__Host-speak-oauth',pending,600)]);
  }
  const pending=await verifyAuth(cookie(request,'__Host-speak-oauth'),secret),code=url.searchParams.get('code');
  if(!pending||pending.state!==url.searchParams.get('state')||!code||url.searchParams.has('error'))return new Response('Sign-in expired or could not be verified. Start sign-in again.',{status:400,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':setCookie('__Host-speak-oauth','',0)}});
  try{
   const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:origin+'/callback',grant_type:'authorization_code',code_verifier:pending.verifier}),signal:AbortSignal.timeout(20000)});if(!tokenResponse.ok)throw new Error('TOKEN_EXCHANGE_FAILED');const token:any=await tokenResponse.json();if(!token.access_token)throw new Error('MISSING_TOKEN');
   const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{redirect:'error',headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(20000)});if(!profileResponse.ok)throw new Error('PROFILE_FAILED');const profile:any=await profileResponse.json();
   if(typeof profile.sub!=='string'||typeof profile.email!=='string'||profile.email_verified!==true)throw new Error('VERIFIED_IDENTITY_REQUIRED');
   const session=await signAuth({sub:profile.sub,email:profile.email,name:typeof profile.name==='string'?profile.name:profile.email,exp:Date.now()+7*86400000},secret);
   return redirect(origin+safeReturn(pending.returnTo),[setCookie('__Host-speak-session',session,7*86400),setCookie('__Host-speak-oauth','',0)]);
  }catch{return new Response('Google sign-in could not finish. Please start again.',{status:502,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':setCookie('__Host-speak-oauth','',0)}});}
 }
 const session=configured?await verifyAuth(cookie(request,'__Host-speak-session'),secret):null;
 if(session&&typeof session.sub==='string'&&typeof session.email==='string'){
  headers.set('oai-authenticated-user-id','google:'+session.sub);headers.set('oai-authenticated-user-email',session.email);headers.set('oai-authenticated-user-full-name',encodeURIComponent(String(session.name||session.email)));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');
 }
 return new Request(request,{headers});
}
