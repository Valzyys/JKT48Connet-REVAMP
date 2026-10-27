import type {GameKind,GameUser,RoomView} from '../../src/lib/games/types';
import {QUIZ,SONGS,type CatalogMember} from './catalog';
export type Question={id:string;prompt:string;image?:string;audio?:string;options:{id:string;label:string}[];answer:string;explanation:string};
export type Player=GameUser&{score:number;joined:number};
export type Room={version:1;code:string;game:GameKind;mode:'solo'|'multi';host:string;phase:RoomView['phase'];players:Player[];questions:Question[];round:number;deadline:number;roundStarted:number;answers:Record<string,{choice:string;points:number}>;result?:RoomView['result'];expires:number;created:number;finishedAt?:number;memory?:{deck:CatalogMember[];matched:number[];flips:number[];turn:number;moves:number}};
export class GameError extends Error{constructor(message:string,public status=400){super(message)}}
function requireThat(test:unknown,message:string,status=400):asserts test{if(!test)throw new GameError(message,status)}
export function shuffle<T>(items:T[],random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296):T[]{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function options(answer:string,others:string[]){return shuffle([answer,...others.slice(0,3)]).map((label,i)=>({id:String(i),label}))}
export function questions(game:GameKind,members:CatalogMember[]):Question[]{
 if(game==='quiz')return shuffle(QUIZ).slice(0,8).map((q,i)=>{const choices=options(q.a,q.other);return{id:'q'+i,prompt:q.q,options:choices,answer:choices.find(c=>c.label===q.a)!.id,explanation:q.why}});
 if(game==='song')return shuffle(SONGS).slice(0,8).map((s,i)=>{const choices=options(s.title,shuffle(SONGS.filter(v=>v.id!==s.id).map(v=>v.title)));return{id:'s'+i,prompt:'Judul lagu yang sedang diputar adalah…',audio:s.audio,options:choices,answer:choices.find(c=>c.label===s.title)!.id,explanation:'Cuplikan lagu JKT48: '+s.title+'.'}});
 if(game==='memory')return[];
 requireThat(members.length>=4,'Foto member belum tersedia. Coba lagi sebentar.',503);
 return shuffle(members).slice(0,8).map((m,i)=>{const choices=options(m.name,shuffle(members.filter(v=>v.id!==m.id).map(v=>v.name)));return{id:'m'+i,prompt:'Siapa member di potongan foto ini?',image:m.image,options:choices,answer:choices.find(c=>c.label===m.name)!.id,explanation:m.name}});
}
export function createRoom(code:string,game:GameKind,mode:'solo'|'multi',user:GameUser,members:CatalogMember[],now=Date.now()):Room{
 requireThat(['member','quiz','memory','song'].includes(game),'Game tidak dikenal.');requireThat(mode==='solo'||mode==='multi','Mode tidak valid.');
 if(game==='memory')requireThat(members.length>=6,'Minimal enam foto member diperlukan.',503);
 const r:Room={version:1,code,game,mode,host:user.id,phase:'lobby',players:[{...user,score:0,joined:now}],questions:questions(game,members),round:-1,deadline:0,roundStarted:0,answers:{},expires:now+7200000,created:now};
 if(game==='memory'){const deck=shuffle(members).slice(0,6);r.memory={deck:shuffle([...deck,...deck]),matched:[],flips:[],turn:0,moves:0}}return r;
}
export function joinRoom(r:Room,u:GameUser,now=Date.now()){
 requireThat(r.expires>now,'Room telah berakhir.',410);const old=r.players.find(p=>p.id===u.id);if(old){old.name=u.name;old.avatar=u.avatar;return}
 requireThat(r.mode!=='solo','Ini sesi solo.',403);requireThat(r.phase==='lobby','Permainan sudah dimulai. Tunggu host membuat sesi baru.',409);requireThat(r.players.length<16,'Room sudah penuh.',409);r.players.push({...u,score:0,joined:now});if(!r.host)r.host=u.id;
}
function nextQuestion(r:Room,now:number){r.round++;r.answers={};delete r.result;if(r.round>=r.questions.length){r.phase='finished';r.deadline=0;r.finishedAt=now;return}r.phase='playing';r.roundStarted=now;r.deadline=now+(r.game==='song'?30000:20000)}
export function start(r:Room,uid:string,now=Date.now()){
 requireThat(uid===r.host,'Hanya host yang bisa memulai.',403);requireThat(r.phase==='lobby','Permainan sudah dimulai.',409);requireThat(r.mode==='solo'||r.players.length>=2,'Ajak minimal satu teman untuk multiplayer.');
 if(r.game==='memory'){r.phase='playing';r.round=0;r.roundStarted=now;r.deadline=now+60000}else nextQuestion(r,now);
}
function reveal(r:Room,now:number){const q=r.questions[r.round];r.phase='reveal';r.result={correct:q.answer,label:q.options.find(c=>c.id===q.answer)!.label,explanation:q.explanation};r.deadline=now+3500}
export function answer(r:Room,uid:string,round:number,choice:string,now=Date.now()){
 requireThat(r.players.some(p=>p.id===uid),'Kamu belum bergabung.',403);requireThat(r.game!=='memory'&&r.phase==='playing'&&r.round===round,'Ronde sudah berubah.',409);requireThat(now<r.deadline,'Waktu menjawab sudah habis.',409);requireThat(!r.answers[uid],'Jawabanmu sudah tersimpan.',409);
 const q=r.questions[r.round];requireThat(q.options.some(c=>c.id===choice),'Pilihan tidak valid.');const points=choice===q.answer?500+Math.round(500*Math.max(0,1-(now-r.roundStarted)/(r.deadline-r.roundStarted))):0;
 r.answers[uid]={choice,points};r.players.find(p=>p.id===uid)!.score+=points;if(r.players.every(p=>r.answers[p.id]))reveal(r,now);
}
export function flip(r:Room,uid:string,index:number,now=Date.now()){
 const m=r.memory;requireThat(m&&r.phase==='playing','Permainan belum berjalan.',409);requireThat(r.players[m.turn].id===uid,'Sekarang giliran pemain lain.',403);requireThat(now<r.deadline,'Giliran sudah berakhir.',409);requireThat(Number.isInteger(index)&&index>=0&&index<m.deck.length,'Kartu tidak valid.');requireThat(m.flips.length<2&&!m.matched.includes(index)&&!m.flips.includes(index),'Kartu itu belum bisa dibuka.',409);
 m.flips.push(index);if(m.flips.length===2){m.moves++;const[a,b]=m.flips;if(m.deck[a].id===m.deck[b].id){m.matched.push(a,b);r.players[m.turn].score+=100;m.flips=[];r.deadline=now+60000;if(m.matched.length===m.deck.length){r.phase='finished';r.deadline=0;r.finishedAt=now}}else r.deadline=now+1400}
}
export function advance(r:Room,now=Date.now()){
 if(r.phase==='lobby'||r.phase==='finished'||now<r.deadline)return;
 if(r.game==='memory'){const m=r.memory!;m.flips=[];m.turn=(m.turn+1)%r.players.length;r.deadline=now+60000;return}
 if(r.phase==='playing')reveal(r,now);else if(r.phase==='reveal')nextQuestion(r,now);
}
export function next(r:Room,uid:string,now=Date.now()){requireThat(uid===r.host&&r.phase==='reveal','Tunggu hasil ronde.',409);nextQuestion(r,now)}
export function leave(r:Room,uid:string){requireThat(r.phase==='lobby','Pemain yang keluar saat bermain dapat masuk kembali.',409);const at=r.players.findIndex(p=>p.id===uid);if(at<0)return;r.players.splice(at,1);if(r.host===uid)r.host=r.players[0]?.id||''}
export function view(r:Room,uid:string,online:Set<string>,now=Date.now()):RoomView{
 const value:RoomView={code:r.code,game:r.game,mode:r.mode,phase:r.phase,host:r.host,players:r.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,online:online.has(p.id),answered:Boolean(r.answers[p.id])})),round:r.round+1,rounds:r.game==='memory'?1:r.questions.length,deadline:r.deadline,server_now:now,expires_at:r.expires,you:uid};
 if(r.game!=='memory'&&r.round>=0&&r.phase!=='finished'){const {answer:_answer,explanation:_why,...q}=r.questions[r.round];value.question={...q,...(r.game==='member'?{crop:r.phase==='playing'}:{})};if(r.phase==='reveal')value.result=r.result}
 if(r.memory){const m=r.memory;value.memory={cards:m.deck.map((c,index)=>({index,matched:m.matched.includes(index),...(m.matched.includes(index)||m.flips.includes(index)||r.phase==='finished'?{face:{name:c.name,image:c.image}}:{})})),turn:r.players[m.turn]?.id||'',flips:m.flips,moves:m.moves}}
 return value;
}
