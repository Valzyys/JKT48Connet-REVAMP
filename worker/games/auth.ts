import {b64url,unb64url} from '../../src/lib/wire';
import type {GameUser} from '../../src/lib/games/types';
export type GameIdentity={user:GameUser;exp:number;instance_id?:string;guest?:boolean};
const enc=new TextEncoder(),dec=new TextDecoder();
const cache=new Map<string,Promise<CryptoKey>>();
function signingKey(secret:string){if(!secret||secret.length<32)throw Error('Game secret unavailable');let key=cache.get(secret);if(!key){key=(async()=>{const base=await crypto.subtle.importKey('raw',enc.encode(secret),'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode('jkt48connect-games'),info:enc.encode('game-identity-v1')},base,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify'])})();cache.set(secret,key)}return key}
export async function issueGameToken(secret:string,identity:GameIdentity){const payload=b64url(enc.encode(JSON.stringify(identity)));return payload+'.'+b64url(await crypto.subtle.sign('HMAC',await signingKey(secret),enc.encode(payload)))}
export async function verifyGameToken(secret:string,token:string,now=Date.now()):Promise<GameIdentity|null>{try{
 if(token.length>2500)return null;const parts=token.split('.');if(parts.length!==2)return null;const[payload,sig]=parts;const signature=unb64url(sig),decoded=unb64url(payload);if(!signature||!decoded)return null;
 if(!await crypto.subtle.verify('HMAC',await signingKey(secret),new Uint8Array(signature),enc.encode(payload)))return null;
 const data=JSON.parse(dec.decode(decoded));if(!/^\d{15,22}$/.test(data.user?.id)||typeof data.user.name!=='string'||data.user.name.length>100||!Number.isFinite(data.exp)||data.exp<=now||data.exp>now+7210000)return null;
 if(data.instance_id!==undefined&&(typeof data.instance_id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(data.instance_id)))return null;return data;
 }catch{return null}}
