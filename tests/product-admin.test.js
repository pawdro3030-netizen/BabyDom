import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { catalog } from '../api/_catalog.js';

const file = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('sklep oraz panel mają prawidłową składnię JavaScript', () => {
  for (const path of ['index.html','admin-products.html']) {
    const html=file(path);
    const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length>0,path+' should contain a script');
    for(const block of blocks) new Script(block[1],{filename:path});
  }
});
test('endpointy i moduł danych mają poprawną składnię',()=>{
  for(const path of ['api/admin-products.js','api/products.js','api/p24-register.js','lib/product-overrides.js','checkout.js','inpost-picker.js','api/inpost-widget-config.js','delivery-address.js']){
    execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
  }
});
test('ceny bazowe serwera zgadzają się z cenami na stronie',()=>{
  const match=file('index.html').match(/const P=(\[[^\n]*\]);/);
  assert.ok(match,'missing frontend catalog');
  const frontend=JSON.parse(match[1]);
  assert.ok(frontend.length>=100);
  assert.equal(frontend.length,catalog.length);
  const ids=new Set(frontend.map(x=>x.id));
  assert.equal(ids.size,frontend.length);
  for(const product of frontend){
    const server=catalog.find(x=>x.id===product.id);
    assert.ok(server,'missing product '+product.id);
    assert.equal(server.price,product.price);
  }
});
test('panel nie zapisuje hasła w localStorage',()=>{
  const html=file('admin-products.html');
  assert.ok(html.includes("Authorization:'Bearer '+token"));
  assert.ok(!html.includes('localStorage'));
  assert.ok(html.includes('id="password"'));
});
test('koszyk i serwer weryfikują ceny oraz dostępność',()=>{
  const html=file('index.html'),backend=file('api/p24-register.js');
  assert.ok(html.includes('refreshCatalog()'));
  assert.ok(html.includes('expectedUnitPrice'));
  assert.ok(backend.includes('settings?.available === false'));
  assert.ok(backend.includes('row.expectedUnitPrice !== unitPrice'));
  assert.ok(file('checkout.js').includes('expectedUnitPrice'));
  assert.ok(file('checkout.js').includes("fetch('/api/products'"));
});

test('blokady dostawcy są jednakowe w sklepie, panelu i serwerze',()=>{
  const storefront=file('index.html');
  const frontend=JSON.parse(storefront.match(/const P=(\[[^\n]*\]);/)[1]);
  const suspended=frontend.filter(p=>p.available===false);
  assert.equal(suspended.length,24);
  for(const p of frontend) {
    const server=catalog.find(x=>x.id===p.id);
    assert.equal(p.available!==false,server.available!==false,'availability: '+p.id);
  }
  for(const id of [19,24,50,68,97,116])assert.equal(frontend.find(p=>p.id===id).available,false);
  assert.ok(file('api/p24-register.js').includes('product.available === false'));
  assert.ok(file('api/admin-products.js').includes('Ponowna aktywacja wymaga aktualizacji'));
  assert.ok(file('api/products.js').includes('defaultUnavailable'));
});

test('ceny po aktualizacji BioPlanet pozostają spójne',()=>{
  const frontend=JSON.parse(file('index.html').match(/const P=(\[[^\n]*\]);/)[1]);
  for(const [id,price] of [[1,13.19],[3,8.19],[25,12.79],[67,50.34],[107,15.79]]) {
    assert.equal(frontend.find(p=>p.id===id).price,price);
    assert.equal(catalog.find(p=>p.id===id).price,price);
  }
});

test('wybór paczkomatu ma mapę, bezpieczny fallback i walidację kodu',()=>{
  const html=file('index.html'), ui=file('inpost-picker.js'), api=file('api/inpost-widget-config.js');
  assert.ok(html.includes('data-inpost-map'));
  assert.ok(html.includes('setupInpostPicker'));
  assert.ok(file('checkout.html').includes('data-inpost-map'));
  assert.ok(ui.includes('onpointselect'));
  assert.ok(ui.includes('geowidget.inpost.pl'));
  assert.ok(ui.includes('inpost.pl/znajdz-paczkomat'));
  assert.ok(api.includes('INPOST_GEOWIDGET_TOKEN'));
  assert.ok(file('api/p24-register.js').includes('lockerCode'));
});

test('katalog pokazuje tylko dostępne produkty i obsługuje filtr marki',()=>{
  const page=file('index.html');
  assert.ok(page.includes('id="availableOnly"'));
  assert.ok(page.includes('id="brandFilter"'));
  assert.ok(page.includes('function applyFilters()'));
  const frontend=JSON.parse(page.match(/const P=(\[[^\n]*\]);/)[1]);
  const minimal=frontend.map(p=>({id:p.id,cat:p.cat,brand:p.brand,name:p.name,tag:p.tag,ean:p.ean,price:p.price,available:p.available}));
  const code=page.slice(page.indexOf('function applyFilters(){'),page.indexOf('function render(){'));
  const base=`const P=${JSON.stringify(minimal)};let shown=[],filteredCount=0,activeCategory='Wszystkie',activeBrand='',sortOrder='default',availableOnly=true,showAllProducts=true;const search={value:''};function render(){};`;
  const available=new Script(base+code+'applyFilters();({ids:shown.map(p=>p.id),count:filteredCount});').runInNewContext();
  assert.equal(available.count,frontend.filter(p=>p.available!==false).length);
  assert.ok(available.ids.every(id=>frontend.find(p=>p.id===id).available!==false));
  const brandFiltered=new Script(base+code+"activeBrand='Holle';applyFilters();shown.every(p=>p.brand==='Holle'&&p.available!==false);").runInNewContext();
  assert.equal(brandFiltered,true);
});

test('rekomendacje nie oferują niedostępnych, zakupionych ani mleka modyfikowanego',()=>{
  const page=file('index.html');
  assert.ok(page.includes('id="cartRecommendations"'));
  assert.ok(page.includes('renderRecommendations()'));
  const frontend=JSON.parse(page.match(/const P=(\[[^\n]*\]);/)[1]);
  const minimal=frontend.map(p=>({id:p.id,cat:p.cat,brand:p.brand,name:p.name,price:p.price,available:p.available}));
  const code=page.slice(page.indexOf('function recommendForCart(){'),page.indexOf('function renderRecommendations(){'));
  const script=`const P=${JSON.stringify(minimal)};const cart=[{id:1,qty:1}];const PRODUCTS_BY_ID=new Map(P.map(p=>[p.id,p]));const catalogReady=true;`+code+'recommendForCart().map(p=>p.id)';
  const ids=new Script(script).runInNewContext();
  assert.ok(ids.length>0&&ids.length<=3);
  assert.ok(ids.every(id=>{
    const p=frontend.find(p=>p.id===id);
    return id!==1&&p.available!==false&&p.cat!=='Mleka';
  }));
});

test('adres dla paczkomatu jest pobierany z wybranego punktu, kurier wymaga adresu',()=>{
  const sandbox={window:{}};
  new Script(file('delivery-address.js')).runInNewContext(sandbox);
  const fake=()=>({value:'',required:false,handlers:{},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},fire(type,detail){for(const fn of(this.handlers[type]||[]))fn({detail})}});
  const [locker,street,postal,city]=[fake(),fake(),fake(),fake()];
  const box={hidden:false,querySelector(selector){return selector==='[data-address-note]'?note:null}};
  const note={textContent:''};
  const lookup={
    '[data-delivery-address]':box,'[name="lockerCode"]':locker,
    '[name="street"]':street,'[name="postalCode"],[name="postcode"]':postal,
    '[name="city"]':city
  };
  const form={querySelector(selector){return lookup[selector]||null}};
  const ctrl=sandbox.window.setupBabyDomDeliveryAddress(form);
  assert.ok(ctrl);
  ctrl.setDelivery('paczkomat');
  assert.equal(box.hidden,true);
  assert.equal(street.required,false);
  locker.value='WRO01M';locker.fire('input');
  assert.equal(box.hidden,false);
  assert.equal(street.required,true);
  locker.fire('inpost-point-selected',{address:{street:'ul. Testowa 7',postalCode:'50-001',city:'Wrocław'}});
  assert.equal(box.hidden,true);
  assert.equal(street.value,'ul. Testowa 7');
  assert.equal(postal.value,'50-001');
  ctrl.setDelivery('kurier');
  assert.equal(box.hidden,false);
  assert.equal(street.required,true);
  assert.equal(street.value,'');
  ctrl.setDelivery('paczkomat');
  assert.equal(street.value,'ul. Testowa 7');
  assert.equal(box.hidden,true);
  assert.ok(file('inpost-picker.js').includes('address_details'));
  assert.ok(file('checkout.html').includes('data-delivery-address'));
  assert.ok(file('checkout.js').includes('setupBabyDomDeliveryAddress'));
});
