import crypto from "node:crypto";
const sha384=o=>crypto.createHash("sha384").update(JSON.stringify(o)).digest("hex");
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).send("Method not allowed");
 try{
  const posId=Number(process.env.P24_POS_ID),merchantId=Number(process.env.P24_MERCHANT_ID||process.env.P24_POS_ID),crc=process.env.P24_CRC,apiKey=process.env.P24_API_KEY;
  if((process.env.P24_MODE||"sandbox").toLowerCase()!=="sandbox")return res.status(503).send("Sandbox only");
  if(!posId||!merchantId||!crc||!apiKey)return res.status(500).send("P24 not configured");
  const n=req.body||{};
  const expected=sha384({merchantId:Number(n.merchantId),posId:Number(n.posId),sessionId:String(n.sessionId),amount:Number(n.amount),originAmount:Number(n.originAmount),currency:String(n.currency),orderId:Number(n.orderId),methodId:Number(n.methodId),statement:String(n.statement),crc});
  if(!n.sign||expected!==n.sign)return res.status(400).send("Invalid sign");
  const v={merchantId,posId,sessionId:String(n.sessionId),amount:Number(n.amount),currency:String(n.currency),orderId:Number(n.orderId)};
  v.sign=sha384({sessionId:v.sessionId,orderId:v.orderId,amount:v.amount,currency:v.currency,crc});
  const auth=Buffer.from(`${posId}:${apiKey}`).toString("base64");
  const r=await fetch("https://sandbox.przelewy24.pl/api/v1/transaction/verify",{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Basic ${auth}`},body:JSON.stringify(v)});
  if(!r.ok)return res.status(502).send("Verify failed");
  return res.status(200).send("OK");
 }catch(e){return res.status(500).send("Server error")}
}