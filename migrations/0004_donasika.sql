-- Separate campaign ledger; never includes app/operational donations.
CREATE TABLE IF NOT EXISTS donasika_campaigns (id TEXT PRIMARY KEY, starts_at INTEGER, ends_at INTEGER, enabled INTEGER NOT NULL DEFAULT 0, beneficiary TEXT NOT NULL, CHECK(ends_at IS NULL OR ends_at=starts_at+604800));
INSERT OR IGNORE INTO donasika_campaigns(id,beneficiary) VALUES ('karhutla-2026','Save the Children Indonesia');
CREATE TABLE IF NOT EXISTS donasika_payments (
 id TEXT PRIMARY KEY, campaign TEXT NOT NULL REFERENCES donasika_campaigns(id), sid TEXT NOT NULL,
 request_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '',
 base_amount INTEGER NOT NULL, amount INTEGER, status TEXT NOT NULL DEFAULT 'CREATING',
 trx_id TEXT UNIQUE, qr_image TEXT, expired_at TEXT, created_at INTEGER NOT NULL, paid_at INTEGER,
 next_check INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS donasika_paid ON donasika_payments(campaign,status,paid_at);
CREATE INDEX IF NOT EXISTS donasika_pending ON donasika_payments(status,next_check,lease_until);
CREATE INDEX IF NOT EXISTS donasika_session ON donasika_payments(sid,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS donasika_one_active ON donasika_payments(sid,campaign) WHERE status IN ('CREATING','PENDING','REVIEW');
