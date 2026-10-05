import crypto from 'node:crypto';
export function authorize(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.ADMIN_TOKEN || '';
  const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const digest = s => crypto.createHash('sha256').update(s).digest();
  if (secret.length < 32) { res.status(503).json({error:'Ustaw ADMIN_TOKEN (minimum 32 znaki) w Vercel.'}); return false; }
  if (!crypto.timingSafeEqual(digest(secret), digest(supplied))) { res.status(401).json({error:'Nieprawidłowe hasło.'}); return false; }
  return true;
}
