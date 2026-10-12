import postgres from 'postgres';
import { authorize } from '../lib/admin-auth.js';
import { catalog } from './_catalog.js';
import { ensureProductOverridesTable,readProductOverrides } from '../lib/product-overrides.js';

export default async function handler(req,res) {
  if (!authorize(req,res)) return;
  res.setHeader('Cache-Control','no-store, max-age=0');
  if (!['GET','PUT'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  if (!process.env.DATABASE_URL) return res.status(503).json({error:'Brak konfiguracji DATABASE_URL.'});
  const sql=postgres(process.env.DATABASE_URL,{ssl:'require',max:1});
  try {
    await ensureProductOverridesTable(sql);
    if (req.method==='GET') {
      const rows=await readProductOverrides(sql);
      const changes=new Map(rows.map(x=>[x.id,x]));
      const products=catalog.map(p=>{
        const override=changes.get(p.id);
        return {
          id:p.id,
          name:p.name,
          priceCents:override?override.priceCents:Math.round(p.price*100),
          available:override?override.available:true,
          updatedAt:override?.updatedAt||null
        };
      });
      return res.status(200).json({products});
    }
    const id=req.body?.id, priceCents=req.body?.priceCents, available=req.body?.available;
    if (!Number.isInteger(id)||!catalog.some(p=>p.id===id)) return res.status(400).json({error:'Nieznany produkt.'});
    if (!Number.isSafeInteger(priceCents)||priceCents<1||priceCents>99999999) return res.status(400).json({error:'Nieprawidłowa cena.'});
    if (typeof available!=='boolean') return res.status(400).json({error:'Nieprawidłowa dostępność.'});
    const rows=await sql`
      INSERT INTO product_overrides (product_id,price_cents,available,updated_at)
      VALUES (${id},${priceCents},${available},NOW())
      ON CONFLICT (product_id) DO UPDATE
      SET price_cents=EXCLUDED.price_cents,
          available=EXCLUDED.available,
          updated_at=NOW()
      RETURNING product_id AS "id",
                price_cents AS "priceCents",
                available,
                updated_at AS "updatedAt"
    `;
    return res.status(200).json({product:rows[0],success:true});
  } catch(e) {
    console.error('admin-products:',e.message);
    return res.status(500).json({error:'Nie udało się zapisać produktu. Sprawdź połączenie z bazą.'});
  } finally {
    await sql.end().catch(()=>{});
  }
}
