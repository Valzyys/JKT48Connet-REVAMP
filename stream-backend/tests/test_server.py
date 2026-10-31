import asyncio,json,os,sys,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]))
from cryptography.fernet import Fernet
import server as s
from migrate import open_db,decode_copy,stamp,activate

class PolicyTests(unittest.TestCase):
 def test_postgres_timezone_and_copy_escaping(self):
  self.assertGreater(stamp('2026-10-24 11:57:36.834479+00'),0)
  self.assertIsNone(decode_copy(r'\N'));self.assertEqual(decode_copy(r'a\tb\nline\\slash'),'a\tb\nline\\slash')
 def test_fixed_prices_and_duration(self):
  self.assertEqual({k:v[1]for k,v in s.PLANS.items()},{'weekly':10000,'monthly':20000,'yearly':120000,'show':4000})
 def test_origin_allowlist_cannot_escape_to_internal_or_credentials(self):
  for value in ('http://127.0.0.1/','https://api.jkt48connect.app.evil.test/','https://user:pass@api.jkt48connect.app/','https://api.jkt48connect.app:9000/'):
   self.assertFalse(s.allowed(value))
  self.assertTrue(s.allowed('https://st.avonera48.web.id/stream/show'))
 def test_imported_access_preserves_expiry_revocation_and_null_expiry(self):
  with tempfile.TemporaryDirectory()as tmp:
   d=open_db(Path(tmp)/'state.sqlite')
   rows=[('memberships',{'id':'m1','user_id':'u1','starts_at':'2026-10-01 10:00:00+00','expires_at':'2026-12-01 10:00:00+00','is_active':'t','revoked_at':None}),('memberships',{'id':'m2','user_id':'u1','starts_at':'2026-10-01 10:00:00+00','expires_at':'2026-12-01 10:00:00+00','is_active':'t','revoked_at':'2026-10-02 10:00:00+00'}),('live_access',{'id':'a1','user_id':'u1','show_id':'slug','granted_at':'2026-10-01 10:00:00+00','expires_at':None})]
   for i,(t,r)in enumerate(rows):d.execute('insert into legacy_rows values(?,?,?,?)',('public',t,i,json.dumps(r)))
   activate(d);activate(d)
   self.assertEqual(d.execute('select count(*)from entitlements').fetchone()[0],2)
   self.assertEqual(d.execute("select expires from entitlements where id='legacy-access:a1'").fetchone()[0],4102444800);d.close()

class ServerTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.tmp=tempfile.TemporaryDirectory();s.db=open_db(Path(self.tmp.name)/'state.sqlite');s.cipher=Fernet(Fernet.generate_key());s.rates.clear()
  self.u={'id':'u1','sid':'session1','name':'Test'}
 async def asyncTearDown(self):s.db.close();self.tmp.cleanup()
 async def test_membership_and_ticket_access_are_account_scoped(self):
  s.db.execute('insert into entitlements values(?,?,?,?,?,?)',('e','u1','show','show-code',0,s.now()+3600));s.db.execute('insert into show_aliases values(?,?)',('show-code','slug'))
  self.assertTrue(s.access(self.u,'slug'));self.assertFalse(s.access({'id':'u2'},'slug'));self.assertFalse(s.access(self.u,'other'))
  with self.assertRaises(s.HTTPException):s.authorize(self.u,'theater','other')
 async def test_media_tickets_bind_user_session_and_entitlement(self):
  s.db.execute('insert into entitlements values(?,?,?,?,?,?)',('e','u1','membership','*',0,s.now()+3600))
  opaque=s.ticket(self.u,'https://st.avonera48.web.id/stream/show','theater','show').rsplit('/',1)[1]
  self.assertEqual(s.reveal(opaque,self.u)['target'],'show')
  for user in ({**self.u,'sid':'stolen-other-session'},{**self.u,'id':'u2'}):
   with self.assertRaises(s.HTTPException):s.reveal(opaque,user)
  s.db.execute('delete from entitlements')
  with self.assertRaises(s.HTTPException):s.reveal(opaque,self.u)
 async def test_paid_transaction_is_verified_and_granted_once(self):
  value={'id':'pg1','reference':'order1','amount':10000,'amount_total':10127,'status':'paid'}
  s.db.execute('insert into payments values(?,?,?,?,?,?,?,?,?,?)',('order1','u1','weekly','',10000,'pg1','pending','{}',s.now(),0));s.db.commit()
  async def gateway(*args,**kwargs):return value
  with patch.object(s,'gateway',gateway):
   row=s.db.execute('select *from payments').fetchone();await s.refresh_payment(row);await s.refresh_payment(row)
  self.assertEqual(s.db.execute('select count(*)from entitlements').fetchone()[0],1)
  self.assertEqual(s.db.execute('select count(*)from notices').fetchone()[0],1)
  exp=s.db.execute('select expires-starts from entitlements').fetchone()[0];self.assertEqual(exp,7*86400)
 async def test_mismatched_gateway_amount_never_grants_access(self):
  s.db.execute('insert into payments values(?,?,?,?,?,?,?,?,?,?)',('order1','u1','yearly','',120000,'pg1','pending','{}',s.now(),0));s.db.commit()
  async def gateway(*a,**k):return {'id':'pg1','reference':'order1','amount':10000,'status':'paid'}
  with patch.object(s,'gateway',gateway):
   with self.assertRaises(s.HTTPException):await s.refresh_payment(s.db.execute('select *from payments').fetchone())
  self.assertEqual(s.db.execute('select count(*)from entitlements').fetchone()[0],0)
 async def test_chat_rate_limit_is_bounded(self):
  for _ in range(12):s.limit(('chat','u1'),12,30)
  with self.assertRaises(s.HTTPException):s.limit(('chat','u1'),12,30)
 async def test_live_list_marks_idn_and_showroom_with_watch_link(self):
  raw={'lives':[
   {'notification_data_id':'idn-1','name':'IDN member','type':'idn','url_key':'mem one','slug':'live-1',
    'img_alt':'https://images.jkt48connect.com/a.jpg','notification_caption':'🔴 Member Satu — Ngobrol santai\nhttps://www.idn.app/x'},
   {'notification_data_id':'sr-1','name':'Showroom member','type':'showroom','streaming_url_list':[]}]}
  async def upstream(path):return raw
  with patch.object(s,'upstream',upstream):
   items=(await s.live(self.u))['items']
  idn,showroom=items
  self.assertEqual((idn['platform'],idn['link']),('idn','https://www.idn.app/mem%20one/live/live-1'))
  self.assertEqual((showroom['platform'],showroom['link']),('showroom',''))
  self.assertEqual((idn['liveTitle'],showroom['liveTitle']),('Ngobrol santai',''))
  self.assertTrue(idn['avatar'].startswith(s.BASE+'/api/app/image/'));self.assertEqual(showroom['avatar'],'')
 async def test_recent_list_carries_duration_viewers_and_platform(self):
  raw={'recents':[
   {'data_id':'r1','type':'idn','member':{'name':'Member Satu','img':'https://images.jkt48connect.com/m.jpg'},
    'live_info':{'duration':5400000.0,'viewers':{'num':'1234'},'date':{'start':'2026-10-01T10:00:00Z','end':'2026-10-01T11:30:00Z'}}},
   {'data_id':'r2','type':'showroom','room_info':{'name':'Member Dua'},'live_info':{'viewers':None},'created_at':'2026-10-02T00:00:00Z'}],
   'total_count':2}
  async def upstream(path):return raw
  with patch.object(s,'upstream',upstream):
   items=(await s.recent(1,self.u))['items']
  first,second=items
  self.assertEqual((first['platform'],first['durationMs'],first['viewers'],first['start']),('idn',5400000,1234,'2026-10-01T10:00:00Z'))
  self.assertEqual((second['title'],second['durationMs'],second['viewers'],second['date']),('Member Dua',0,0,'2026-10-02T00:00:00Z'))
 async def test_chat_message_reaches_waiting_viewer_at_once_and_marks_own(self):
  for e,u in (('e1','u1'),('e2','u2')):s.db.execute('insert into entitlements values(?,?,?,?,?,?)',(e,u,'membership','*',0,s.now()+3600))
  other={'id':'u2','sid':'session2','name':'Penonton lain'}
  waiter=asyncio.create_task(s.chat('show',0,20,other))
  await asyncio.sleep(0.05);self.assertFalse(waiter.done())
  sent=await s.send_chat('show',s.Message(message='Halo semua'),self.u)
  got=await asyncio.wait_for(waiter,1)
  self.assertEqual((sent['item']['message'],sent['item']['mine']),('Halo semua',True))
  self.assertEqual([(m['message'],m['mine'])for m in got['items']],[('Halo semua',False)])
  self.assertNotIn('user_id',got['items'][0])
 async def test_new_viewer_gets_latest_chat_messages(self):
  for i in range(60):s.db.execute('insert into chat(room,user_id,name,message,created) values(?,?,?,?,?)',('show','u9','X',f'pesan {i}',s.now()))
  s.db.execute('insert into entitlements values(?,?,?,?,?,?)',('e1','u1','membership','*',0,s.now()+3600))
  items=(await s.chat('show',0,0,self.u))['items']
  self.assertEqual((len(items),items[0]['message'],items[-1]['message']),(50,'pesan 10','pesan 59'))
 async def test_comment_relay_targets_showroom_room_and_full_idn_id(self):
  self.assertEqual(s.comment_source({'type':'showroom','room_id':572591}),('showroom','572591'))
  self.assertEqual(s.comment_source({'type':'idn','notification_data_id':'idn-9366d380','room_id':5}),('idn','idn-9366d380'))
  self.assertIsNone(s.comment_source({'type':'idn','notification_data_id':'mem-one'}))
 async def test_live_comments_share_one_relay_and_wake_waiting_viewer(self):
  raw={'lives':[{'notification_data_id':'sr-1','type':'showroom','room_id':572591}]}
  async def upstream(path):return raw
  async def idle(relay):pass
  s.relays.clear()
  with patch.object(s,'upstream',upstream),patch.object(s.Relay,'run',idle):
   first=await s.live_comments('sr-1',0,0,self.u)
   self.assertEqual((first['items'],len(s.relays)),([],1))
   waiter=asyncio.create_task(s.live_comments('sr-1',0,20,{**self.u,'id':'u2'}))
   await asyncio.sleep(0.05);self.assertFalse(waiter.done())
   s.relays['showroom:572591'].feed({'type':'comments','status':'connected','cursor':43,'comments':[
    {'sequence':43,'user':{'name':'Penonton','avatar_url':'https://image.showroom-cdn.com/a/1.png'},'comment':'Halo!','observed_at':'2026-10-29T01:00:00Z'},
    {'sequence':42,'user':{'name':'Lama'},'comment':'urutan lama'}]})
   got=await asyncio.wait_for(waiter,1)
   self.assertEqual([(m['id'],m['name'],m['message'])for m in got['items']],[(42,'Lama','urutan lama'),(43,'Penonton','Halo!')])
   self.assertEqual((got['cursor'],got['status'],len(s.relays)),(43,'connected',1))
   later=await s.live_comments('sr-1',43,0,self.u)
   self.assertEqual(later['items'],[])
  s.relays.clear()
 async def test_hls_segments_are_shared_and_next_ones_prefetched(self):
  s.media_cache.clear();s.inflight.clear();s.following.clear();fetched=[]
  async def load(url):
   fetched.append(url);value=(time.monotonic()+60,200,'video/mp2t',b'seg',url);s.media_cache[url]=value;return value
  data={'u':'https://st.avonera48.web.id/stream/show/index.m3u8','kind':'theater','target':'show','exp':s.now()+60,'h':1}
  playlist=b'#EXTM3U\n#EXTINF:2,\na.ts\n#EXTINF:2,\nb.ts\n#EXTINF:2,\nc.ts\n#EXTINF:2,\nd.ts\n#EXT-X-ENDLIST\n'
  with patch.object(s,'load_media',load):
   body=s.retarget(playlist,data['u'],self.u,data).body.decode()
   await asyncio.sleep(0)
   base='https://st.avonera48.web.id/stream/show/'
   self.assertEqual(fetched,[base+'a.ts',base+'b.ts'])
   self.assertNotIn('a.ts',body)
   self.assertEqual(s.following[base+'a.ts'],[base+'b.ts',base+'c.ts',base+'d.ts'])
   s.prefetch(s.following[base+'b.ts']);await asyncio.sleep(0)
   self.assertEqual(fetched,[base+'a.ts',base+'b.ts',base+'c.ts',base+'d.ts'])
  s.media_cache.clear();s.following.clear()
 async def test_replay_prefers_whole_mp4_over_hls_parts(self):
  raw={'room_info':{'name':'M'},'recordings':[{'url':'https://api.jkt48connect.app/r/1.mp4','stream_url':'https://api.jkt48connect.app/r/1.m3u8'},{'stream_url':'https://api.jkt48connect.app/r/2.m3u8'}]}
  async def upstream(path):return raw
  with patch.object(s,'upstream',upstream):
   items=(await s.playback('recent','r1',self.u))['items']
  self.assertEqual([i['hls']for i in items],[False,True])
  first=s.reveal(items[0]['url'].rsplit('/',1)[1],self.u);second=s.reveal(items[1]['url'].rsplit('/',1)[1],self.u)
  self.assertEqual((first['u'].endswith('.mp4'),'h'in first,second.get('h')),(True,False,1))
 async def test_register_mistakes_get_readable_messages_not_422(self):
  class Req:
   headers={};client=type('C',(),{'host':'1.2.3.4'})()
  cases=[(s.Credentials(email='',password='rahasia123',name='A'),'email'),
         (s.Credentials(email='a@b.co',password='',name='A'),'password'),
         (s.Credentials(email='a@b.co',password='pendek',name='A'),'8 karakter'),
         (s.Credentials(email='a@b.co',password='rahasia123',name=''),'nama'),
         (s.Credentials(email='a@b.co',password='rahasia123',name='x'*41),'40')]
  for data,needle in cases:
   with self.assertRaises(s.HTTPException)as e:await s.authenticate(Req(),data,True)
   self.assertEqual(e.exception.status_code,400);self.assertIn(needle,e.exception.detail.lower()if needle.islower()else e.exception.detail)
  ok=await s.authenticate(Req(),s.Credentials(email='Baru@Contoh.id',password='rahasia123',name='Baru'),True)
  self.assertEqual(ok['user']['email'],'baru@contoh.id')
 async def test_invalid_body_is_answered_with_a_message(self):
  self.assertIn(s.RequestValidationError,s.app.exception_handlers)
  r=await s.invalid_request(None,s.RequestValidationError([]))
  self.assertEqual(r.status_code,400);self.assertIn('message',json.loads(r.body))
 async def test_update_offers_current_release_unless_state_is_newer(self):
  self.assertEqual((await s.update())['code'],3)
 async def test_avatar_upload_is_squared_stripped_and_replaces_the_old_one(self):
  import io
  from PIL import Image
  class Upload:
   def __init__(self,body):self.body=body;self.headers={'content-length':str(len(body))}
   async def stream(self):
    yield self.body
  s.db.execute("INSERT INTO users(id,email,password_hash,name,avatar) VALUES('u1','a@b.co','','Test','')");s.db.commit()
  user=dict(s.db.execute('SELECT u.*,? AS sid FROM users u WHERE id=?',('session1','u1')).fetchone())
  src=io.BytesIO();Image.new('RGB',(1200,800),'red').save(src,'PNG')
  with patch.object(s,'ROOT',Path(self.tmp.name)):
   first=await s.upload_avatar(Upload(src.getvalue()),user)
   self.assertTrue(first['avatar'].startswith(s.AVATAR_URL))
   stored=Path(self.tmp.name)/'avatars'/(first['avatar'].rsplit('/',1)[1]+'.jpg')
   with Image.open(stored)as img:self.assertEqual((img.format,img.size,'exif'in img.info),('JPEG',(512,512),False))
   second=await s.upload_avatar(Upload(src.getvalue()),{**user,'avatar':first['avatar']})
   self.assertFalse(stored.exists(),'old photo removed')
   self.assertEqual(s.db.execute("SELECT avatar FROM users WHERE id='u1'").fetchone()[0],second['avatar'])
   with self.assertRaises(s.HTTPException)as e:await s.upload_avatar(Upload(b'bukan gambar'),user)
   self.assertEqual(e.exception.status_code,400)
   with self.assertRaises(s.HTTPException):await s.avatar('../../etc/passwd',user)
   gone=await s.remove_avatar({**user,'avatar':second['avatar']})
   self.assertEqual(gone['avatar'],'')
 async def test_recent_detail_maps_stats_supporters_gifts_and_screenshots(self):
  raw={'data_id':'r1','type':'showroom','points':321,'room_info':{'name':'Member Satu','img':'https://images.jkt48connect.com/m.jpg'},
   'live_info':{'duration':3600000,'viewers':{'num':900},'comments':{'num':456,'users':78},'date':{'start':'2026-10-01T10:00:00Z','end':'2026-10-01T11:00:00Z'},
    'gift':{'list':[{'name':'Bintang','num':3,'user_count':2,'img':'https://images.jkt48connect.com/g1.png'},{'name':'Kosong','num':0},{'name':'Mahkota','num':9,'image_available':False}]},
    'screenshot':{'base_url':'https://images.jkt48connect.com/shots/','format':'jpg','list':[1759312800000,'../etc',1759312860000]}},
   'fans':[{'name':'Fan A','gold':50,'avatar_url':'https://images.jkt48connect.com/a.png'},{'name':''}],
   'recordings':[{'url':'https://st.avonera48.web.id/a.mp4'},{'stream_url':'https://st.avonera48.web.id/b.m3u8'}]}
  async def upstream(path):
   self.assertEqual(path,'/api/recent/r1');return raw
  with patch.object(s,'upstream',upstream):
   d=await s.recent_detail('r1',self.u)
  self.assertEqual((d['durationMs'],d['viewers'],d['points'],d['pointLabel'],d['comments'],d['recordingCount']),(3600000,900,321,'Poin',456,2))
  self.assertEqual([(g['name'],g['num'],g['img']=='')for g in d['gifts']],[('Mahkota',9,True),('Bintang',3,False)])
  self.assertEqual([(f['name'],f['amount'])for f in d['fans']],[('Fan A',50)])
  self.assertEqual(len(d['screenshots']),2)
  self.assertTrue(all(u.startswith(s.BASE+'/api/app/image/')for u in d['screenshots']))
if __name__=='__main__':unittest.main()
