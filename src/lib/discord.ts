export type DiscordUser={id:string;name:string;username:string;avatar:string|null};
export type DiscordSession={authenticated:boolean;configured:boolean;user?:DiscordUser;csrf?:string;expires_at?:number};
export type DiscordGuild={id:string;name:string;icon:string|null;owner:boolean;installed:boolean};
export const NOTICE_KINDS=['live','news','theater','birthday'] as const;
export type NoticeKind=typeof NOTICE_KINDS[number];
export type Destination={channel_id:string;role_ids:string[]};
export type GuildSettings={routes:Record<NoticeKind,{enabled:boolean;channels:Destination[]}>;platforms:string[];banner_style:string;show_media:boolean};
export type GuildDetail={guild:{id:string;name:string;icon:string|null};channels:{id:string;name:string;can_send:boolean}[];roles:{id:string;name:string;mentionable:boolean;color:number}[];settings:GuildSettings;history:{kind:string;status:string;channel:string;title:string;url:string|null;error:string|null;updated:number}[]};
export async function discordCall<T>(path:string,options:{method?:string;body?:unknown;csrf?:string;signal?:AbortSignal}={}):Promise<T>{const response=await fetch('/api/discord'+path,{method:options.method||'GET',credentials:'same-origin',signal:options.signal,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.csrf?{'X-CSRF-Token':options.csrf}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});const value=await response.json();if(!response.ok)throw Object.assign(Error(value.message||'Permintaan belum berhasil. Coba kembali sebentar.'),{status:response.status});return value}
