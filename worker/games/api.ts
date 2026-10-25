import type {DurableObjectNamespace} from '@cloudflare/workers-types';
import type {GameKind,GameSession} from '../../src/lib/games/types';
import {discordBridge,discordGameUser,type DiscordEnv} from '../discord';
import {issueGameToken,verifyGameToken,type GameIdentity} from './auth';
import {GameError} from './engine';
import members from './members.json';
export interface GamesEnv extends DiscordEnv{GAME_ROOM?:DurableObjectNamespace;GAME_LIMITER?:{limit(input:{key:string}):Promise<{success:boolean}>}}
const encoder=new TextEncoder();
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export function gameOrigin(request:Request,env:GamesEnv){const origin=request.headers.get('Origin');if(!origin)return false;const actual=new URL(request.url);return origin===actual.origin||origin===`https://${env.DISCORD_CLIENT_ID}.discordsays.com`||origin===`https://${env.DISCORD_CLIENT_ID}.discordsez.com`}
async function input(request:Request){const raw=await request.text();if(raw.length>5000)throw new GameError('Permintaan terlalu besar.',413);try{return JSON.parse(raw)}catch{throw new GameError('JSON tidak valid.')}}
async function limited(request:Request,env:GamesEnv,kind:string){const ip=request.headers.get('CF-Connecting-IP')||'local';if(env.GAME_LIMITER&&!(await env.GAME_LIMITER.limit({key:kind+':'+ip})).success)throw new GameError('Terlalu banyak permintaan. Coba lagi sebentar.',429)}
async function loginResponse(env:GamesEnv,identity:GameIdentity):Promise<GameSession>{return{...identity,token:await issueGameToken(env.SESSION_SECRET!,identity),expires_at:identity.exp}}
export async function handleGames(request:Request,env:GamesEnv):Promise<Response>{const url=new URL(request.url),path=url.pathname.slice('/api/games'.length);try{
 const photo=/^\/photo\/([a-f0-9]{16})$/.exec(path);
 if(photo&&request.method==='GET'){
  const member=members.find(m=>m.id===photo[1]);if(!member)return json({message:'Foto tidak ditemukan.'},404);
  const cache=typeof caches!=='undefined'?caches.default:null,key=new Request(url.origin+'/api/games/photo/'+member.id);const hit=cache&&await cache.match(key);if(hit)return hit;
  const image=await fetch(member.source,{headers:{Accept:'image/jpeg'},redirect:'manual',signal:AbortSignal.timeout(10000),cf:{cacheTtl:86400,cacheEverything:true}}as RequestInit);
  if(!image.ok||!image.headers.get('Content-Type')?.startsWith('image/'))return json({message:'Foto belum tersedia.'},502);
  const response=new Response(image.body,{headers:{'Content-Type':image.headers.get('Content-Type')!,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});if(cache)await cache.put(key,response.clone());return response;
 }
 if(!env.SESSION_SECRET||!env.GAME_ROOM)throw new GameError('Game belum dikonfigurasi.',503);
 if(path==='/config'&&request.method==='GET')return json({client_id:env.DISCORD_CLIENT_ID||null,games:['member','quiz','memory','song'],players_max:16});
 if(request.method==='POST'&&!gameOrigin(request,env))throw new GameError('Origin tidak diizinkan.',403);
 if(path==='/session'&&request.method==='GET'){await limited(request,env,'session');const user=await discordGameUser(request,env);return json(user?await loginResponse(env,{user,exp:Date.now()+7200000}):{authenticated:false})}
 if(path==='/guest'&&request.method==='POST'){await limited(request,env,'guest');const digits=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n%10).join('');return json(await loginResponse(env,{user:{id:'9'+digits,name:'Pemain '+digits.slice(-4),avatar:null},exp:Date.now()+7200000,guest:true}))}
 if(path==='/discord/auth'&&request.method==='POST'){
  await limited(request,env,'oauth');const body=await input(request);if(typeof body.code!=='string'||body.code.length>2048||typeof body.instance_id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(body.instance_id))throw new GameError('Kode atau sesi Discord tidak valid.');
  const tokenRes=await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:env.DISCORD_CLIENT_ID!,client_secret:env.DISCORD_CLIENT_SECRET!,code:body.code}),redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!tokenRes.ok)throw new GameError('Otorisasi Discord belum berhasil. Buka ulang Activity.',401);const tokens=await tokenRes.json()as{access_token?:string;scope?:string;expires_in?:number};if(!tokens.access_token||!String(tokens.scope).split(' ').includes('identify'))throw new GameError('Izin Discord belum lengkap.',401);
  const meRes=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(15000)});if(!meRes.ok)throw new GameError('Sesi Discord tidak valid.',401);const me=await meRes.json()as{id:string;username:string;global_name?:string;avatar?:string};if(!/^\d{15,22}$/.test(me.id))throw new GameError('Identitas tidak valid.',401);
  // The bot validates actual instance membership; instance IDs from browsers alone are not trusted.
  try{await discordBridge(env,'/activity-instances/'+encodeURIComponent(body.instance_id),me.id)}catch(e){const status=(e as {status?:number}).status;throw new GameError(status===403||status===404?'Kamu belum terdaftar pada sesi Activity ini. Buka melalui Discord.':'Verifikasi Activity belum tersedia. Coba kembali sebentar.',status===403||status===404?403:503)}
  const identity:GameIdentity={user:{id:me.id,name:(me.global_name||me.username).slice(0,100),avatar:me.avatar?`https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`:null},exp:Date.now()+Math.min(7200000,Math.max(60000,Number(tokens.expires_in||3600)*1000-30000)),instance_id:body.instance_id};
  return json({...await loginResponse(env,identity),discord_access_token:tokens.access_token});
 }
 const socket=/^\/rooms\/([A-HJ-NP-Z2-9]{8})\/connect$/.exec(path);
 if(socket&&request.method==='GET'){
  if(!gameOrigin(request,env))throw new GameError('Origin tidak diizinkan.',403);if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')throw new GameError('WebSocket diperlukan.',426);
  await limited(request,env,'connect');return env.GAME_ROOM.get(env.GAME_ROOM.idFromName('room:'+socket[1])).fetch(new Request('https://room.internal/connect',{headers:{Upgrade:'websocket'}}));
 }
 if(path==='/rooms'&&request.method==='POST'){
  await limited(request,env,'create');const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'',identity=await verifyGameToken(env.SESSION_SECRET,token);if(!identity)throw new GameError('Login diperlukan.',401);
  const body=await input(request);if(!['member','quiz','memory','song'].includes(body.game)||!['solo','multi'].includes(body.mode))throw new GameError('Pilihan game tidak valid.');if(identity.guest&&body.mode!=='solo')throw new GameError('Multiplayer perlu login Discord.',403);
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>alphabet[n%32]).join('');
  if(body.mode==='multi'&&identity.instance_id){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(identity.instance_id)));code=Array.from(digest.slice(0,8),n=>alphabet[n%32]).join('')}
  const response=await env.GAME_ROOM.get(env.GAME_ROOM.idFromName('room:'+code)).fetch(new Request('https://room.internal/initialize',{method:'POST',body:JSON.stringify({code,game:body.game as GameKind,mode:body.mode,user:identity.user,members:members.map(({source:_source,...m})=>m)})}));
  if(response.status===409&&identity.instance_id)return json({code});if(!response.ok)return response;return json({code});
 }
 return json({message:'Endpoint game tidak ditemukan.'},404);
 }catch(e){return json({message:e instanceof GameError?e.message:'Game belum merespons. Coba lagi sebentar.'},e instanceof GameError?e.status:503)}}
