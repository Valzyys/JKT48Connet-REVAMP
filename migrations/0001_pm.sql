CREATE TABLE IF NOT EXISTS pm_users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS pm_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES pm_users(id), expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pm_sessions_expiry ON pm_sessions(expires_at);
CREATE TABLE IF NOT EXISTS pm_orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES pm_users(id), member TEXT NOT NULL, member_name TEXT NOT NULL, plan TEXT NOT NULL, days INTEGER NOT NULL, price INTEGER NOT NULL, amount INTEGER, status TEXT NOT NULL DEFAULT 'CREATING', trx_id TEXT UNIQUE, qr_image TEXT, expired_at TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pm_orders_user ON pm_orders(user_id, created_at);
CREATE TABLE IF NOT EXISTS pm_grants (order_id TEXT PRIMARY KEY REFERENCES pm_orders(id), user_id TEXT NOT NULL REFERENCES pm_users(id), member TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pm_grants_access ON pm_grants(user_id, member, expires_at);
CREATE TABLE IF NOT EXISTS pm_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pm_limits_expiry ON pm_limits(reset_at);
