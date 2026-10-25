import {GAMES,type RoomView} from './types';

/** Public result text only: never include tokens, private room codes or invite URLs. */
export function resultShare(room:RoomView):{text:string;url:string;intent:string}|null{
 if(room.phase!=='finished')return null;
 const player=room.players.find(p=>p.id===room.you);if(!player)return null;
 const title=GAMES.find(g=>g.id===room.game)?.title||'JKT48Connect Arcade';
 const rank=1+room.players.filter(p=>p.score>player.score).length;
 const tied=room.players.filter(p=>p.score===player.score).length>1;
 const text=[`Baru selesai main ${title} di JKT48Connect!`,`${player.score.toLocaleString('id-ID')} poin${room.mode==='multi'?` · Peringkat ${rank}${tied?' bersama':''} dari ${room.players.length} pemain`:''}.`,room.game==='memory'&&room.memory?`6 pasangan kartu, ${room.memory.moves} percobaan.`:'',room.mode==='solo'?'Ada yang bisa lewat skorku? 👀':'Ronde berikutnya siapa yang menang? 👀'].filter(Boolean).join('\n');
 const url='https://jkt48connect.app/games';
 return{text,url,intent:'https://twitter.com/intent/tweet?'+new URLSearchParams({text,url})};
}
