// Zgodność ze starszym checkoutem BabyDom: także tutaj ceny i dostępność
// pochodzą z panelu administracyjnego i są weryfikowane przed płatnością.
const money=n=>n.toLocaleString('pl-PL',{style:'currency',currency:'PLN'});
const cart=JSON.parse(localStorage.getItem('babydom-cart')||'[]');
const delivery=localStorage.getItem('babydom-delivery')==='kurier'?'kurier':'paczkomat';
const form=document.querySelector('#order-form');
const submitButton=form.querySelector('button[type="submit"]');
let catalogReady=false;
const notice=document.createElement('p');
notice.setAttribute('role','status');
notice.style.color='#9b3b3b';
form.insertBefore(notice,submitButton);
const locker=document.querySelector('[name=lockerCode]');
locker.required=delivery==='paczkomat';
document.querySelector('#locker-label').hidden=!locker.required;
if (window.setupInpostPicker) window.setupInpostPicker(document.querySelector('#locker-label'));
function shippingPrice(subtotal){return subtotal>=149?0:delivery==='kurier'?15.99:12.99}
function renderSummary(){
 const subtotal=cart.reduce((sum,x)=>sum+Number(x.price||0)*x.qty,0);
 const shipping=shippingPrice(subtotal);
 const container=document.querySelector('#order-items');container.replaceChildren();
 for(const item of cart){
  const row=document.createElement('div');row.className='summary-item';
  const name=document.createElement('span');name.textContent=item.name||('Produkt #'+item.id);
  const detail=document.createElement('small');
  detail.textContent=item.qty+' × '+money(Number(item.price||0))+(item.available===false?' — Niedostępny':'');
  name.append(detail);
  const amount=document.createElement('b');amount.textContent=money((Number(item.price)||0)*item.qty);
  row.append(name,amount);container.append(row);
 }
 const row=document.createElement('div');row.className='summary-item';
 const label=document.createElement('span');label.textContent=delivery==='kurier'?'Kurier':'Paczkomat';
 const amount=document.createElement('b');amount.textContent=shipping?money(shipping):'Gratis';
 row.append(label,amount);container.append(row);
 document.querySelector('#order-total').textContent=money(subtotal+shipping);
 document.querySelector('#delivery-info').textContent=
  (delivery==='kurier'?'Kurier 15,99 zł':'Paczkomat 12,99 zł')+
  (shipping===0?' — dostawa bezpłatna':'')+'. Wysyłka we wtorki i piątki.';
 submitButton.disabled=!catalogReady||cart.some(x=>x.available===false);
}
async function syncPrices(){
 const response=await fetch('/api/products',{cache:'no-store'});
 if(!response.ok)throw new Error('Nie można sprawdzić aktualnych cen i dostępności.');
 const data=await response.json();
 if(!Array.isArray(data.overrides))throw new Error('Nieprawidłowe dane katalogu.');
 const map=new Map(data.overrides.map(x=>[x.id,x]));
 const unavailableDefaults=new Set(Array.isArray(data.defaultUnavailable)?data.defaultUnavailable.map(Number):[]);
 for(const item of cart){
  const override=map.get(Number(item.id));
  if(override){
   item.price=override.priceCents/100;
   item.available=override.available!==false;
  }else{
   item.available=!unavailableDefaults.has(Number(item.id));
  }
 }
 catalogReady=true;renderSummary();
}
if(!cart.length){
 location.replace('index.html#produkty');
}else{
 submitButton.disabled=true;notice.textContent='Sprawdzanie aktualnych cen i dostępności…';
 syncPrices().then(()=>{notice.textContent=cart.some(x=>x.available===false)?'Koszyk zawiera niedostępny produkt. Wróć do sklepu.':''})
 .catch(e=>{notice.textContent=e.message;catalogReady=false;submitButton.disabled=true});
}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!form.reportValidity()||!catalogReady)return;
 const before=cart.map(x=>Number(x.price));
 submitButton.disabled=true;notice.textContent='Potwierdzanie aktualnych cen…';
 try{
  await syncPrices();
  if(cart.some(x=>x.available===false))throw new Error('Produkt stał się niedostępny. Wróć do sklepu.');
  if(cart.some((x,i)=>before[i]!==Number(x.price))){
   notice.textContent='Cena zmieniła się. Sprawdź nową kwotę i kliknij ponownie.';
   submitButton.disabled=false;return;
  }
  const fd=new FormData(form);
  const customer={
   name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone'),
   street:fd.get('street'),postalCode:fd.get('postcode'),city:fd.get('city'),lockerCode:fd.get('lockerCode')
  };
  const items=cart.map(x=>({id:Number(x.id),qty:x.qty,expectedUnitPrice:Math.round(Number(x.price)*100)}));
  submitButton.textContent='Łączenie z Przelewy24…';
  const response=await fetch('/api/p24-register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer,items,delivery})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Nie udało się rozpocząć płatności.');
  if(!data.redirectUrl)throw new Error('Serwer nie zwrócił adresu płatności.');
  localStorage.setItem('babydom-last-order',JSON.stringify({sessionId:data.sessionId,orderNumber:data.orderNumber}));
  window.location.href=data.redirectUrl;
 }catch(e){notice.textContent=e.message}
 finally{submitButton.disabled=!catalogReady||cart.some(x=>x.available===false);submitButton.textContent='Przejdź do płatności →'}
});
