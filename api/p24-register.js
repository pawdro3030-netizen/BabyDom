import crypto from "node:crypto";
import postgres from "postgres";
import { catalog } from "./_catalog.js";

const sha384 = (o) =>
  crypto.createHash("sha384").update(JSON.stringify(o)).digest("hex");

const clean = (v, max = 120) =>
  String(v ?? "").trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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

    const siteUrl = (
      process.env.SITE_URL || `https://${req.headers.host}`
    ).replace(/\/$/, "");

    if ((process.env.P24_MODE || "sandbox").toLowerCase() !== "sandbox") {
      return res.status(503).json({
        error: "Ta wersja jest zablokowana na SANDBOX.",
      });
    }

    if (!posId || !merchantId || !crc || !apiKey) {
      return res.status(500).json({
        error: "Brak konfiguracji P24 w Vercel Environment Variables.",
      });
    }

    if (!databaseUrl) {
      return res.status(500).json({
        error: "Brak DATABASE_URL w Vercel Environment Variables.",
      });
    }

    const customer = req.body?.customer || {};
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    const email = clean(customer.email, 255);
    const name = clean(customer.name, 150);
    const phone = clean(customer.phone, 50);
    const street = clean(customer.street, 255);
    const postalCode = clean(customer.postalCode, 20);
    const city = clean(customer.city, 100);

    if (
      !email.includes("@") ||
      !name ||
      !street ||
      !postalCode ||
      !city ||
      !items.length
    ) {
      return res.status(400).json({
        error: "Uzupełnij dane klienta i koszyk.",
      });
    }

    let amount = 0;
    let count = 0;
    const orderItems = [];

    for (const row of items) {
      const id = Number(row.id);
      const qty = Math.max(1, Math.min(50, Number(row.qty) || 0));
      const product = catalog.find((x) => x.id === id);

      if (!product) {
        return res.status(400).json({
          error: "Koszyk zawiera nieznany produkt.",
        });
      }

      const unitPrice = Math.round(product.price * 100);
      const lineTotal = unitPrice * qty;

      amount += lineTotal;
      count += qty;

      orderItems.push({
        id: product.id,
        name: product.name,
        qty,
        unitPrice,
        lineTotal,
      });
    }

    if (amount < 1 || count > 100) {
      return res.status(400).json({
        error: "Nieprawidłowa wartość koszyka.",
      });
    }

    const randomPart = crypto.randomBytes(5).toString("hex").toUpperCase();

    const sessionId = `BD-${Date.now()}-${randomPart}`;
    const orderNumber = `BD-${Date.now()}-${randomPart.slice(0, 6)}`;
    const currency = "PLN";

    sql = postgres(databaseUrl, {
      ssl: "require",
      max: 1,
    });

    await sql`
      INSERT INTO orders (
        order_number,
        session_id,
        status,
        customer_name,
        customer_email,
        customer_phone,
        street,
        postal_code,
        city,
        items,
        amount,
        currency
      )
      VALUES (
        ${orderNumber},
        ${sessionId},
        'pending_payment',
        ${name},
        ${email},
        ${phone || null},
        ${street},
        ${postalCode},
        ${city},
        ${sql.json(orderItems)},
        ${amount},
        ${currency}
      )
    `;

    const body = {
      merchantId,
      posId,
      sessionId,
      amount,
      currency,
      description: `BabyDom - zamówienie ${orderNumber}`,
      email,
      client: name,
      address: street,
      zip: postalCode,
      city,
      country: "PL",
      language: "pl",
      urlReturn: `${siteUrl}/?payment=return&sessionId=${encodeURIComponent(
        sessionId
      )}`,
      urlStatus: `${siteUrl}/api/p24-status`,
    };

    body.sign = sha384({
      sessionId,
      merchantId,
      amount,
      currency,
      crc,
    });

    const auth = Buffer.from(`${posId}:${apiKey}`).toString("base64");

    const p24Response = await fetch(
      "https://sandbox.przelewy24.pl/api/v1/transaction/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await p24Response.json().catch(() => ({}));

    if (!p24Response.ok || !data?.data?.token) {
      await sql`
        UPDATE orders
        SET
          status = 'payment_registration_failed',
          updated_at = NOW()
        WHERE session_id = ${sessionId}
      `;

      return res.status(502).json({
        error: "Przelewy24 odrzuciło rejestrację transakcji.",
        details: data,
      });
    }

    return res.status(200).json({
      sessionId,
      orderNumber,
      redirectUrl: `https://sandbox.przelewy24.pl/trnRequest/${encodeURIComponent(
        data.data.token
      )}`,
    });
  } catch (e) {
    console.error("p24-register error:", e);

    return res.status(500).json({
      error: "Błąd serwera podczas tworzenia płatności.",
      details: String(e?.message || e),
    });
  } finally {
    if (sql) {
      await sql.end().catch(() => {});
    }
  }
}
