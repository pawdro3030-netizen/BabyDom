import crypto from "node:crypto";
import { catalog } from "./_catalog.js";
const sha384=o=>crypto.createHash("sha384").update(JSON.stringify(o)).digest("hex");
const clean=(v,max=120)=>String(v??"").trim().slice(0,max);
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const posId=Number(process.env.P24_POS_ID),merchantId=Number(process.env.P24_MERCHANT_ID||process.env.P24_POS_ID);
  const crc=process.env.P24_CRC,apiKey=process.env.P24_API_KEY;
  const siteUrl=(process.env.SITE_URL||`https://${req.headers.host}`).replace(/\/$/,"");
  if((process.env.P24_MODE||"sandbox").toLowerCase()!=="sandbox")return res.status(503).json({error:"Ta wersja jest zablokowana na SANDBOX."});
  if(!posId||!merchantId||!crc||!apiKey)return res.status(500).json({error:"Brak konfiguracji P24 w Vercel Environment Variables."});
  const customer=req.body?.customer||{},items=Array.isArray(req.body?.items)?req.body.items:[];
  const email=clean(customer.email,80),name=clean(customer.name,80);
  if(!email.includes("@")||!name||!items.length)return res.status(400).json({error:"Uzupełnij dane klienta i koszyk."});
  let amount=0,count=0;
  for(const row of items){
   const id=Number(row.id),qty=Math.max(1,Math.min(50,Number(row.qty)||0)),p=catalog.find(x=>x.id===id);
   if(!p)return res.status(400).json({error:"Koszyk zawiera nieznany produkt."});
   amount+=Math.round(p.price*100)*qty;count+=qty;
  }
  if(amount<1||count>100)return res.status(400).json({error:"Nieprawidłowa wartość koszyka."});
  const sessionId=`BD-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`,currency="PLN";
  const body={merchantId,posId,sessionId,amount,currency,description:`BabyDom • ${count} produkt(y)`,email,client:name,address:clean(customer.street,80),zip:clean(customer.postalCode,12),city:clean(customer.city,50),country:"PL",phone:clean(customer.phone,30),language:"pl",urlReturn:`${siteUrl}/?payment=return&sessionId=${encodeURIComponent(sessionId)}`,urlStatus:`${siteUrl}/api/p24-status`,sign:sha384({sessionId,merchantId,amount,currency,crc})};
  const auth=Buffer.from(`${posId}:${apiKey}`).toString("base64");
  const r=await fetch("https://sandbox.przelewy24.pl/api/v1/transaction/register",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Basic ${auth}`},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data?.data?.token)return res.status(502).json({error:"Przelewy24 odrzuciło rejestrację transakcji.",details:data});
  return res.status(200).json({sessionId,redirectUrl:`https://sandbox.przelewy24.pl/trnRequest/${encodeURIComponent(data.data.token)}`});
 }catch(e){return res.status(500).json({error:"Błąd serwera podczas tworzenia płatności.",details:String(e?.message||e)})}
}