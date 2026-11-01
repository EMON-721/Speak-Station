import assert from 'node:assert/strict';
import {loadTs} from './ts-loader.mjs';
const {isVerifiedGoogleOwner}=loadTs('app/lib/owner-access.ts');
const config={AUTH_MODE:'google',ADMIN_EMAIL:'owner@example.com'};
const owner={userId:'google:verified-owner-subject',email:'owner@example.com'};
assert.equal(isVerifiedGoogleOwner(owner,config),true,'configured Google owner is authorized');
assert.equal(isVerifiedGoogleOwner({...owner,email:'OWNER@EXAMPLE.COM'},config),true,'case-insensitive verified owner email');
assert.equal(isVerifiedGoogleOwner({...owner,email:'owner@example.com '},config),true,'owner email can be whitespace normalized');
for(const identity of [
 null,undefined,
 {userId:'google:regular-member',email:'member@example.com'},
 {userId:'google:regular-member',email:'imposter@example.com'},
 {userId:'untrusted:owner',email:'owner@example.com'},
 {userId:'chatgpt:owner',email:'owner@example.com'},
 {userId:'google:',email:'owner@example.com'}
]){
 assert.equal(isVerifiedGoogleOwner(identity,config),false,'normal or unverified identities cannot act as owner');
}
assert.equal(isVerifiedGoogleOwner(owner,{AUTH_MODE:'chatgpt',ADMIN_EMAIL:config.ADMIN_EMAIL}),false,'owner-only controls never use a non-Google identity');
assert.equal(isVerifiedGoogleOwner(owner,{AUTH_MODE:'google'}),false,'missing admin Gmail is fail-closed');
assert.equal(isVerifiedGoogleOwner(owner,{AUTH_MODE:'google',ADMIN_EMAIL:'another@example.com'}),false,'wrong configured owner is denied');
console.log('PASS: only verified Google session matching configured admin Gmail receives owner privileges');
