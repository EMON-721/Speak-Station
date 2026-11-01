/** Owner privileges are granted by the Cloudflare-verified Google identity only.
 * Email alone or an untrusted client-side flag is never sufficient.
 */
export type AuthenticatedIdentity={userId:string;email:string}|null|undefined;
export type OwnerConfiguration={AUTH_MODE?:string;ADMIN_EMAIL?:string};
export function isVerifiedGoogleOwner(identity:AuthenticatedIdentity,config:OwnerConfiguration):boolean{
 const owner=typeof config.ADMIN_EMAIL==='string'?config.ADMIN_EMAIL.trim().toLowerCase():'';
 return config.AUTH_MODE==='google'
   &&owner.length>0
   &&typeof identity?.userId==='string'
   &&identity.userId.startsWith('google:')
   &&identity.userId.length>'google:'.length
   &&typeof identity.email==='string'
   &&identity.email.trim().toLowerCase()===owner;
}
