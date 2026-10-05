export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => (Number(v)/100).toLocaleString('pl-PL',{style:'currency',currency:'PLN'});
export function emailPayload(order, kind) {
  const owner = process.env.ORDER_NOTIFICATION_EMAIL || 'babydomcontaact@outlook.com';
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const rows = items.map(i => `<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.qty)}</td><td>${money(i.lineTotal)}</td></tr>`).join('');
  return {
    from: process.env.EMAIL_FROM || 'BabyDom <onboarding@resend.dev>',
    to: [kind === 'owner' ? owner : order.customer_email],
    reply_to: owner,
    subject: `${kind === 'owner' ? 'Nowe opłacone zamówienie' : 'Potwierdzenie płatności'} ${order.order_number} | BabyDom`,
    html: `<html lang="pl"><body style="font-family:Arial;color:#172234"><h1>BabyDom</h1><h2>${kind === 'owner' ? 'Nowe opłacone zamówienie' : 'Dziękujemy! Płatność została potwierdzona.'}</h2><p>Zamówienie <b>${escapeHtml(order.order_number)}</b></p><table cellpadding="10"><tr><th>Produkt</th><th>Ilość</th><th>Kwota</th></tr>${rows}</table><p><b>Razem: ${money(order.amount)}</b></p><p>${escapeHtml(order.customer_name)}<br>${escapeHtml(order.street)}<br>${escapeHtml(order.postal_code)} ${escapeHtml(order.city)}<br>${escapeHtml(order.customer_phone)}</p><p>Dostawa: ${escapeHtml(order.delivery || 'Sprawdź pozycję dostawy')}${order.locker_code ? ` — ${escapeHtml(order.locker_code)}` : ''}</p><p>Wysyłamy we wtorki i piątki. Kontakt: ${escapeHtml(owner)}</p></body></html>`
  };
}
export async function sendOrderEmails(sql, sessionId) {
  const [order] = await sql`SELECT * FROM orders WHERE session_id = ${sessionId} AND status = 'paid'`;
  if (!order) throw new Error('Opłacone zamówienie nie istnieje');
  for (const kind of ['customer','owner']) {
    const payload = emailPayload(order, kind);
    await sql`INSERT INTO order_emails (session_id, kind, payload) VALUES (${sessionId}, ${kind}, ${sql.json(payload)}) ON CONFLICT DO NOTHING`;
  }
  if (!process.env.RESEND_API_KEY) throw new Error('Brak RESEND_API_KEY');
  const pending = await sql`SELECT kind, payload FROM order_emails WHERE session_id = ${sessionId} AND sent_at IS NULL`;
  const failures = [];
  for (const row of pending) {
    try {
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST', signal:AbortSignal.timeout(8000),
      headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`paid/${sessionId}/${row.kind}`},
      body:JSON.stringify(row.payload)
    });
    const data = await response.json();
    if (!response.ok || !data.id) throw new Error(`Resend: ${response.status}`);
    await sql`UPDATE order_emails SET sent_at = NOW(), provider_id = ${data.id} WHERE session_id = ${sessionId} AND kind = ${row.kind}`;
    } catch (error) { failures.push(error.message); }
  }
  if (failures.length) throw new Error(failures.join("; "));
}
