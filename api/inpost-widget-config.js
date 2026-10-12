// Geowidget używa publicznego tokenu przypisanego do domeny BabyDom.
// Nie zwracamy żadnych prywatnych kluczy InPost/ShipX.
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const token = (process.env.INPOST_GEOWIDGET_TOKEN || '').trim();
  return res.status(200).json({token});
}
