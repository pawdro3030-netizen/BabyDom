import postgres from 'postgres';
import { authorize } from '../lib/admin-auth.js';
import { sendOrderEmails } from '../lib/order-emails.js';
export default async function handler(req,res) {
  if (!authorize(req,res)) return;
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  if (!process.env.DATABASE_URL) return res.status(503).json({error:'Brak DATABASE_URL'});
  const sql = postgres(process.env.DATABASE_URL,{ssl:'require',max:1});
  try {
    if (req.method === 'POST') {
      const session = String(req.body?.sessionId || '');
      if (!/^BD-[0-9]+-[A-F0-9]+$/.test(session)) return res.status(400).json({error:'Nieprawidłowe zamówienie'});
      await sendOrderEmails(sql,session);
      return res.json({success:true});
    }
    const page = Math.max(0,Math.min(100000,parseInt(req.query?.page,10)||0));
    const orders = await sql`SELECT o.*, (SELECT COUNT(*)::int FROM order_emails e WHERE e.session_id=o.session_id AND e.sent_at IS NOT NULL) AS emails_sent FROM orders o ORDER BY created_at DESC LIMIT 50 OFFSET ${page*50}`;
    return res.json({orders,page});
  } catch(e) { console.error('admin-orders:',e.message); return res.status(500).json({error:'Nie udało się wykonać operacji. Sprawdź migrację bazy i konfigurację Resend.'}); }
  finally { await sql.end().catch(()=>{}); }
}
