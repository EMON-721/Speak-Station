export class ProviderFailure extends Error {
 constructor(public provider:string,public httpStatus:number,public code:string,public zeroQuota=false){
  const prefix=`${provider} returned HTTP ${httpStatus}${code?` (${code})`:''}. `;
  const advice=httpStatus===429?(zeroQuota?'This project currently has zero available quota for the selected model. Check the project’s usage limits and billing in Google AI Studio. Waiting alone may not fix a zero quota.':'The request rate or usage quota was exceeded. Check usage limits and retry after the provider’s cooldown.')
   :httpStatus===401?'The provider rejected the API credentials. Check that the saved key is active.'
   :httpStatus===403?'This project is not allowed to generate with this model. Check API restrictions, project permissions, supported location and billing.'
   :httpStatus===404?'The selected model is unavailable. Reconnect the key to refresh available models.'
   :httpStatus===400?'The provider rejected the request. Check the selected model and supported audio format.'
   :httpStatus>=500?'The provider is temporarily unavailable. Retry later.':'The provider could not complete the request.';
  super(prefix+advice);this.name='ProviderFailure';
 }
}
export async function providerFailure(res:Response,provider='Gemini'):Promise<ProviderFailure>{let value:any=null;try{value=await res.json()}catch{}const error=value?.error;const code=typeof error?.status==='string'&&/^[A-Z_]{1,80}$/.test(error.status)?error.status:'';const zeroQuota=res.status===429&&(/limit\s*:\s*0\b/i.test(String(error?.message||''))||(error?.details||[]).some((d:any)=>(d.violations||[]).some((v:any)=>String(v.quotaValue)==='0')));return new ProviderFailure(provider,res.status,code,zeroQuota);}
export function assessmentFailureMessage(error:unknown){if(error instanceof ProviderFailure)return error.message;if(error instanceof Error&&error.name==='ZodError'){const issue=(error as any).issues?.[0];const path=Array.isArray(issue?.path)?issue.path.filter((p:any)=>typeof p==='number'||/^[a-zA-Z_]+$/.test(p)).join('.'):'';return `The AI replied, but its feedback format was incomplete${path?` at “${path}”`:''}. Please retry; your answer has not been marked complete.`;}if(error instanceof SyntaxError)return 'The AI replied with unreadable feedback. Please retry; your answer has not been marked complete.';if(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name))return 'The AI request timed out. Your answer remains on this device; please retry.';return 'The assessment could not finish. Your answer remains on this device. Check your AI connection and retry.';}
