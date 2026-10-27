import members from './members.json';
import type {DurableObjectState,WebSocket} from '@cloudflare/workers-types';
import type {GameUser} from '../../src/lib/games/types';
import {verifyGameToken} from './auth';
import {createRoom,joinRoom,start,answer,flip,advance,next,leave,view,GameError,type Room} from './engine';
import type {CatalogMember} from './catalog';
type Env={SESSION_SECRET?:string};
type Attachment={user?:GameUser;exp:number;connected:number;window:number;count:number};
export class GameRoom{
 private room:Room|undefined;
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private ctx:DurableObjectState,private env:Env){ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get<Room>('room')})}
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const task=this.queue.then(fn);this.queue=task.catch(()=>{});return task}
 private sockets(){return this.ctx.getWebSockets()}
 private online(){return new Set(this.sockets().filter(s=>s.readyState===1).map(s=>(s.deserializeAttachment()as Attachment)?.user?.id).filter((s):s is string=>Boolean(s)))}
 private send(ws:WebSocket,value:unknown){try{ws.send(JSON.stringify(value))}catch{}}
 private broadcast(){if(!this.room)return;const online=this.online();for(const ws of this.sockets()){const a=ws.deserializeAttachment()as Attachment;if(a?.user)this.send(ws,{type:'state',room:view(this.room,a.user.id,online)})}}
 private async persist(){if(this.room)await this.ctx.storage.put('room',this.room);await this.arm();this.broadcast()}
 private async arm(){const now=Date.now();const deadlines=[this.room?.expires??now+60000];if(this.room&&['playing','reveal'].includes(this.room.phase))deadlines.push(this.room.deadline);
  for(const ws of this.sockets()){const a=ws.deserializeAttachment()as Attachment;if(a)deadlines.push(a.user?a.exp:a.connected+8000)}await this.ctx.storage.setAlarm(Math.max(now+100,Math.min(...deadlines)))}
 async fetch(request:Request):Promise<Response>{return this.serial(async()=>{const path=new URL(request.url).pathname;
  if(path==='/initialize'&&request.method==='POST'){
   if(this.room)return Response.json({message:'Room sudah ada.'},{status:409});const input=await request.json()as{code:string;game:any;mode:any;user:GameUser;members:CatalogMember[];instance_id?:string};
   try{this.room=createRoom(input.code,input.game,input.mode,input.user,input.members);await this.persist();return Response.json({code:this.room.code})}catch(e){return Response.json({message:e instanceof Error?e.message:'Room belum tersedia'},{status:e instanceof GameError?e.status:500})}
  }
  if(path!=='/connect'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('Not found',{status:404});
  if(!this.room||this.room.expires<=Date.now())return Response.json({message:'Room tidak ditemukan atau sudah berakhir.'},{status:404});
  if(this.sockets().length>=40)return new Response('Room penuh',{status:429});const pair=new WebSocketPair();const[client,server]=[pair[0],pair[1]];this.ctx.acceptWebSocket(server);
  server.serializeAttachment({exp:0,connected:Date.now(),window:Date.now(),count:0}as Attachment);this.send(server,{type:'hello'});await this.arm();return new Response(null,{status:101,webSocket:client});
 })}
 async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){return this.serial(async()=>{
  try{if(typeof message!=='string'||message.length>3000)throw new GameError('Pesan tidak valid.');const action=JSON.parse(message);const a=ws.deserializeAttachment()as Attachment;const now=Date.now();if(!a||!this.room||this.room.expires<=now){ws.close(1008,'Room berakhir');return}
   if(now-a.window>10000){a.window=now;a.count=0}if(++a.count>40){ws.close(1008,'Terlalu banyak aksi');return}ws.serializeAttachment(a);
   if(!a.user){if(action.type!=='auth'||typeof action.token!=='string')throw new GameError('Login diperlukan.',401);const identity=await verifyGameToken(this.env.SESSION_SECRET||'',action.token);if(!identity)throw new GameError('Sesi berakhir. Login kembali.',401);if(identity.guest&&this.room.mode!=='solo')throw new GameError('Multiplayer perlu login Discord.',403);
    joinRoom(this.room,identity.user,now);a.user=identity.user;a.exp=identity.exp;ws.serializeAttachment(a);for(const other of this.sockets()){if(other===ws)continue;const prior=other.deserializeAttachment()as Attachment;if(prior?.user?.id===a.user.id)other.close(4001,'Dibuka di tab lain')}await this.persist();return;
   }
   if(a.exp<=now){ws.close(4003,'Sesi login berakhir');return}
   advance(this.room,now);if(action.type==='start')start(this.room,a.user.id,now);
   else if(action.type==='answer')answer(this.room,a.user.id,action.round,action.choice,now);
   else if(action.type==='flip')flip(this.room,a.user.id,action.index,now);
   else if(action.type==='next')next(this.room,a.user.id,now);
   else if(action.type==='select'||action.type==='rematch'){if(a.user.id!==this.room.host||!(this.room.phase==='lobby'||this.room.phase==='finished'))throw new GameError('Hanya host di lobby atau hasil akhir yang bisa mengganti game.',403);const old=this.room;this.room=createRoom(old.code,action.game||old.game,old.mode,old.players.find(p=>p.id===old.host)!,members.map(({source:_source,...m})=>m));this.room.players=old.players.map(p=>({...p,score:0}));}
   else if(action.type==='leave'){leave(this.room,a.user.id);ws.close(1000,'Keluar');}
   else if(action.type==='sync'){this.send(ws,{type:'state',room:view(this.room,a.user.id,this.online())});return}
   else throw new GameError('Aksi tidak dikenal.');await this.persist();
  }catch(error){this.send(ws,{type:'error',message:error instanceof GameError?error.message:'Aksi belum berhasil. Coba lagi.',status:error instanceof GameError?error.status:400})}
 })}
 async webSocketClose(_ws:WebSocket){return this.serial(async()=>{if(this.room?.phase==='lobby'&&!this.online().has(this.room.host)){this.room.host=this.room.players.find(p=>this.online().has(p.id))?.id||this.room.host;await this.ctx.storage.put('room',this.room)}this.broadcast();await this.arm()})}
 async webSocketError(ws:WebSocket){try{ws.close(1011,'Koneksi terputus')}catch{}this.broadcast()}
 async alarm(){return this.serial(async()=>{const now=Date.now();for(const ws of this.sockets()){const a=ws.deserializeAttachment()as Attachment;if(!a||!a.user&&a.connected+8000<=now||a.user&&a.exp<=now)ws.close(4003,'Sesi berakhir')}
  if(!this.room||this.room.expires<=now){for(const ws of this.sockets())ws.close(1000,'Room berakhir');await this.ctx.storage.deleteAll();this.room=undefined;return}
  advance(this.room,now);await this.persist();
 })}
}
