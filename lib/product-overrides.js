// Wspólne, przechowywane w Neon ustawienia cen i dostępności produktów.
export async function ensureProductOverridesTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS product_overrides (
      product_id INTEGER PRIMARY KEY,
      price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 1 AND 99999999),
      available BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function readProductOverrides(sql) {
  return sql`
    SELECT product_id AS "id",
           price_cents AS "priceCents",
           available,
           updated_at AS "updatedAt"
    FROM product_overrides
    ORDER BY product_id
  `;
}
