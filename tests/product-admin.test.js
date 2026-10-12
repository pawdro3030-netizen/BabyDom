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
  for(const path of ['api/admin-products.js','api/products.js','api/p24-register.js','lib/product-overrides.js','checkout.js']){
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
