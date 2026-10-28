ALTER TABLE donasika_payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'mypg';
-- These requests failed before a transaction ID/QRIS was returned. Preserve the
-- audit records; allow a new invoice with the replacement, idempotent gateway.
UPDATE donasika_payments SET status='REVIEW_LEGACY' WHERE status='REVIEW' AND trx_id IS NULL AND provider='mypg';
