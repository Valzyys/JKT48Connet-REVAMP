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
if __name__=='__main__':unittest.main()
