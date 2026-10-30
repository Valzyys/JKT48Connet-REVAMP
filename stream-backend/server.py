"""Private Kotlin app backend. No payment keys or origin stream URLs leave here."""
import asyncio
import base64
from collections import OrderedDict, defaultdict, deque
from contextlib import asynccontextmanager
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import re
import secrets
import time
from urllib.parse import quote, urljoin, urlparse

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from curl_cffi.requests import AsyncSession
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.responses import FileResponse,HTMLResponse
from pydantic import BaseModel, Field
import qrcode
from migrate import open_db, stamp

ROOT = Path(os.environ.get('STREAM_STATE_DIR', '/var/lib/jkt48connect-stream'))
BASE = os.environ.get('STREAM_PUBLIC_URL', 'https://stream.jkt48connect.app').rstrip('/')
UPSTREAM = os.environ.get('STREAM_DATA_URL', 'https://api.jkt48connect.app:8443').rstrip('/')
PLANS = {'weekly': ('Mingguan', 10000, 7), 'monthly': ('Bulanan', 20000, 30), 'yearly': ('Tahunan', 120000, 365), 'show': ('Tiket satu show', 4000, 0)}
cache = {}; locks = defaultdict(asyncio.Lock); events = defaultdict(asyncio.Event)
renewing = {}; known_images = set()
media_cache = OrderedDict(); inflight = {}; relays = {}
MEDIA_CACHE_BYTES = 64*1024*1024; MEDIA_ITEM_BYTES = 8*1024*1024
rates = defaultdict(deque)
db = None; http = None; cipher = None


def now(): return int(time.time())
def error(status, text): raise HTTPException(status, text)
def uid(): return secrets.token_urlsafe(24)
def digest(value): return hashlib.sha256(value.encode()).hexdigest()


def limit(key, maximum, period):
    queue = rates[key]; t = time.monotonic()
    while queue and queue[0] < t - period: queue.popleft()
    if len(queue) >= maximum: error(429, 'Terlalu banyak percobaan. Coba beberapa saat lagi.')
    queue.append(t)
    if len(rates) > 10000:
        for k in list(rates):
            if not rates[k] or rates[k][-1] < t - 3600: del rates[k]


async def cached(key, ttl, load, stale=0):
    """`stale` detik setelah kedaluwarsa: nilai lama langsung dikirim sambil diperbarui di latar (tanpa menunggu upstream)."""
    entry = cache.get(key)
    if entry and entry[0] > time.monotonic(): return entry[1]
    if entry and stale and entry[0] + stale > time.monotonic():
        if key not in renewing:
            async def renew():
                try:
                    async with locks[key]:
                        value = await load(); cache[key] = (time.monotonic()+ttl, value)
                except Exception: pass
                finally: renewing.pop(key, None)
            renewing[key] = asyncio.create_task(renew())
        return entry[1]
    async with locks[key]:
        if key in cache and cache[key][0] > time.monotonic(): return cache[key][1]
        value = await load(); cache[key] = (time.monotonic()+ttl, value); return value


async def upstream(path):
    async def load():
        r = await http.get(UPSTREAM+path, headers={'X-API-Key': os.environ['JKT48CONNECT_API_KEY']}, timeout=20, allow_redirects=False)
        if r.status_code != 200: error(502, 'Sumber data sedang belum tersedia. Coba lagi sebentar.')
        return r.json()
    # Detail theater & jadwal jarang berubah: disimpan lebih lama dan diperbarui di latar.
    if path.startswith(('/api/theater/', '/api/next_schedule')): return await cached(path, 600, load, stale=86400)
    return await cached(path, 5 if 'now_live' in path else 30, load)


def objects(value, *keys):
    if isinstance(value, list): return value
    for key in keys:
        if isinstance(value, dict) and isinstance(value.get(key), list): return value[key]
    return []


def design(item, key):
    for style in ('jkt48connect', 'photobook', 'avonera48'):
        value = item.get(key, {}).get(style, {}).get('banner', {})
        if value.get('status') == 'ready' and value.get('url'): return value['url']
    return ''


def image_url(url):
    if not url or not allowed(url):return ''
    ident=digest(url)
    # Katalog memanggil ini ratusan kali per permintaan: tulis ke SQLite hanya untuk URL baru.
    if ident not in known_images:
        db.execute('INSERT OR IGNORE INTO image_sources VALUES(?,?)',(ident,url));db.commit();known_images.add(ident)
    return BASE+'/api/app/image/'+ident


async def who(request: Request):
    bearer = request.headers.get('authorization', '')
    if not bearer.startswith('Bearer '): error(401, 'Silakan masuk terlebih dahulu.')
    token = bearer[7:]
    row = db.execute('SELECT u.*,s.token_hash AS sid FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?', (digest(token), now())).fetchone()
    if not row: error(401, 'Sesi berakhir. Silakan masuk kembali.')
    if row['banned']: error(403, 'Akun sedang dibatasi. Hubungi admin.')
    return dict(row)


def profile(user):
    active = [dict(r) for r in db.execute('SELECT kind,target,expires FROM entitlements WHERE user_id=? AND starts<=? AND expires>?', (user['id'], now(), now()))]
    return {'id': user['id'], 'email': user['email'], 'name': user['name'], 'avatar': user['avatar'], 'access': active}


def access(user, target):
    return bool(db.execute("SELECT 1 FROM entitlements WHERE user_id=? AND starts<=? AND expires>? AND (kind='membership' OR (kind='show' AND (target=? OR target IN(SELECT alias FROM show_aliases WHERE slug=?)))) LIMIT 1", (user['id'], now(), now(), target,target)).fetchone())


def authorize(user, kind, target):
    if kind == 'theater' and not access(user, target): error(403, 'Show ini memerlukan tiket atau membership yang aktif.')


def ticket(user, url, kind, target, expires=None):
    data = {'u': url, 'user': user['id'], 'sid': user['sid'], 'kind': kind, 'target': target, 'exp': expires or now()+21600}
    return BASE+'/api/app/media/'+cipher.encrypt(json.dumps(data).encode()).decode()


def allowed(url):
    p = urlparse(url); host = (p.hostname or '').lower()
    domains = ('api.jkt48connect.app', 'images.jkt48connect.com', 'st.avonera48.web.id', 'st.avonera48.id', 'showroom-live.com', 'showroom-cdn.com', 'cloudfront.net', 'live-video.net', 'idn.app', 'idn.media', 'jkt48.com', 'googleusercontent.com')
    return p.scheme == 'https' and not p.username and p.port in (None,443,8443) and any(host == d or host.endswith('.'+d) for d in domains)


def reveal(value, user):
    try: data = json.loads(cipher.decrypt(value.encode(), ttl=21660))
    except (InvalidToken, ValueError, TypeError): error(403, 'Tautan pemutar tidak valid.')
    if data.get('user') != user['id'] or data.get('sid') != user['sid'] or data.get('exp',0) <= now(): error(403, 'Tautan pemutar sudah berakhir. Buka ulang siaran.')
    authorize(user, data['kind'], data['target'])
    if not allowed(data['u']): error(403, 'Sumber media tidak diizinkan.')
    return data


async def fetch_media(url, headers):
    for _ in range(4):
        if not allowed(url): error(403, 'Sumber media tidak diizinkan.')
        r = await http.get(url, headers=headers, stream=True, timeout=30, allow_redirects=False)
        if r.status_code not in (301,302,303,307,308): return r, url
        following = urljoin(url, r.headers.get('Location','')); await r.aclose(); url = following
    error(502, 'Sumber media sedang bermasalah.')


@asynccontextmanager
async def lifespan(app):
    global db,http,cipher
    ROOT.mkdir(mode=0o700,parents=True,exist_ok=True)
    db = open_db(ROOT/'stream.sqlite')
    key = ROOT/'media.key'
    if not key.exists():
        fd = os.open(key,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(fd,'wb') as f: f.write(Fernet.generate_key())
    cipher = Fernet(key.read_bytes())
    # Banyak penonton = banyak segmen yang dialirkan bersamaan; pool kecil membuat permintaan antre (video lambat mulai).
    async with AsyncSession(max_clients=64, impersonate='chrome') as client:
        http = client
        task = asyncio.create_task(payment_loop())
        try: yield
        finally:
            task.cancel()
            for relay in list(relays.values()):
                if relay.task: relay.task.cancel()
            try: await task
            except asyncio.CancelledError: pass
            db.close()


app = FastAPI(title='JKT48Connect Stream', docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


@app.middleware('http')
async def protect(request, call_next):
    if request.url.path != '/health' and not hmac.compare_digest(request.headers.get('X-Stream-Bridge',''),os.environ.get('STREAM_BRIDGE_SECRET','UNCONFIGURED')):
        return JSONResponse({'message':'Not found'},status_code=404)
    try: response = await call_next(request)
    except Exception: return JSONResponse({'message':'Layanan sedang sibuk. Silakan coba lagi.'}, status_code=503)
    response.headers['Cache-Control']='no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='no-referrer'
    return response


@app.exception_handler(HTTPException)
async def known_error(request,exc): return JSONResponse({'message':exc.detail},status_code=exc.status_code)


@app.get('/health')
async def health(): return {'ok':True,'service':'jkt48connect-stream'}


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1,max_length=72)
    name: str = Field(default='',max_length=70)


async def authenticate(request, data, register=False):
    ip=request.headers.get('X-Stream-Client-IP',request.client.host)
    limit(('auth-ip',ip),15,900)
    email=data.email.strip().lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email): error(400,'Alamat email belum benar.')
    if len(data.password.encode())>72:error(400,'Password terlalu panjang. Gunakan maksimal 72 byte.')
    row=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
    if register:
        if len(data.password)<8:error(400,'Gunakan password minimal 8 karakter.')
        if row: error(409,'Email sudah terdaftar. Gunakan menu masuk.')
        if not data.name.strip(): error(400,'Isi nama panggilanmu terlebih dahulu.')
        password=await asyncio.to_thread(bcrypt.hashpw,data.password.encode(),bcrypt.gensalt(12))
        db.execute('INSERT INTO users(id,email,password_hash,name,avatar) VALUES(?,?,?,?,?)',(uid(),email,password.decode(),data.name.strip(),''));db.commit()
        row=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
    valid=False
    if row and row['password_hash'] and len(data.password.encode())<=72:
        try: valid=await asyncio.to_thread(bcrypt.checkpw,data.password.encode(),row['password_hash'].encode())
        except ValueError: pass
    if not valid: error(401,'Email atau password belum sesuai. Akun OAuth lama perlu pemulihan akun terlebih dahulu.')
    if row['banned']: error(403,'Akun sedang dibatasi. Hubungi admin.')
    token=uid()+uid();db.execute('INSERT INTO sessions VALUES(?,?,?)',(digest(token),row['id'],now()+30*86400));db.commit()
    return {'token':token,'user':profile(dict(row))}


@app.post('/api/app/auth/login')
async def login(data:Credentials,request:Request): return await authenticate(request,data)
@app.post('/api/app/auth/register')
async def register(data:Credentials,request:Request): return await authenticate(request,data,True)
@app.get('/api/app/me')
async def me(user=Depends(who)): return profile(user)
@app.post('/api/app/auth/logout')
async def logout(user=Depends(who)):
    db.execute('DELETE FROM sessions WHERE token_hash=?',(user['sid'],));db.commit();return {'ok':True}


async def lineup_for(show_id,title,scheduled,lineup):
    """Lineup dari detail theater (showId) atau dari jadwal berikutnya yang cocok tanggal & judulnya."""
    if re.fullmatch(r'SH[A-Z0-9]{2,20}',show_id):
        try:
            detail=await upstream('/api/theater/'+show_id)
            lineup=next(iter(objects(detail,'shows')),{}).get('members',lineup)
        except Exception:pass
    if not lineup:
        try:
            next_shows=await upstream('/api/next_schedule')
            for day in objects(next_shows,'schedules','shows','theater'):
                for entry in objects(day,'shows')or[day]:
                    entry_date=entry.get('date')or entry.get('start_date')or day.get('date')or''
                    if str(entry_date)[:10]==str(scheduled)[:10]and str(entry.get('title','')).split(' - ')[0].casefold()in title.casefold():
                        lineup=entry.get('members')or[]
                        code=str(entry.get('code')or entry.get('id')or'')
                        if not lineup and re.fullmatch(r'[A-Za-z0-9_-]{2,80}',code):
                            detail=await upstream('/api/theater/'+quote(code,safe=''))
                            lineup=next(iter(objects(detail,'shows')),{}).get('members',[])
        except Exception:pass
    return lineup


async def shows(fresh=False):
    """Katalog theater. Biasa: nilai cache langsung dikirim lalu diperbarui di latar. `fresh`: maksimal 30 detik (cek status live)."""
    async def load():
        url=os.environ.get('STREAM_SHOWS_URL','https://v5.jkt48connect.com/api/jkt48/idnplus')
        try:
            r=await http.get(url,timeout=15,allow_redirects=False)
            if r.status_code!=200: raise ValueError('unavailable')
            raw=r.json()
            items=objects(raw,'data','shows','livestreams','items','theater','schedules')
            if isinstance(raw,dict)and isinstance(raw.get('data'),dict):items=objects(raw['data'],'items','shows','livestreams','schedules')
            result=[];pending=[]
            for s in items:
                slug=str(s.get('slug') or s.get('live_slug') or s.get('id') or '')
                if not slug:continue
                show_id=str(s.get('showId')or'')
                if show_id:db.execute('INSERT INTO show_aliases VALUES(?,?) ON CONFLICT(alias) DO UPDATE SET slug=excluded.slug',(show_id,slug))
                title=s.get('title') or s.get('name') or 'JKT48 Theater'
                scheduled=s.get('start_date')or s.get('scheduled_at')or s.get('date')or''
                if isinstance(scheduled,(int,float)):
                    from datetime import datetime,timezone
                    scheduled=datetime.fromtimestamp(scheduled,timezone.utc).isoformat()
                pending.append(lineup_for(show_id,title,scheduled,s.get('members')or s.get('lineup')or[]))
                result.append({'id':slug,'kind':'theater','title':title,
                    'date':scheduled, 'image':s.get('image_url')or s.get('image')or s.get('thumbnail')or s.get('banner_url')or'',
                    'lineup':[], 'isLive':bool(s.get('is_live')or s.get('isLive')or str(s.get('status','')).lower()in('live','on_air')),
                    'price':4000,'source':'idnplus','showId':show_id})
            db.commit()
            # Lineup tiap show diambil bersamaan, bukan satu per satu.
            for show,lineup in zip(result,await asyncio.gather(*pending)):show['lineup']=lineup
            if result:return result
        except Exception:pass
        # Real archive snapshots are labeled as archives, never fabricated as live.
        result=[]
        for row in db.execute("SELECT data FROM legacy_rows WHERE schema_name='public' AND table_name='show_snapshots' ORDER BY row_no DESC LIMIT 40"):
            s=json.loads(row[0]);lineup=s.get('lineup')or'[]'
            try:lineup=json.loads(lineup)if isinstance(lineup,str)else lineup
            except ValueError:lineup=[]
            result.append({'id':s['slug'],'kind':'theater','title':s['title'],'date':s.get('scheduled_at')or s.get('show_date')or'',
                           'image':s.get('banner_url')or s.get('poster_url')or'','lineup':lineup,'isLive':False,'price':4000,'source':'archive'})
        return result
    return await cached('shows',30,load,stale=0 if fresh else 3600)


@app.get('/api/app/catalog')
async def catalog(user=Depends(who)):
    items=await shows()
    return {'items':[{**s,'image':image_url(s['image']),'lineup':[{**m,'img':image_url(m.get('img',''))}for m in s['lineup']if isinstance(m,dict)],'hasAccess':access(user,s['id'])}for s in items],'sourceAvailable':any(s.get('source')=='idnplus'for s in items)}


def live_id(s):
    return str(s.get('notification_data_id')or s.get('data_id')or s.get('slug')or s.get('room_id')or'')


@app.get('/api/app/live')
async def live(user=Depends(who)):
    raw=await upstream('/api/now_live');items=[]
    for s in objects(raw,'lives','data'):
        ident=live_id(s)
        if not ident:continue
        platform=str(s.get('type')or'').lower()
        # Tautan publik ke halaman live IDN, dipakai sebagai cadangan bila pemutar di aplikasi belum punya sumber.
        link=''
        if platform=='idn'and s.get('url_key')and s.get('slug'):
            link=f"https://www.idn.app/{quote(str(s['url_key']),safe='')}/live/{quote(str(s['slug']),safe='')}"
        # notification_caption: "🔴 Nama Lengkap — Judul live\nhttps://…"; judul live = bagian setelah " — ".
        head=str(s.get('notification_caption')or'').split('\n')[0].split(' — ',1)
        items.append({'id':ident,'kind':'live','title':s.get('name')or'Live member','subtitle':s.get('type',''),
                      'image':image_url(design(s,'notification_designs')or s.get('img')or s.get('img_alt')or''),
                      'avatar':image_url(s.get('img_alt')or s.get('img')or''),'liveTitle':head[1].strip()if len(head)>1 else'',
                      'date':s.get('started_at',''),'isLive':True,'lineup':[],'platform':platform,'link':link})
    return {'items':items}


def whole(value):
    try:return max(0,int(float(value)))
    except(TypeError,ValueError):return 0


@app.get('/api/app/recent')
async def recent(page:int=1,user=Depends(who)):
    if not 1<=page<=1000:error(400,'Halaman tidak valid.')
    raw=await upstream(f'/api/recent?page={page}&perpage=12&group=jkt48&type=all&sort=date&order=-1')
    items=[]
    for s in objects(raw,'recents'):
        info=s.get('live_info')or{};member=s.get('member')or s.get('room_info')or{}
        dates=info.get('date')or{};viewers=info.get('viewers')or{}
        items.append({'id':s['data_id'],'kind':'recent','title':member.get('name')or'Member JKT48',
                      'subtitle':s.get('type',''),'platform':str(s.get('type')or'').lower(),
                      'image':image_url(design(s,'leaderboard_designs')or member.get('img','')),
                      'avatar':image_url(member.get('img')or member.get('img_alt')or''),
                      'date':dates.get('end')or s.get('created_at',''),'start':dates.get('start',''),
                      'durationMs':whole(info.get('duration')),'viewers':whole(viewers.get('num')if isinstance(viewers,dict)else 0),
                      'lineup':[]})
    return {'items':items,'page':page,'total':raw.get('total_count',0)}


def picture(url):
    """Gambar publik: lewat proxy server bila domainnya diizinkan, selain itu URL https aslinya."""
    if not isinstance(url,str)or not url.startswith('https://'):return ''
    return image_url(url)or url


@app.get('/api/app/recent/{ident}')
async def recent_detail(ident:str,user=Depends(who)):
    """Rekap satu live (pola detail recent aplikasi 2.6.1 & website): statistik, supporter, gift, cuplikan, jumlah bagian rekaman."""
    if not re.fullmatch(r'[\w♥-]{1,180}',ident):error(400,'ID siaran tidak valid.')
    r=await upstream('/api/recent/'+quote(ident,safe=''))
    if not isinstance(r,dict)or not r:error(404,'Rekap live tidak ditemukan.')
    info=r.get('live_info')or{};member=r.get('member')or r.get('room_info')or{}
    dates=info.get('date')or{};viewers=info.get('viewers')or{};gift=info.get('gift')or{};comments=info.get('comments')or{};shot=info.get('screenshot')or{}
    platform=str(r.get('type')or'').lower()
    unit=str(r.get('point_unit')or('idn_gold'if platform=='idn'else'showroom_points'))
    # Showroom mengirim seluruh katalog gift; yang tidak terkirim di live ini (num 0) dibuang.
    gifts=sorted(({'name':str(g.get('name')),'img':''if g.get('image_available')is False else picture(g.get('img')),'num':whole(g.get('num')),'users':whole(g.get('user_count'))}
                  for g in objects(gift,'list')if isinstance(g,dict)and g.get('name')and whole(g.get('num'))>0),key=lambda g:-g['num'])
    fans=[{'name':str(f.get('name')),'avatar':picture(f.get('avatar_url')),'amount':whole(f.get('gold')or f.get('point')or f.get('fans_point')or f.get('reported_gold'))}
          for f in objects(r,'fans')if isinstance(f,dict)and f.get('name')]
    shots=[];base=str(shot.get('base_url')or'').rstrip('/');fmt=str(shot.get('format')or'jpg')
    if not re.fullmatch(r'[a-zA-Z0-9]{2,5}',fmt):fmt='jpg'
    if base.startswith('https://')and isinstance(shot.get('list'),list):
        shots=[picture(f'{base}/{t}.{fmt}')for t in shot['list'][:400]if re.fullmatch(r'[A-Za-z0-9_-]{1,64}',str(t))]
    recordings=[x for x in objects(r,'recordings')if isinstance(x,dict)and(x.get('stream_url')or x.get('url'))]
    return {'id':str(r.get('data_id')or ident),'kind':'recent','title':member.get('name')or'Member JKT48','platform':platform,
            'image':picture(design(r,'leaderboard_designs')or member.get('img')),'avatar':picture(member.get('img')or member.get('img_alt')),
            'start':dates.get('start',''),'date':dates.get('end')or r.get('created_at',''),
            'durationMs':whole(info.get('duration')),'viewers':whole(viewers.get('num')if isinstance(viewers,dict)else 0),
            'points':whole(r.get('points')or r.get('total_gifts')),'pointLabel':'Gold'if'gold'in unit else'Poin',
            'comments':whole(comments.get('num')),'commenters':whole(comments.get('users')),
            'gifts':gifts[:40],'giftsPartial':gift.get('status')=='partial'or gift.get('reason')=='gift_events_not_captured',
            'fans':fans[:20],'screenshots':[u for u in shots if u],'recordingCount':len(recordings)}


COMMENTS_WS=os.environ.get('STREAM_COMMENTS_WS')or'wss://'+UPSTREAM.split('://',1)[-1]
BLOCKED=(401,403,429)


def comment_source(s):
    """Kunci relay komentar: Showroom memakai room_id, IDN memakai data_id lengkap `idn-…`."""
    platform=str(s.get('type')or'').lower()
    if platform=='showroom':
        room=whole(s.get('room_id'))
        return('showroom',str(room))if room else None
    if platform=='idn':
        ident=next((str(v)for v in(s.get('notification_data_id'),s.get('data_id'))if str(v or'').startswith('idn-')),'')
        return('idn',ident)if re.fullmatch(r'idn-[A-Za-z0-9_-]{1,120}',ident)else None
    return None


class Relay:
    """Satu koneksi WebSocket komentar per siaran, dibagi semua penonton aplikasi (upstream membatasi 4 koneksi per key).
    Berhenti sendiri 90 detik setelah tidak ada penonton yang meminta."""
    def __init__(self,platform,ident):
        self.platform=platform;self.ident=ident;self.key=f'{platform}:{ident}'
        self.items=deque(maxlen=150);self.cursor=0;self.status='connecting'
        self.seen=time.monotonic();self.wake=asyncio.Event();self.task=None

    @property
    def path(self):return f"/api/{self.platform}-comments/{quote(self.ident,safe='')}"

    def notify(self):
        self.wake.set();self.wake=asyncio.Event()

    def feed(self,event):
        if not isinstance(event,dict):return
        status=str(event.get('status')or self.status)[:20];changed=status!=self.status;self.status=status
        comments=[x for x in event.get('comments')or[]if isinstance(x,dict)]
        for c in sorted(comments,key=lambda x:whole(x.get('sequence'))):
            seq=whole(c.get('sequence'));text=str(c.get('comment')or'').strip()
            if seq<=self.cursor:continue
            self.cursor=seq
            if not text:continue
            user=c.get('user')if isinstance(c.get('user'),dict)else{}
            avatar=user.get('avatar_url')
            self.items.append({'id':seq,'name':str(user.get('name')or'Penonton')[:60],'message':text[:300],
                               'avatar':avatar if isinstance(avatar,str)and avatar.startswith('https://')else'',
                               'at':str(c.get('source_time')or c.get('observed_at')or'')})
            changed=True
        if changed:self.notify()

    def idle(self):return time.monotonic()-self.seen>=90

    async def snapshot(self):
        r=await http.get(UPSTREAM+self.path+(f'?after={self.cursor}'if self.cursor else''),headers={'X-API-Key':os.environ['JKT48CONNECT_API_KEY']},timeout=15,allow_redirects=False)
        if r.status_code==200:self.feed(r.json())
        return r.status_code

    async def run(self):
        import websockets
        from websockets.asyncio.client import connect
        delay=1
        try:
            while not self.idle():
                url=COMMENTS_WS+self.path+'/stream'+(f'?after={self.cursor}'if self.cursor else'')
                try:
                    async with connect(url,additional_headers={'X-API-Key':os.environ['JKT48CONNECT_API_KEY']},
                                                  ping_interval=20,ping_timeout=20,open_timeout=15,max_size=1<<20)as ws:
                        delay=1
                        while not self.idle():
                            try:raw=await asyncio.wait_for(ws.recv(),30)
                            except asyncio.TimeoutError:continue
                            if isinstance(raw,str)and raw!='PONG':
                                try:self.feed(json.loads(raw))
                                except ValueError:pass
                except asyncio.CancelledError:raise
                except Exception as e:
                    # Upstream memutus tiap 15 menit (perbarui autentikasi) atau sedang gangguan: sambung ulang dengan jeda.
                    # Selama jeda, komentar tetap diambil dari snapshot tiap 3 detik.
                    code=getattr(getattr(e,'response',None),'status_code',None)
                    if not isinstance(e,websockets.ConnectionClosedOK):self.status='reconnecting';self.notify()
                    until=time.monotonic()+(60 if code in BLOCKED else delay);delay=min(30,delay*2)
                    while time.monotonic()<until and not self.idle():
                        if code not in BLOCKED:
                            try:code=await self.snapshot()
                            except Exception:pass
                        await asyncio.sleep(3)
        finally:
            if relays.get(self.key)is self:relays.pop(self.key,None)


def relay_for(platform,ident):
    relay=relays.get(f'{platform}:{ident}')
    if relay is None:
        relay=Relay(platform,ident);relays[relay.key]=relay
        relay.task=asyncio.create_task(relay.run())
    relay.seen=time.monotonic()
    return relay


@app.get('/api/app/live/{ident}/comments')
async def live_comments(ident:str,after:int=0,wait:int=0,user=Depends(who)):
    """Komentar live Showroom/IDN (hanya baca) dari relay JKT48Connect; long-poll seperti obrolan theater."""
    if not re.fullmatch(r'[\w♥-]{1,180}',ident):error(400,'ID siaran tidak valid.')
    limit(f"comments:{user['id']}",120,60)
    raw=await upstream('/api/now_live')
    source=next((s for s in objects(raw,'lives','data')if live_id(s)==ident),None)
    target=comment_source(source)if source else None
    if not target:return {'items':[],'cursor':after,'status':'ended'if source is None else'unavailable'}
    relay=relay_for(*target)
    # Urutan upstream dimulai ulang (live baru di room yang sama): kirim ulang dari awal buffer.
    if after>relay.cursor and relay.items:after=0
    pending=relay.wake
    items=[x for x in relay.items if x['id']>after]
    if not items and wait>0:
        try:await asyncio.wait_for(pending.wait(),min(wait,20))
        except asyncio.TimeoutError:pass
        relay.seen=time.monotonic()
        items=[x for x in relay.items if x['id']>after]
    return {'items':items[-50:]if after<=0 else items[-100:],'cursor':max(after,relay.cursor),'status':relay.status}


@app.post('/api/app/playback/{kind}/{ident}')
async def playback(kind:str,ident:str,user=Depends(who)):
    if not re.fullmatch(r'[\w♥-]{1,180}',ident):error(400,'ID siaran tidak valid.')
    authorize(user,kind,ident)
    files=[];title=''
    if kind=='theater':
        show=next((s for s in await shows(fresh=True)if s['id']==ident),None)
        if not show:error(404,'Show tidak ditemukan.')
        if show.get('source')!='idnplus':error(409,'Jadwal ini masih berupa arsip. Katalog siaran langsung belum tersedia.')
        if not show.get('isLive'):error(409,'Show belum dimulai. Aksesmu tetap tersimpan untuk jadwal ini.')
        files=[{'url':os.environ.get('STREAM_ORIGIN','https://st.avonera48.web.id').rstrip('/')+'/stream/'+quote(ident,safe=''),'hls':True}];title=show['title']
    elif kind=='recent':
        raw=await upstream('/api/recent/'+quote(ident,safe=''))
        title=raw.get('room_info',{}).get('name','Replay JKT48')
        files=[{'url':x.get('stream_url')or x.get('url'),'hls':bool(x.get('stream_url'))}for x in objects(raw,'recordings') if x.get('stream_url')or x.get('url')]
    elif kind=='live':
        raw=await upstream('/api/now_live')
        source=next((s for s in objects(raw,'lives','data') if live_id(s)==ident),None)
        if not source:error(404,'Siaran sudah selesai.')
        title=source.get('name','Live JKT48')
        urls=source.get('streaming_url_list')or[]
        files=[{'url':s['url'],'hls':True}for s in urls if s.get('type')=='hls'and s.get('url')]
        if not files and source.get('type')=='idn':
            # Same public watch route as the collector; no account token in APK.
            watch=await upstream('/api/watch/'+quote(str(source.get('url_key')or source.get('room_url_key')or''),safe='')+'/idn')
            candidate=watch.get('stream_url')or watch.get('playback_url')or watch.get('url')
            if candidate:files=[{'url':candidate,'hls':True}]
        elif not files:
            watch=await upstream('/api/watch/'+quote(str(source.get('room_url_key')or source.get('url_key')or''),safe=''))
            files=[{'url':s['url'],'hls':True}for s in watch.get('streaming_url_list',[])if s.get('type')=='hls'and s.get('url')]
    else:error(404,'Jenis siaran tidak ditemukan.')
    files=[x for x in files if allowed(x['url'])]
    if not files:error(409,'Rekaman atau sumber siaran belum tersedia. Coba lagi sebentar.')
    # Live member Showroom/IDN adalah siaran publik: diputar langsung dari CDN-nya (tanpa singgah di server ini)
    # supaya cepat mulai dan tidak tersendat. Theater (berbayar) dan replay tetap lewat tiket media.
    direct=kind=='live'
    return {'title':title,'kind':kind,'items':[{'url':x['url']if direct else ticket(user,x['url'],kind,ident),'hls':x['hls'],'label':f"Bagian {i+1}"}for i,x in enumerate(files)]}


def is_playlist(content_type,url):
    return 'mpegurl'in content_type.lower()or urlparse(url).path.endswith('.m3u8')or '/stream/'in urlparse(url).path


def retarget(body,url,user,data):
    """Playlist: setiap URI (variant, segmen, key, map) diganti tiket yang terikat sesi penonton ini."""
    if not bytes(body).lstrip().startswith(b'#EXTM3U'):error(502,'Playlist siaran belum tersedia.')
    out=[]
    for line in bytes(body).decode().splitlines():
        if not line.startswith('#')and line.strip():line=ticket(user,urljoin(url,line.strip()),data['kind'],data['target'],data['exp'])
        else:line=re.sub(r'URI="([^"]+)"',lambda m:'URI="'+ticket(user,urljoin(url,m[1]),data['kind'],data['target'],data['exp'])+'"',line)
        out.append(line)
    return Response('\n'.join(out)+'\n',media_type='application/vnd.apple.mpegurl',headers={'Cache-Control':'no-store'})


async def load_media(url):
    r,final=await fetch_media(url,{})
    try:
        if r.status_code!=200:return (0,r.status_code,'',b'',final)
        content_type=r.headers.get('Content-Type','application/octet-stream').split(';')[0]
        body=bytearray()
        async for chunk in r.aiter_content():
            body.extend(chunk)
            if len(body)>MEDIA_ITEM_BYTES:return None
    finally:await r.aclose()
    value=(time.monotonic()+(1.0 if is_playlist(content_type,final)else 120.0),200,content_type,bytes(body),final)
    media_cache[url]=value
    total=sum(len(v[3])for v in media_cache.values())
    while total>MEDIA_CACHE_BYTES and media_cache:
        _,old=media_cache.popitem(last=False);total-=len(old[3])
    return value


async def shared_media(url):
    """Theater: semua penonton meminta playlist & segmen yang sama. Diambil sekali dari origin lalu dibagi
    (playlist 1 detik, segmen 2 menit, total maks. 64 MB). None = terlalu besar untuk disimpan."""
    hit=media_cache.get(url)
    if hit and hit[0]>time.monotonic():
        media_cache.move_to_end(url);return hit
    task=inflight.get(url)
    if task is None:
        # Task terpisah: penonton yang memutus koneksi tidak membatalkan unduhan penonton lain.
        task=inflight[url]=asyncio.create_task(load_media(url))
        task.add_done_callback(lambda _:inflight.pop(url,None))
    return await asyncio.shield(task)


@app.get('/api/app/media/{opaque}')
async def media(opaque:str,request:Request,user=Depends(who)):
    data=reveal(opaque,user);headers={}
    if data['kind']=='theater'and 'range'not in request.headers:
        hit=await shared_media(data['u'])
        if hit is not None:
            _,status,content_type,body,url=hit
            if status!=200:error(502,'Sumber siaran belum dapat diputar.' if status!=404 else 'Bagian siaran belum tersedia.')
            if is_playlist(content_type,url):return retarget(body,url,user,data)
            return Response(body,media_type=content_type)
    if 'range'in request.headers:
        value=request.headers['range']
        if not re.fullmatch(r'bytes=\d*-\d*',value):error(416,'Range tidak valid.')
        headers['Range']=value
    r,url=await fetch_media(data['u'],headers)
    if r.status_code not in (200,206):
        status=r.status_code;await r.aclose();error(502,'Sumber siaran belum dapat diputar.' if status!=404 else 'Bagian siaran belum tersedia.')
    content_type=r.headers.get('Content-Type','application/octet-stream').split(';')[0]
    if is_playlist(content_type,url):
        body=bytearray()
        async for chunk in r.aiter_content():
            body.extend(chunk)
            if len(body)>2*1024*1024:await r.aclose();error(502,'Playlist terlalu besar.')
        await r.aclose()
        return retarget(body,url,user,data)
    out={k:r.headers[k]for k in ('Content-Length','Content-Range','Accept-Ranges')if k in r.headers}
    async def chunks():
        try:
            async for chunk in r.aiter_content(chunk_size=65536):yield chunk
        finally:await r.aclose()
    return StreamingResponse(chunks(),status_code=r.status_code,media_type=content_type,headers=out)


@app.get('/api/app/image/{ident}')
async def image(ident:str,user=Depends(who)):
    row=db.execute('SELECT url FROM image_sources WHERE id=?',(ident,)).fetchone()
    if not row:error(404,'Gambar tidak ditemukan.')
    r,_=await fetch_media(row[0],{'Referer':'https://jkt48.com/'})
    content_type=r.headers.get('Content-Type','').split(';')[0]
    if r.status_code!=200 or not content_type.startswith('image/'):
        await r.aclose();error(502,'Gambar belum tersedia.')
    data=bytearray()
    async for chunk in r.aiter_content():
        data.extend(chunk)
        if len(data)>12*1024*1024:await r.aclose();error(413,'Gambar terlalu besar.')
    await r.aclose()
    return Response(bytes(data),media_type=content_type)


@app.get('/api/app/plans')
async def plans(user=Depends(who)):return {'items':[{'id':key,'name':v[0],'price':v[1],'days':v[2]}for key,v in PLANS.items()if key!='show']}


class Checkout(BaseModel):
    plan:str=Field(max_length=20)
    target:str=Field(default='',max_length=180)
    request_id:str=Field(pattern=r'^[a-zA-Z0-9-]{8,64}$')


async def gateway(method,path,body=None):
    r=await http.request(method,'https://pg.jkt48connect.app/api/v1/transactions'+path,
                         headers={'X-API-Key':os.environ['STREAM_PG_API_KEY']},json=body,timeout=20,allow_redirects=False)
    if r.status_code not in (200,201):error(502,'Pembayaran belum dapat diproses. Tagihanmu tetap tersimpan; coba cek status kembali.')
    data=r.json().get('data',{})
    if not isinstance(data,dict):error(502,'Respons pembayaran belum sesuai.')
    return data


@app.post('/api/app/checkout')
async def checkout(data:Checkout,user=Depends(who)):
    limit(('checkout',user['id']),8,300)
    if data.plan not in PLANS:error(400,'Paket tidak ditemukan.')
    if data.plan=='show':
        show=next((s for s in await shows()if s['id']==data.target and s.get('source')=='idnplus'),None)
        if not show:error(409,'Tiket untuk show ini belum tersedia.')
        if access(user,data.target):error(409,'Kamu sudah memiliki akses untuk show ini.')
    ident='stream-'+digest(user['id']+':'+data.request_id)[:40]
    existing=db.execute('SELECT * FROM payments WHERE id=?',(ident,)).fetchone()
    if existing and(existing['plan']!=data.plan or existing['target']!=data.target):error(409,'Permintaan pembayaran berbeda. Buka ulang halaman pembayaran.')
    if existing and existing['gateway_id']:return public_payment(existing)
    amount=PLANS[data.plan][1]
    if not existing:
        db.execute('INSERT INTO payments(id,user_id,plan,target,amount,status,document,created) VALUES(?,?,?,?,?,?,?,?)',(ident,user['id'],data.plan,data.target,amount,'creating','{}',now()));db.commit()
    value=await gateway('POST','',{'amount':amount,'reference':ident,'description':'JKT48Connect Stream · '+PLANS[data.plan][0],'expires_in':900,'return_url':BASE+'/payment/'+ident})
    if value.get('reference')!=ident or value.get('amount')!=amount:error(502,'Nominal pembayaran belum sesuai.')
    db.execute('UPDATE payments SET gateway_id=?,status=?,document=? WHERE id=?',(value['id'],value['status'],json.dumps(value),ident));db.commit()
    return public_payment(db.execute('SELECT * FROM payments WHERE id=?',(ident,)).fetchone())


def public_payment(row):
    doc=json.loads(row['document'])
    return {'id':row['id'],'status':row['status'],'amount':row['amount'],'total':doc.get('amount_total',row['amount']),
            'expiresAt':doc.get('expires_at',''),'payUrl':doc.get('pay_url',''),'qr':BASE+'/api/app/payments/'+row['id']+'/qr.png','plan':row['plan']}


def legacy_payment(item):
    return {'id':'legacy-'+item['id'],'status':item.get('status',''),'amount':int(item.get('amount')or 0),
            'total':int(item.get('final_amount')or item.get('amount')or 0),'plan':item.get('kind',''),
            'legacy':True,'qr':'','payUrl':'','expiresAt':'','date':item.get('created_at','')}


def legacy_payments(user):
    return [legacy_payment(json.loads(r[0]))for r in db.execute("SELECT data FROM legacy_rows WHERE schema_name='public' AND table_name='purchases' AND json_extract(data,'$.user_id')=? AND json_extract(data,'$.kind') IN('membership','show') ORDER BY row_no DESC LIMIT 50",(user['id'],))]


async def refresh_payment(row):
    if not row['gateway_id']or row['status']not in('pending','creating'):return
    value=await gateway('GET','/'+quote(row['gateway_id'],safe=''))
    if value.get('id')!=row['gateway_id']or value.get('reference')!=row['id']or value.get('amount')!=row['amount']:error(502,'Verifikasi tagihan belum sesuai.')
    state=value.get('status')
    if state not in('pending','paid','expired','cancelled'):return
    db.execute('BEGIN IMMEDIATE')
    try:
        current=db.execute('SELECT status FROM payments WHERE id=?',(row['id'],)).fetchone()[0]
        if current=='paid':db.rollback();return
        if state=='paid':
            days=PLANS[row['plan']][2]
            start=now()
            if days:
                previous=db.execute("SELECT MAX(expires) FROM entitlements WHERE user_id=? AND kind='membership'",(row['user_id'],)).fetchone()[0]or 0
                start=max(start,previous)
            db.execute('INSERT OR IGNORE INTO entitlements VALUES(?,?,?,?,?,?)',(row['id'],row['user_id'],'membership'if days else'show','*'if days else row['target'],start,start+days*86400 if days else 4102444800))
            db.execute('INSERT INTO notices(user_id,title,message,created) VALUES(?,?,?,?)',(row['user_id'],'Pembayaran berhasil','Akses '+PLANS[row['plan']][0]+' sudah aktif.',now()))
        db.execute('UPDATE payments SET status=?,document=?,checked=? WHERE id=?',(state,json.dumps(value),now(),row['id']));db.commit()
    except BaseException:db.rollback();raise


async def payment_loop():
    while True:
        # Gateway remains authoritative, including when the Android app closes.
        for row in db.execute("SELECT * FROM payments WHERE status='pending' AND checked<? ORDER BY checked LIMIT 20",(now()-3,)).fetchall():
            try:await refresh_payment(row)
            except Exception:
                db.execute('UPDATE payments SET checked=? WHERE id=?',(now(),row['id']));db.commit()
        db.execute('DELETE FROM sessions WHERE expires<?',(now(),));db.commit()
        await asyncio.sleep(4)


@app.get('/api/app/payments')
async def payments(user=Depends(who)):return {'items':[public_payment(r)for r in db.execute('SELECT * FROM payments WHERE user_id=? ORDER BY created DESC LIMIT 50',(user['id'],))]+legacy_payments(user)}
@app.get('/api/app/payments/{ident}')
async def payment(ident:str,user=Depends(who)):
    if ident.startswith('legacy-'):
        item=next((p for p in legacy_payments(user)if p['id']==ident),None)
        if not item:error(404,'Tagihan tidak ditemukan.')
        return item
    row=db.execute('SELECT * FROM payments WHERE id=? AND user_id=?',(ident,user['id'])).fetchone()
    if not row:error(404,'Tagihan tidak ditemukan.')
    return public_payment(row)
@app.get('/api/app/payments/{ident}/qr.png')
async def payment_qr(ident:str,user=Depends(who)):
    row=db.execute('SELECT document FROM payments WHERE id=? AND user_id=?',(ident,user['id'])).fetchone()
    if not row:error(404,'Tagihan tidak ditemukan.')
    value=json.loads(row[0]).get('qris_string','')
    if not value:error(409,'QRIS belum tersedia.')
    buf=io.BytesIO();qrcode.make(value).save(buf,format='PNG');return Response(buf.getvalue(),media_type='image/png')


@app.get('/api/app/notices')
async def notices(user=Depends(who)):return {'items':[dict(r)for r in db.execute('SELECT id,title,message,created FROM notices WHERE user_id=? ORDER BY id DESC LIMIT 30',(user['id'],))]}


class Message(BaseModel):
    message:str=Field(min_length=1,max_length=500)


@app.get('/api/app/chat/{room}')
async def chat(room:str,after:int=0,wait:int=0,user=Depends(who)):
    if not re.fullmatch(r'[\w-]{1,180}',room):error(400,'Ruang tidak valid.')
    authorize(user,'theater',room)
    def messages():
        # Penonton baru (after=0) langsung mendapat 50 pesan terakhir, bukan pesan tertua.
        if after<=0:rows=reversed(db.execute('SELECT * FROM chat WHERE room=? ORDER BY id DESC LIMIT 50',(room,)).fetchall())
        else:rows=db.execute('SELECT * FROM chat WHERE room=? AND id>? ORDER BY id LIMIT 100',(room,after))
        return [chat_item(r,user)for r in rows]
    event=events[room];event.clear();items=messages()
    if not items and wait:
        try:await asyncio.wait_for(event.wait(),min(max(wait,0),20))
        except asyncio.TimeoutError:pass
        items=messages()
    return {'items':items}
def chat_item(row,user):
    # user_id tidak dikirim ke klien; cukup penanda apakah pesan ini milik penonton yang meminta.
    return {'id':row['id'],'name':row['name'],'message':row['message'],'created':row['created'],'mine':row['user_id']==user['id']}
@app.post('/api/app/chat/{room}')
async def send_chat(room:str,data:Message,user=Depends(who)):
    if not re.fullmatch(r'[\w-]{1,180}',room):error(400,'Ruang tidak valid.')
    authorize(user,'theater',room);limit(('chat',user['id']),12,30)
    text=data.message.strip()
    if not text:error(400,'Pesan masih kosong.')
    cur=db.execute('INSERT INTO chat(room,user_id,name,message,created) VALUES(?,?,?,?,?)',(room,user['id'],user['name'],text,now()));db.commit()
    # Bangunkan semua long-poll di ruang ini: pesan langsung tampil ke penonton lain.
    events[room].set()
    row=db.execute('SELECT * FROM chat WHERE id=?',(cur.lastrowid,)).fetchone()
    return {'ok':True,'item':chat_item(row,user)}


@app.get('/api/app/update')
async def update():
    p=ROOT/'release.json'
    return json.loads(p.read_text())if p.exists()else{'version':'1.0.0','code':1,'apk':'','notes':''}


@app.get('/downloads/JKT48Connect-Stream.apk')
async def apk():
    path=ROOT/'JKT48Connect-Stream.apk'
    if not path.exists():error(404,'APK belum dipublikasikan.')
    return FileResponse(path,filename='JKT48Connect-Stream.apk',media_type='application/vnd.android.package-archive')


@app.get('/payment/{ident}')
async def payment_return(ident:str):
    return HTMLResponse('<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JKT48Connect Stream</title><body style="font-family:system-ui;background:#f4f4f8;padding:10vw;max-width:600px"><h1>Kembali ke tempatmu.</h1><p>Buka kembali JKT48Connect Stream untuk melihat status pembayaran. Server akan mengaktifkan akses setelah pembayaran dikonfirmasi.</p></body></html>')
