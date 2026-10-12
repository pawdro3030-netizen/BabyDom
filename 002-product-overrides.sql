-- Opcjonalna migracja Neon: panel administratora tworzy tę tabelę sam przy pierwszym logowaniu.
CREATE TABLE IF NOT EXISTS product_overrides (
  product_id INTEGER PRIMARY KEY,
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 1 AND 99999999),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
