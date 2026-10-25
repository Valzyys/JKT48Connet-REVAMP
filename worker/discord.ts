import type { D1Database } from '@cloudflare/workers-types';
import { b64url,seal,unseal } from '../src/lib/wire';
import { keys,type SecurityEnv } from './security';
export interface DiscordEnv extends SecurityEnv { PM_DB?:D1Database; DISCORD_CLIENT_ID?:string;DISCORD_CLIENT_SECRET?:string;DISCORD_REDIRECT_URI?:string;DISCORD_BOT_API_URL?:string;DISCORD_BOT_API_TOKEN?:string }
const API='https://discord.com/api/v10',enc=new TextEncoder(),dec=new TextDecoder(),SNOWFLAKE=/^\d{15,22}$/;
const schemaReady=new WeakMap<D1Database,Promise<unknown>>();
async function ensureSchema(db:D1Database){let task=schemaReady.get(db);if(!task){task=db.exec(`CREATE TABLE IF NOT EXISTS discord_oauth_states(hash TEXT PRIMARY KEY,verifier TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS discord_sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,profile TEXT NOT NULL,access_token TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS discord_sessions_expiry ON discord_sessions(expires);
CREATE TABLE IF NOT EXISTS discord_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);`);schemaReady.set(db,task);task.catch(()=>schemaReady.delete(db))}await task}
const now=()=>Math.floor(Date.now()/1000),random=()=>b64url(crypto.getRandomValues(new Uint8Array(32)));
export function manages(guild:{owner?:boolean;permissions?:string}){try{return guild.owner===true||(BigInt(guild.permissions||'0')&40n)!==0n}catch{return false}}
class Failure extends Error{constructor(public status:number,message:string){super(message)}}
function fail(status:number,message:string):never{throw new Failure(status,message)}
const json=(value:unknown,status=200,headers:HeadersInit={})=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
const hash=async(s:string)=>b64url(await crypto.subtle.digest('SHA-256',enc.encode(s)));
function cookie(request:Request,name:string){return(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||''}
function name(url:URL,flow=false){return(url.protocol==='https:'?'__Host-':'')+'jc_discord'+(flow?'_oauth':'')}
function setCookie(url:URL,value:string,ttl:number,flow=false){return`${name(url,flow)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}${url.protocol==='https:'?'; Secure':''}`}
function ready(env:DiscordEnv){return Boolean(env.PM_DB&&env.SESSION_SECRET&&env.SESSION_SECRET.length>=32&&env.DISCORD_CLIENT_ID&&env.DISCORD_CLIENT_SECRET&&env.DISCORD_BOT_API_URL&&env.DISCORD_BOT_API_TOKEN)}
function redirectUri(request:Request,env:DiscordEnv){const url=new URL(env.DISCORD_REDIRECT_URI||'/api/discord/auth/callback',request.url);if(url.origin!==new URL(request.url).origin||url.pathname!=='/api/discord/auth/callback'||url.search||url.hash)fail(503,'Alamat login belum dikonfigurasi.');return url.href}
async function limit(db:D1Database,key:string,max:number,seconds:number){const t=now();const r=await db.prepare('INSERT INTO discord_limits(key,count,reset_at)VALUES(?,1,?) ON CONFLICT(key)DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count').bind(key,t+seconds,t,t).first<{count:number}>();if(!r||r.count>max)fail(429,'Terlalu banyak permintaan. Coba lagi sebentar.')}
async function external(url:string,init:RequestInit={}){let r:Response;try{r=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(18000)})}catch{fail(502,'Koneksi Discord belum tersedia. Coba kembali sebentar.')}if(r.status>=300&&r.status<400)fail(502,'Redirect tidak diizinkan.');if(r.status===429)fail(429,'Discord sedang membatasi permintaan. Coba sebentar lagi.');return r}
async function discord(path:string,token:string){const r=await external(API+path,{headers:{Authorization:'Bearer '+token}});if(r.status===401)fail(401,'Sesi Discord berakhir. Silakan masuk kembali.');if(!r.ok)fail(502,'Data Discord belum berhasil dimuat.');return r.json()as Promise<any>}
export async function discordBridge(env:DiscordEnv,path:string,user?:string,method='GET',body?:unknown){if(!env.DISCORD_BOT_API_URL||!env.DISCORD_BOT_API_TOKEN)fail(503,'Bot belum tersedia.');const u=new URL(env.DISCORD_BOT_API_URL.replace(/\/$/,'')+path);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)fail(503,'Koneksi bot belum dikonfigurasi.');const r=await external(u.href,{method,headers:{Authorization:'Bearer '+env.DISCORD_BOT_API_TOKEN,...(user?{'X-Discord-User-ID':user}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});let result:any;try{result=await r.json()}catch{fail(502,'Bot belum merespons.')}if(!r.ok)fail([400,403,404,409,429].includes(r.status)?r.status:502,result.message||'Bot belum merespons.');return result}
async function readBody(request:Request){if(Number(request.headers.get('Content-Length'))>20000)fail(413,'Permintaan terlalu besar.');const raw=await request.text();if(raw.length>20000)fail(413,'Permintaan terlalu besar.');try{const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v}catch{fail(400,'Data tidak valid.')}}
async function session(request:Request,env:DiscordEnv){const token=cookie(request,name(new URL(request.url)));if(!/^[a-zA-Z0-9_-]{43}$/.test(token))fail(401,'Silakan masuk menggunakan Discord.');const row=await env.PM_DB!.prepare('SELECT * FROM discord_sessions WHERE hash=? AND expires>?').bind(await hash(token),now()).first<{hash:string;user_id:string;profile:string;access_token:string;csrf:string;expires:number}>();if(!row)fail(401,'Sesi berakhir. Silakan masuk kembali.');const key=await keys(env);const bytes=key&&await unseal(key.aes,row.access_token,'discord:'+row.hash);if(!bytes)fail(401,'Sesi berakhir. Silakan masuk kembali.');return{...row,token:dec.decode(bytes)}}
async function guilds(token:string){const value=await discord('/users/@me/guilds?limit=200&with_counts=true',token);if(!Array.isArray(value))fail(502,'Daftar server tidak valid.');return value.filter(manages)}
export async function handleDiscord(request:Request,env:DiscordEnv):Promise<Response>{const url=new URL(request.url),path=url.pathname.slice('/api/discord'.length);try{
 if(ready(env))await ensureSchema(env.PM_DB!);
 if(request.method==='GET'&&path==='/session'){
  if(!ready(env))return json({authenticated:false,configured:false});try{const s=await session(request,env);return json({authenticated:true,configured:true,user:JSON.parse(s.profile),csrf:s.csrf,expires_at:s.expires*1000})}catch(e){if(e instanceof Failure&&e.status===401)return json({authenticated:false,configured:true});throw e}
 }
 if(!ready(env))fail(503,'Login Discord belum tersedia. Coba kembali nanti.');const db=env.PM_DB!,key=await keys(env);if(!key)fail(503,'Login belum tersedia.');
 if(request.method==='GET'&&path==='/auth/start'){
  await db.prepare('DELETE FROM discord_oauth_states WHERE expires<?').bind(now()).run();await limit(db,'oauth:'+request.headers.get('CF-Connecting-IP'),12,600);const state=random(),verifier=random(),challenge=b64url(await crypto.subtle.digest('SHA-256',enc.encode(verifier)));const h=await hash(state);
  await db.prepare('INSERT INTO discord_oauth_states(hash,verifier,expires)VALUES(?,?,?)').bind(h,await seal(key.aes,new Uint8Array(enc.encode(verifier)),'discord-state:'+h),now()+600).run();
  const target=new URL('https://discord.com/oauth2/authorize');target.search=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID!,response_type:'code',redirect_uri:redirectUri(request,env),scope:'identify guilds',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':setCookie(url,state,600,true),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }
 if(request.method==='GET'&&path==='/auth/callback'){
  const state=url.searchParams.get('state')||'',stored=cookie(request,name(url,true));if(!state||!stored||state!==stored||!/^[a-zA-Z0-9_-]{43}$/.test(state))fail(400,'Permintaan login sudah tidak valid. Mulai login lagi.');if(url.searchParams.has('iss')&&url.searchParams.get('iss')!=='https://discord.com')fail(400,'Penerbit login tidak valid.');
  const h=await hash(state),record=await db.prepare('DELETE FROM discord_oauth_states WHERE hash=? AND expires>? RETURNING verifier').bind(h,now()).first<{verifier:string}>();if(!record)fail(400,'Permintaan login berakhir. Mulai lagi.');
  if(url.searchParams.has('error'))return new Response(null,{status:303,headers:{Location:'/discord?login=cancelled','Set-Cookie':setCookie(url,'',0,true),'Cache-Control':'no-store'}});
  const code=url.searchParams.get('code');if(!code||code.length>2048)fail(400,'Kode login tidak valid.');const verifier=await unseal(key.aes,record.verifier,'discord-state:'+h);if(!verifier)fail(400,'Permintaan login tidak valid.');
  const r=await external('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:env.DISCORD_CLIENT_ID!,client_secret:env.DISCORD_CLIENT_SECRET!,redirect_uri:redirectUri(request,env),code,code_verifier:dec.decode(verifier)})});if(!r.ok)fail(401,'Login Discord belum berhasil. Mulai kembali.');const tokens:any=await r.json();const scopes=String(tokens.scope||'').split(' ');if(!tokens.access_token||!scopes.includes('identify')||!scopes.includes('guilds')||!Number.isFinite(Number(tokens.expires_in))||Number(tokens.expires_in)<60)fail(401,'Izin login belum lengkap.');
  const user=await discord('/users/@me',tokens.access_token);if(!SNOWFLAKE.test(user.id))fail(401,'Identitas Discord tidak valid.');
  const raw=random(),sid=await hash(raw),ttl=Math.min(43200,Math.floor(Number(tokens.expires_in))-30),csrf=random(),profile={id:user.id,username:user.username,name:user.global_name||user.username,avatar:user.avatar?`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`:null};
  // Rotate an existing dashboard session after successful login.
  const old=cookie(request,name(url));if(old)await db.prepare('DELETE FROM discord_sessions WHERE hash=?').bind(await hash(old)).run();
  await db.prepare('INSERT INTO discord_sessions(hash,user_id,profile,access_token,csrf,expires)VALUES(?,?,?,?,?,?)').bind(sid,user.id,JSON.stringify(profile),await seal(key.aes,new Uint8Array(enc.encode(tokens.access_token)),'discord:'+sid),csrf,now()+ttl).run();
  await db.prepare('DELETE FROM discord_oauth_states WHERE expires<?').bind(now()).run();await db.prepare('DELETE FROM discord_sessions WHERE expires<?').bind(now()).run();
  const headers=new Headers({Location:'/discord','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});headers.append('Set-Cookie',setCookie(url,raw,ttl));headers.append('Set-Cookie',setCookie(url,'',0,true));return new Response(null,{status:303,headers});
 }
 const s=await session(request,env);
 if(!['GET','POST','PUT'].includes(request.method))fail(405,'Metode tidak didukung.');
 if(request.method!=='GET'){
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-CSRF-Token')!==s.csrf)fail(403,'Permintaan tidak valid. Muat ulang halaman.');await limit(db,'write:'+s.user_id,30,60);
 }
 if(request.method==='POST'&&path==='/logout'){await db.prepare('DELETE FROM discord_sessions WHERE hash=?').bind(s.hash).run();return json({ok:true},200,{'Set-Cookie':setCookie(url,'',0)})}
 if(request.method==='GET'&&path==='/guilds'){
  await limit(db,'guilds:'+s.user_id,15,60);const [mine,status]=await Promise.all([guilds(s.token),discordBridge(env,'/status')]);const installed=new Set(status.guild_ids);return json({guilds:mine.map(g=>({id:g.id,name:g.name,icon:g.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`:null,owner:g.owner,installed:installed.has(g.id)})),bot_connected:status.connected});
 }
 const match=/^\/guilds\/(\d{15,22})(?:\/(install|test))?$/.exec(path);if(!match)fail(404,'Endpoint tidak ditemukan.');
 // Never trust an ID or permissions supplied by the browser. Recheck Discord on every scoped request.
 const mine=await guilds(s.token);if(!mine.some(g=>g.id===match[1]))fail(403,'Kamu tidak memiliki izin Kelola Server di server ini.');
 if(request.method==='GET'&&match[2]==='install'){
  const target=new URL('https://discord.com/oauth2/authorize');target.search=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID!,scope:'bot applications.commands',permissions:'84992',integration_type:'0',guild_id:match[1],disable_guild_select:'true'}).toString();return json({url:target.href});
 }
 if(request.method==='POST'&&match[2]==='test'){await limit(db,'test:'+s.user_id+':'+match[1],1,60);return json(await discordBridge(env,'/guilds/'+match[1]+'/test',s.user_id,'POST',await readBody(request)))}
 if(match[2])fail(405,'Metode tidak didukung.');
 if(request.method==='PUT')return json(await discordBridge(env,'/guilds/'+match[1],s.user_id,'PUT',await readBody(request)));
 if(request.method==='GET'){await limit(db,'read:'+s.user_id,30,60);return json(await discordBridge(env,'/guilds/'+match[1],s.user_id))}
 fail(405,'Metode tidak didukung.');
 }catch(e){return json({message:e instanceof Failure?e.message:'Layanan Discord belum tersedia. Coba kembali sebentar.'},e instanceof Failure?e.status:503)}}

/** Authenticated website identity for first-party games; never returns the OAuth token. */
export async function discordGameUser(request:Request,env:DiscordEnv){if(!ready(env))return null;await ensureSchema(env.PM_DB!);try{const s=await session(request,env);return JSON.parse(s.profile) as {id:string;name:string;avatar:string|null}}catch(e){if(e instanceof Failure&&e.status===401)return null;throw e}}
