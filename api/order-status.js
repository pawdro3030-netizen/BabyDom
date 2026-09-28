import postgres from "postgres";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  let sql;

  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      return res.status(500).json({
        error: "Brak konfiguracji bazy danych.",
      });
    }

    const sessionId = String(req.query?.sessionId || "").trim();

    if (!sessionId || !sessionId.startsWith("BD-")) {
      return res.status(400).json({
        error: "Nieprawidłowy sessionId.",
      });
    }

    sql = postgres(databaseUrl, {
      ssl: "require",
      max: 1,
    });

    const orders = await sql`
      SELECT
        order_number,
        session_id,
        status
      FROM orders
      WHERE session_id = ${sessionId}
      LIMIT 1
    `;

    if (!orders.length) {
      return res.status(404).json({
        error: "Nie znaleziono zamówienia.",
      });
    }

    const order = orders[0];

    return res.status(200).json({
      orderNumber: order.order_number,
      status: order.status,
      paid: order.status === "paid",
    });

  } catch (e) {
    console.error("order-status error:", e);

    return res.status(500).json({
      error: "Błąd podczas sprawdzania zamówienia.",
    });

  } finally {
    if (sql) {
      await sql.end().catch(() => {});
    }
  }
}
