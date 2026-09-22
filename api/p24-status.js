import crypto from "node:crypto";
import postgres from "postgres";

const sha384 = (o) =>
  crypto.createHash("sha384").update(JSON.stringify(o)).digest("hex");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  let sql;

  try {
    const posId = Number(process.env.P24_POS_ID);
    const merchantId = Number(
      process.env.P24_MERCHANT_ID || process.env.P24_POS_ID
    );
    const crc = process.env.P24_CRC;
    const apiKey = process.env.P24_API_KEY;
    const databaseUrl = process.env.DATABASE_URL;

    if ((process.env.P24_MODE || "sandbox").toLowerCase() !== "sandbox") {
      return res.status(503).send("Sandbox only");
    }

    if (!posId || !merchantId || !crc || !apiKey || !databaseUrl) {
      return res.status(500).send("Server not configured");
    }

    const n = req.body || {};

    const expectedSign = sha384({
      merchantId: Number(n.merchantId),
      posId: Number(n.posId),
      sessionId: String(n.sessionId),
      amount: Number(n.amount),
      originAmount: Number(n.originAmount),
      currency: String(n.currency),
      orderId: Number(n.orderId),
      methodId: Number(n.methodId),
      statement: String(n.statement),
      crc,
    });

    if (!n.sign || expectedSign !== n.sign) {
      return res.status(400).send("Invalid sign");
    }

    sql = postgres(databaseUrl, {
      ssl: "require",
      max: 1,
    });

    const orders = await sql`
      SELECT session_id, amount, currency
      FROM orders
      WHERE session_id = ${String(n.sessionId)}
      LIMIT 1
    `;

    if (!orders.length) {
      return res.status(404).send("Order not found");
    }

    const order = orders[0];

    if (
      Number(order.amount) !== Number(n.amount) ||
      String(order.currency) !== String(n.currency)
    ) {
      return res.status(400).send("Order data mismatch");
    }

    const verifyBody = {
      merchantId,
      posId,
      sessionId: String(n.sessionId),
      amount: Number(n.amount),
      currency: String(n.currency),
      orderId: Number(n.orderId),
    };

    verifyBody.sign = sha384({
      sessionId: verifyBody.sessionId,
      orderId: verifyBody.orderId,
      amount: verifyBody.amount,
      currency: verifyBody.currency,
      crc,
    });

    const auth = Buffer.from(`${posId}:${apiKey}`).toString("base64");

    const verifyResponse = await fetch(
      "https://sandbox.przelewy24.pl/api/v1/transaction/verify",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(verifyBody),
      }
    );

    const verifyData = await verifyResponse.json().catch(() => ({}));

    if (!verifyResponse.ok) {
      console.error("P24 verify failed:", verifyData);
      return res.status(502).send("Verify failed");
    }

    await sql`
      UPDATE orders
      SET
        status = 'paid',
        p24_order_id = ${Number(n.orderId)},
        p24_method_id = ${Number(n.methodId) || null},
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
      WHERE session_id = ${String(n.sessionId)}
    `;

    return res.status(200).send("OK");
  } catch (e) {
    console.error("p24-status error:", e);
    return res.status(500).send("Server error");
  } finally {
    if (sql) {
      await sql.end().catch(() => {});
    }
  }
}
