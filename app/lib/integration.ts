import {providerFailure} from './provider-errors';
export async function encryptCredential(value:string,key:string){const bytes=Uint8Array.from(atob(key),c=>c.charCodeAt(0));const aes=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(value));return JSON.stringify({iv:Array.from(iv),cipher:Array.from(new Uint8Array(cipher))});}
export async function decryptCredential(value:string,key:string){const item=JSON.parse(value);const aes=await crypto.subtle.importKey('raw',Uint8Array.from(atob(key),c=>c.charCodeAt(0)),'AES-GCM',false,['decrypt']);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(item.iv)},aes,new Uint8Array(item.cipher));return new TextDecoder().decode(plain);}

type ConnectionInfo={encrypted?:string;model?:string;checkedAt?:string};
async function savedConnection(env:any,db:D1Database):Promise<{key?:string;model?:string;checkedAt?:string;unavailable?:string}|null>{
 const result=await db.prepare("SELECT value FROM settings WHERE key='gemini_connection'").bind().all();
 const row:any=result.results?.[0];
 if(!row)return null;
 if(!env.CREDENTIAL_ENCRYPTION_KEY)return {unavailable:'Saved Gemini connection needs the original credential-encryption secret.'};
 try{
  const record:ConnectionInfo=JSON.parse(row.value);
  if(!record.encrypted)throw Error('Missing encrypted value');
  const key=await decryptCredential(record.encrypted,env.CREDENTIAL_ENCRYPTION_KEY);
  if(!key)return {unavailable:'Saved Gemini connection is empty.'};
  return {key,model:record.model,checkedAt:record.checkedAt};
 }catch{
  return {unavailable:'A saved Gemini connection exists, but cannot be decrypted. Restore the original CREDENTIAL_ENCRYPTION_KEY or use a securely stored Cloudflare GEMINI_API_KEY secret.'};
 }
}
export async function aiConfiguration(env:any,db:D1Database){
 const saved=await savedConnection(env,db);
 if(saved?.key)return {...env,AI_PROVIDER:'gemini',GEMINI_API_KEY:saved.key,AI_MODEL:saved.model||env.AI_MODEL};
 if(env.GEMINI_API_KEY)return {...env,AI_PROVIDER:'gemini'};
 return env;
}
export async function connectionStatus(env:any,db:D1Database){
 const saved=await savedConnection(env,db);
 if(saved?.key)return {configured:true,provider:'gemini',model:saved.model||env.AI_MODEL||null,checkedAt:saved.checkedAt||null,source:'secure_connection'};
 if(env.GEMINI_API_KEY)return {configured:true,provider:'gemini',model:env.AI_MODEL||null,checkedAt:null,source:'cloudflare_secret'};
 if(env.OPENAI_API_KEY)return {configured:true,provider:'openai',model:env.AI_MODEL||null,checkedAt:null,source:'cloudflare_secret'};
 return {configured:false,provider:null,model:null,checkedAt:null,source:'missing',reason:saved?.unavailable||'This Cloudflare environment has no saved Gemini connection or GEMINI_API_KEY Secret. A prior separate deployment does not automatically transfer its encrypted key.'};
}
export async function verifyGemini(key:string){
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(20000)});if(!res.ok)throw await providerFailure(res,'Gemini');const v:any=await res.json();
 const candidates=(v.models||[]).filter((m:any)=>(m.supportedGenerationMethods||[]).includes('generateContent')&&/flash/.test(m.name)&&!/(image|tts|live|embed|thinking|cyber|robot|computer|agent)/.test(m.name));
 const version=(name:string)=>Number(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1]||0);const rank=(name:string)=>(!/(preview|experimental)/.test(name)?10000:0)+version(name)*100+(/flash-lite/.test(name)?1000:0);
 candidates.sort((a:any,b:any)=>rank(b.name)-rank(a.name));if(!candidates.length)throw new Error('No compatible Gemini Flash model is available for this key.');
 for(const model of candidates.slice(0,4)){
  const id=model.name.replace('models/','');const probe=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:'Connection check. Return JSON {"connected":true}.'}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:128}}),signal:AbortSignal.timeout(30000)});
  if(probe.ok)return id;if(probe.status===404||probe.status===503)continue;throw await providerFailure(probe,'Gemini');
 }
 throw new Error('Google listed these Flash models but rejected their generation endpoints. Check current model availability in Google AI Studio.');
}
