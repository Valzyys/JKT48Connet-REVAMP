export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!(url.pathname.startsWith('/api/app/') || url.pathname === '/health' || url.pathname.startsWith('/downloads/') || url.pathname.startsWith('/payment/'))) {
      return Response.json({message:'Not found'}, {status:404});
    }
    if (!['GET','POST','HEAD'].includes(request.method)) return new Response(null,{status:405});
    const headers = new Headers(request.headers);
    headers.set('X-Stream-Bridge',env.STREAM_BRIDGE_SECRET);
    headers.set('X-Stream-Client-IP',request.headers.get('CF-Connecting-IP') || 'unknown');
    headers.delete('cookie'); headers.delete('host');
    const target = env.BRIDGE_ORIGIN + '/stream-app' + url.pathname + url.search;
    try {
      const upstream = await fetch(target, {method:request.method, headers, body:['GET','HEAD'].includes(request.method)?undefined:request.body, redirect:'manual'});
      const out = new Headers(upstream.headers);
      out.delete('server');out.delete('x-powered-by');out.delete('location');
      out.set('X-Content-Type-Options','nosniff'); out.set('Referrer-Policy','no-referrer');
      return new Response(upstream.body,{status:upstream.status,headers:out});
    } catch { return Response.json({message:'Layanan sedang belum dapat dihubungi.'},{status:503}); }
  }
};
