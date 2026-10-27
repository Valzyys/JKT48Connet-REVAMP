import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{build}from'esbuild';import{getPlatformProxy}from'wrangler';
test('Discord OAuth uses PKCE, one-use state and encrypted server sessions; guild writes recheck permissions and CSRF',async()=>{
 const scratch=await mkdtemp(join(tmpdir(),'jkc-discord-'));await build({entryPoints:['worker/discord.ts'],bundle:true,platform:'node',format:'esm',outfile:join(scratch,'discord.mjs')});const{handleDiscord,manages}=await import(join(scratch,'discord.mjs'));
 const config=join(scratch,'wrangler.json');await writeFile(config,JSON.stringify({name:'discord-test',compatibility_date:'2026-10-01',d1_databases:[{binding:'PM_DB',database_name:'discord-test',database_id:'discord-test'}]}));const platform=await getPlatformProxy({configPath:config,persist:{path:join(scratch,'state')}});const db=platform.env.PM_DB;await db.exec(await readFile('migrations/0003_discord.sql','utf8'));
 const env={PM_DB:db,SESSION_SECRET:'synthetic-server-secret-must-remain-private',DISCORD_CLIENT_ID:'1305141693477027891',DISCORD_CLIENT_SECRET:'synthetic-oauth-secret',DISCORD_REDIRECT_URI:'https://site.test/api/discord/auth/callback',DISCORD_BOT_API_URL:'https://bridge.test/internal/discord-guild',DISCORD_BOT_API_TOKEN:'synthetic-bridge-token'};
 const original=globalThis.fetch;let manageable=true,bridgeWrites=0,tokenForm;
 const guild='111111111111111111';
 globalThis.fetch=async(input,options={})=>{const u=new URL(String(input)),h=new Headers(options.headers);
  if(u.href==='https://discord.com/api/oauth2/token'){tokenForm=new URLSearchParams(options.body);assert.equal(tokenForm.get('client_secret'),env.DISCORD_CLIENT_SECRET);return Response.json({access_token:'private-user-access-token',scope:'identify guilds',expires_in:3600})}
  if(u.pathname==='/api/v10/users/@me')return Response.json({id:'222222222222222222',username:'tester',global_name:'Akun uji',avatar:null});
  if(u.pathname==='/api/v10/users/@me/guilds'){assert.equal(h.get('Authorization'),'Bearer private-user-access-token');return Response.json([{id:guild,name:'My guild',permissions:manageable?'32':'0'},{id:'333333333333333333',name:'Not manageable',permissions:'0'}])}
  if(u.host==='bridge.test'){assert.equal(h.get('Authorization'),'Bearer '+env.DISCORD_BOT_API_TOKEN);if(u.pathname.endsWith('/status'))return Response.json({guild_ids:[guild],connected:true});assert.equal(h.get('X-Discord-User-ID'),'222222222222222222');if(options.method==='PUT')bridgeWrites++;return Response.json({ok:true})}throw Error('Unexpected request '+u.href);
 };
 const request=(path,options={})=>new Request('https://site.test/api/discord'+path,options);
 try{
  assert.equal(manages({permissions:'8'}),true);assert.equal(manages({permissions:'0'}),false);assert.equal(manages({permissions:'malformed'}),false);
  let r=await handleDiscord(request('/session'),env);assert.equal((await r.json()).authenticated,false);
  r=await handleDiscord(request('/auth/start'),env);assert.equal(r.status,302);const auth=new URL(r.headers.get('location')),state=auth.searchParams.get('state'),flow=r.headers.get('set-cookie').split(';')[0];assert.equal(auth.searchParams.get('scope'),'identify guilds');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.ok(auth.searchParams.get('code_challenge'));assert.match(flow,/__Host-/);
  const bad=await handleDiscord(request('/auth/callback?code=sample&state='+state),env);assert.equal(bad.status,400);
  r=await handleDiscord(request('/auth/callback?code=sample&state='+state+'&iss=https%3A%2F%2Fdiscord.com',{headers:{Cookie:flow}}),env);assert.equal(r.status,303);assert.ok(tokenForm.get('code_verifier'));assert.equal(tokenForm.get('redirect_uri'),env.DISCORD_REDIRECT_URI);
  const cookie=r.headers.getSetCookie().find(v=>v.startsWith('__Host-jc_discord=')).split(';')[0];assert.match(r.headers.getSetCookie()[0],/HttpOnly/);assert.match(r.headers.getSetCookie()[0],/SameSite=Lax/);
  const stored=await db.prepare('SELECT * FROM discord_sessions').first();assert.ok(!JSON.stringify(stored).includes('private-user-access-token'));
  const replay=await handleDiscord(request('/auth/callback?code=sample&state='+state,{headers:{Cookie:flow}}),env);assert.equal(replay.status,400);
  r=await handleDiscord(request('/session',{headers:{Cookie:cookie}}),env);const session=await r.json();assert.equal(session.user.name,'Akun uji');assert.ok(!JSON.stringify(session).includes('private-user-access-token'));
  r=await handleDiscord(request('/guilds',{headers:{Cookie:cookie}}),env);const value=await r.json();assert.equal(value.guilds.length,1);assert.equal(value.guilds[0].installed,true);
  const cross=await handleDiscord(request('/guilds/333333333333333333',{headers:{Cookie:cookie}}),env);assert.equal(cross.status,403);
  const payload={method:'PUT',headers:{Cookie:cookie,Origin:'https://site.test','X-CSRF-Token':session.csrf},body:'{}'};
  r=await handleDiscord(request('/guilds/'+guild,{...payload,headers:{Cookie:cookie,Origin:'https://evil.test','X-CSRF-Token':session.csrf}}),env);assert.equal(r.status,403);assert.equal(bridgeWrites,0);
  manageable=false;r=await handleDiscord(request('/guilds/'+guild,payload),env);assert.equal(r.status,403);assert.equal(bridgeWrites,0);
  manageable=true;r=await handleDiscord(request('/guilds/'+guild,payload),env);assert.equal(r.status,200);assert.equal(bridgeWrites,1);
  r=await handleDiscord(request('/logout',{method:'POST',headers:payload.headers,body:'{}'}),env);assert.equal(r.status,200);
  r=await handleDiscord(request('/guilds',{headers:{Cookie:cookie}}),env);assert.equal(r.status,401);
 }finally{globalThis.fetch=original;await platform.dispose();await rm(scratch,{recursive:true,force:true})}
});
