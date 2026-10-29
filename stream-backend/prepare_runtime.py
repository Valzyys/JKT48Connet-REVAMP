"""Derive the app DB; keep the complete import as a separate root-only archive."""
import json,os,sqlite3,sys
from migrate import open_db,stamp
os.umask(0o077)
src,dest=sys.argv[1:]
db=open_db(dest)
if db.execute('select 1 from users limit 1').fetchone():raise SystemExit('Runtime DB already populated; refusing replacement')
db.execute('ATTACH DATABASE ? AS source',(src,))
for table in ('users','entitlements','imports'):
 db.execute('INSERT INTO '+table+' SELECT *FROM source.'+table)
needed=('profiles','user_roles','purchases','memberships','live_access','show_snapshots','replays','stream_comments')
for table in needed:
 for row in db.execute('SELECT schema_name,table_name,row_no,data FROM source.legacy_rows WHERE schema_name=? AND table_name=?',('public',table)).fetchall():
  value=json.loads(row['data'])
  if table=='purchases':
   value={k:v for k,v in value.items()if k in ('id','user_id','kind','target_id','amount','final_amount','status','created_at','paid_at')}
  db.execute('INSERT INTO legacy_rows VALUES(?,?,?,?)',(row['schema_name'],row['table_name'],row['row_no'],json.dumps(value)))
for row in db.execute("SELECT data FROM legacy_rows WHERE table_name='stream_comments'ORDER BY row_no") .fetchall():
 c=json.loads(row[0]);db.execute('INSERT INTO chat(room,user_id,name,message,created)VALUES(?,?,?,?,?)',(c['show_slug'],c['user_id'],c.get('display_name')or'Penonton',c['message'],stamp(c['created_at'])))
db.commit();db.execute('DETACH DATABASE source');db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
print(json.dumps({'runtime_users':db.execute('select count(*)from users').fetchone()[0],'runtime_access':db.execute('select count(*)from entitlements').fetchone()[0],'legacy_chat':db.execute('select count(*)from chat').fetchone()[0]}));db.close()
