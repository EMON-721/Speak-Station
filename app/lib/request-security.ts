/** Request boundaries apply before any database write or provider call. */
export class RequestBoundaryError extends Error {
 constructor(public status:number,message:string){super(message);this.name='RequestBoundaryError';}
}
export const PRIVATE_HEADERS={
 'Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Vary':'Cookie, Origin',
};
export async function protectMutation(request:Request,trustedPrivateService=false):Promise<Request>{
 const url=new URL(request.url);
 const origin=request.headers.get('origin');
 // Exact equality rejects malformed, opaque and cross-origin values safely.
 if((origin!==url.origin&&!(trustedPrivateService&&origin===null))||request.headers.get('sec-fetch-site')==='cross-site')
  throw new RequestBoundaryError(403,'This action must start from Speak Station.');
 const path=url.pathname.replace(/^\/api\//,'');
 const limit=path==='content-batch'?256000:path==='assess-part'?17*1024*1024:path==='transcribe'?9*1024*1024:path==='admin/part-smoke'?3*1024*1024:path==='integration'?2048:1024*1024;
 const length=request.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))
  throw new RequestBoundaryError(413,'The upload exceeds the allowed size.');
 if(!request.body)return request;
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];
 let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>limit){await reader.cancel();throw new RequestBoundaryError(413,'The upload exceeds the allowed size.');}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const body=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
 const headers=new Headers(request.headers);headers.delete('content-length');
 return new Request(request.url,{method:request.method,headers,body,redirect:'manual',signal:request.signal});
}

/** Keep browser security headers consistent, including auth/error responses. */
export function secureResponse(response:Response):Response{
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','no-referrer');
 headers.set('Permissions-Policy','camera=(), geolocation=(), microphone=(self)');
 headers.set('Strict-Transport-Security','max-age=31536000');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
