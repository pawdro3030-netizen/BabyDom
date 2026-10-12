import postgres from 'postgres';
import { readProductOverrides } from '../lib/product-overrides.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  if (!process.env.DATABASE_URL) return res.status(503).json({error:'Katalog jest chwilowo niedostępny.'});
  const sql = postgres(process.env.DATABASE_URL,{ssl:'require',max:1});
  try {
    // Pierwsze otwarcie przed inicjalizacją panelu: jeszcze bez zmian.
    let overrides;
    try {
      overrides = await readProductOverrides(sql);
    } catch(e) {
      if (e.code !== '42P01') throw e; // brak tabeli: domyślne ceny i dostępność
      overrides = [];
    }
    return res.status(200).json({overrides});
  } catch(e) {
    console.error('products:',e.message);
    return res.status(503).json({error:'Nie można obecnie sprawdzić cen i dostępności.'});
  } finally {
    await sql.end().catch(()=>{});
  }
}
