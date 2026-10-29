"""Import COPY records without executing any SQL/functions from the old dump.

The complete original archive is kept privately. Every table is preserved in
legacy_rows; only explicitly mapped records become active app accounts/access.
Old refresh tokens, API keys, sessions and webhook secrets are never activated.
"""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess

DDL = '''
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS legacy_rows(schema_name TEXT,table_name TEXT,row_no INTEGER,data TEXT NOT NULL,PRIMARY KEY(schema_name,table_name,row_no));
CREATE TABLE IF NOT EXISTS imports(sha256 TEXT PRIMARY KEY,counts TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE COLLATE NOCASE,password_hash TEXT,name TEXT,avatar TEXT,banned INTEGER DEFAULT 0,role TEXT DEFAULT 'user');
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS entitlements(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL,starts INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS entitlements_user ON entitlements(user_id,kind,target,expires);
CREATE TABLE IF NOT EXISTS show_aliases(alias TEXT PRIMARY KEY,slug TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS image_sources(id TEXT PRIMARY KEY,url TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,plan TEXT NOT NULL,target TEXT NOT NULL,amount INTEGER NOT NULL,gateway_id TEXT UNIQUE,status TEXT NOT NULL,document TEXT NOT NULL,created INTEGER NOT NULL,checked INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS chat(id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,user_id TEXT NOT NULL,name TEXT NOT NULL,message TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS chat_room ON chat(room,id);
CREATE TABLE IF NOT EXISTS notices(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,created INTEGER NOT NULL);
'''


def open_db(path):
    db = sqlite3.connect(path, timeout=20)
    db.row_factory = sqlite3.Row
    db.executescript(DDL)
    return db


def decode_copy(value):
    if value == r'\N':
        return None
    escapes = {'n': '\n', 't': '\t', 'r': '\r', 'b': '\b', 'f': '\f', 'v': '\v', '\\': '\\'}
    return re.sub(r'\\([0-7]{1,3}|.)', lambda m: chr(int(m[1], 8)) if m[1].isdigit() else escapes.get(m[1], m[1]), value)


def stamp(value):
    from datetime import datetime
    try:
        text=re.sub(r'([+-]\d{2})$',r'\1:00',str(value).replace('Z', '+00:00'))
        d = datetime.fromisoformat(text)
        return int(d.timestamp()) if d.tzinfo else 0
    except (ValueError, TypeError):
        return 0


def activate(db):
    def rows(table, schema='public'):
        return [json.loads(r[0]) for r in db.execute('SELECT data FROM legacy_rows WHERE schema_name=? AND table_name=?', (schema, table))]
    profiles = {r['id']: r for r in rows('profiles')}
    roles = collections.defaultdict(list)
    for r in rows('user_roles'):
        roles[r['user_id']].append(r.get('role'))
    for r in rows('users', 'auth'):
        if not r.get('email') or r.get('deleted_at'):
            continue
        p = profiles.get(r['id'], {})
        db.execute('INSERT OR IGNORE INTO users(id,email,password_hash,name,avatar,banned,role) VALUES(?,?,?,?,?,?,?)',
                   (r['id'], r['email'].strip().lower(), r.get('encrypted_password') or '', p.get('display_name') or r['email'].split('@')[0],
                    p.get('avatar_url') or '', int(p.get('is_banned') == 't' or stamp(r.get('banned_until')) > __import__('time').time()),
                    'admin' if 'admin' in roles[r['id']] else 'user'))
    for r in rows('memberships'):
        if r.get('is_active') != 't' or r.get('revoked_at') or not stamp(r.get('expires_at')):
            continue
        db.execute('INSERT OR IGNORE INTO entitlements VALUES(?,?,?,?,?,?)',
                   ('legacy-membership:'+r['id'], r['user_id'], 'membership', '*', stamp(r.get('starts_at')), stamp(r['expires_at'])))
    for r in rows('live_access'):
        if not r.get('show_id'):continue
        expires=stamp(r.get('expires_at'))if r.get('expires_at')else 4102444800
        if not expires:continue
        db.execute('INSERT OR IGNORE INTO entitlements VALUES(?,?,?,?,?,?)',
                   ('legacy-access:'+r['id'], r['user_id'], 'show', r['show_id'], stamp(r.get('granted_at')), expires))
    # Keep source-only rows intact, including unrelated products and historic data.


def migrate(dump, dest, pg_restore):
    os.umask(0o077)
    digest = hashlib.file_digest(open(dump, 'rb'), 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else hashlib.sha256(Path(dump).read_bytes()).hexdigest()
    db = open_db(dest)
    if db.execute('SELECT 1 FROM imports WHERE sha256=?', (digest,)).fetchone():
        print(json.dumps({'status': 'already_imported'})); return
    if db.execute('SELECT 1 FROM legacy_rows LIMIT 1').fetchone():
        raise SystemExit('Destination contains a different import; explicit reconciliation required')
    counts = collections.Counter()
    proc = subprocess.Popen([pg_restore, '--data-only', '--no-owner', '--no-acl', '--file=-', dump], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    table = None
    try:
        db.execute('BEGIN')
        for line in proc.stdout:
            if line.startswith('COPY '):
                match = re.fullmatch(r'COPY ([\w]+)\.([\w]+) \((.*?)\) FROM stdin;\n', line)
                if not match:
                    raise ValueError('unsupported_copy_header')
                schema, table, cols = match.groups(); columns = [x.strip().strip('"') for x in cols.split(',')]
            elif table and line.rstrip('\n') == r'\.':
                table = None
            elif table:
                values = [decode_copy(v) for v in line.rstrip('\n').split('\t')]
                if len(values) != len(columns):
                    raise ValueError('invalid_copy_width')
                key = schema+'.'+table; counts[key] += 1
                db.execute('INSERT INTO legacy_rows VALUES(?,?,?,?)', (schema, table, counts[key], json.dumps(dict(zip(columns, values)), ensure_ascii=False)))
        proc.wait()
        if proc.returncode:
            raise ValueError('pg_restore_failed')
        activate(db)
        db.execute('INSERT INTO imports(sha256,counts) VALUES(?,?)', (digest, json.dumps(counts)))
        db.commit()
    except BaseException:
        proc.kill(); db.rollback(); raise
    print(json.dumps({'status': 'imported', 'tables': len(counts), 'rows': sum(counts.values()), 'users': db.execute('SELECT COUNT(*) FROM users').fetchone()[0],
                      'memberships': db.execute("SELECT COUNT(*) FROM entitlements WHERE kind='membership'").fetchone()[0]}))
    db.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('dump'); p.add_argument('dest'); p.add_argument('--pg-restore', default='pg_restore')
    a = p.parse_args(); migrate(a.dump, a.dest, a.pg_restore)
