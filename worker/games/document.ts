/** Permit embedding only the Activity document; ordinary website pages retain DENY. */
export async function activityDocument(request:Request,assets:{fetch(request:Request):Promise<Response>},clientId:string){
 const response=await assets.fetch(new Request(new URL('/',request.url),request));const headers=new Headers(response.headers);
 headers.delete('X-Frame-Options');headers.set('Cache-Control','private, no-store');
 const ancestors='frame-ancestors https://discord.com https://*.discord.com https://discordapp.com https://*.discordapp.com';
 let csp=headers.get('Content-Security-Policy')||"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'";
 csp=/frame-ancestors\s[^;]+/.test(csp)?csp.replace(/frame-ancestors\s[^;]+/,ancestors):csp+'; '+ancestors;
 const websocket=`wss://jkt48connect.app wss://${clientId}.discordsays.com wss://${clientId}.discordsez.com`;
 csp=csp.replace(/connect-src\s([^;]+)/,(_all,values)=>'connect-src '+values+' '+websocket);headers.set('Content-Security-Policy',csp);
 return new Response(response.body,{status:response.status,headers});
}
