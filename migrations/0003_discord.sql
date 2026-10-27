CREATE TABLE IF NOT EXISTS discord_oauth_states (hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS discord_sessions (hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,profile TEXT NOT NULL,access_token TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS discord_sessions_expiry ON discord_sessions(expires);
CREATE TABLE IF NOT EXISTS discord_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
