-- Uruchom jednokrotnie w konsoli SQL bazy przed wdrożeniem.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locker_code text;
CREATE TABLE IF NOT EXISTS order_emails (
  session_id text NOT NULL REFERENCES orders(session_id),
  kind text NOT NULL CHECK (kind IN ('customer', 'owner')),
  payload jsonb NOT NULL,
  sent_at timestamptz,
  provider_id text,
  PRIMARY KEY (session_id, kind)
);
