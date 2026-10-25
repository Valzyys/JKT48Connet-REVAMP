export type CatalogMember={id:string;name:string;image:string};
export type Song={id:string;title:string;audio:string;source:string};
export const SONGS:Song[]=[
 {id:'s01',title:'Rapsodi',audio:'/games/audio/s01.mp3',source:'https://www.youtube.com/watch?v=Xu1wA7CfhQg'},
 {id:'s02',title:'Flying High',audio:'/games/audio/s02.mp3',source:'https://www.youtube.com/watch?v=eq0s1atl_K0'},
 {id:'s03',title:'Magic Hour',audio:'/games/audio/s03.mp3',source:'https://www.youtube.com/watch?v=mRMQsp90mFM'},
 {id:'s04',title:'Heavy Rotation',audio:'/games/audio/s04.mp3',source:'https://www.youtube.com/watch?v=mbi5V6v2peY'},
];
export const QUIZ=[
 {q:'Apa judul single original pertama JKT48?',a:'Rapsodi',other:['Flying High','Magic Hour','Heavy Rotation'],why:'Rapsodi diperkenalkan sebagai single original pertama JKT48 dalam MV resminya.'},
 {q:'Apa judul single original kedua JKT48?',a:'Flying High',other:['Rapsodi','Magic Hour','River'],why:'Flying High dirilis sebagai single ke-23 dan single original kedua JKT48.'},
 {q:'Lagu mana yang MV resminya dirilis pada 2024?',a:'Magic Hour',other:['Rapsodi','Flying High','Heavy Rotation'],why:'MV resmi Magic Hour dirilis pada Mei 2024.'},
 {q:'Di kota mana JKT48 berbasis?',a:'Jakarta',other:['Bandung','Surabaya','Yogyakarta'],why:'Nama JKT pada JKT48 merujuk pada Jakarta.'},
 {q:'JKT48 merupakan sister group dari grup mana?',a:'AKB48',other:['Morning Musume','Perfume','BABYMETAL'],why:'JKT48 merupakan bagian dari keluarga AKB48 Group.'},
 {q:'Di pusat perbelanjaan mana JKT48 Theater berada?',a:'fX Sudirman',other:['Grand Indonesia','Central Park','Kota Kasablanka'],why:'JKT48 Theater berada di fX Sudirman, Jakarta.'},
 {q:'Apa judul lagu yang memiliki versi JKT48 dan AKB48 ini?',a:'Heavy Rotation',other:['Flying High','Rapsodi','Magic Hour'],why:'Heavy Rotation merupakan salah satu lagu adaptasi JKT48 dari AKB48.'},
 {q:'Siapa artis yang merilis single Rapsodi pada 2020?',a:'JKT48',other:['AKB48','BNK48','MNL48'],why:'Rapsodi adalah single original JKT48 yang MV-nya dirilis pada Januari 2020.'},
];
