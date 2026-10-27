export type GameKind = 'member' | 'quiz' | 'memory' | 'song';
export type GameUser = {id:string;name:string;avatar:string|null};
export type GameSession = {token:string;user:GameUser;expires_at:number;instance_id?:string;guest?:boolean};
export type GameInfo = {id:GameKind;title:string;subtitle:string;tag:string;rounds:number};
export const GAMES:GameInfo[] = [
 {id:'member',title:'Tebak Member',subtitle:'Sedikit potongan foto. Seberapa cepat kamu mengenalinya?',tag:'FAMILIAR FACES',rounds:8},
 {id:'quiz',title:'Quiz JKT48',subtitle:'Dari single sampai panggung. Uji ingatanmu bareng teman.',tag:'KNOW YOUR 48',rounds:8},
 {id:'memory',title:'Memory Card',subtitle:'Balik kartunya, temukan pasangan, jaga giliranmu.',tag:'A LITTLE RECALL',rounds:1},
 {id:'song',title:'Tebak Lagu',subtitle:'Dengarkan cuplikan singkat, lalu pilih judul lagunya.',tag:'PRESS PLAY',rounds:8},
];
export type PlayerView = GameUser & {score:number;online:boolean;answered:boolean};
export type RoomView = {code:string;game:GameKind;mode:'solo'|'multi';phase:'lobby'|'playing'|'reveal'|'finished';host:string;players:PlayerView[];round:number;rounds:number;deadline:number;server_now:number;question?:{id:string;prompt:string;image?:string;audio?:string;options:{id:string;label:string}[];crop?:boolean};result?:{correct:string;label:string;explanation:string};memory?:{cards:{index:number;face?:{name:string;image:string};matched:boolean}[];turn:string;flips:number[];moves:number};expires_at:number;you:string};
