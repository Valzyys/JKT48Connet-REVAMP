-- Donasi aplikasi (worker/donate.ts): satu baris per tagihan QRIS MYPG, terikat ke sesi aplikasi pembuatnya.
CREATE TABLE IF NOT EXISTS donations (id TEXT PRIMARY KEY, sid TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', base_amount INTEGER NOT NULL, amount INTEGER, status TEXT NOT NULL DEFAULT 'CREATING', trx_id TEXT UNIQUE, qr_image TEXT, payment_url TEXT, expired_at TEXT, created_at INTEGER NOT NULL, paid_at INTEGER);
CREATE INDEX IF NOT EXISTS donations_paid ON donations(status, paid_at);
CREATE INDEX IF NOT EXISTS donations_sid ON donations(sid, created_at);
