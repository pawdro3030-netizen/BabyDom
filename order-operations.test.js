import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize } from '../lib/admin-auth.js';
import { emailPayload } from '../lib/order-emails.js';
test('admin fails closed and requires exact token',()=>{const res={setHeader(){},status(n){this.code=n;return this},json(){}};process.env.ADMIN_TOKEN='x'.repeat(32);assert.equal(authorize({headers:{authorization:'Bearer '+ 'x'.repeat(32)}},res),true);assert.equal(authorize({headers:{authorization:'Bearer no'}},res),false);assert.equal(res.code,401);delete process.env.ADMIN_TOKEN;assert.equal(authorize({headers:{}},res),false);assert.equal(res.code,503)});
test('receipt escapes customer input and uses saved amounts',()=>{const o={order_number:'BD-1',customer_name:'<script>x</script>',customer_email:'test@example.com',items:[{name:'A&B',qty:2,lineTotal:2000}],amount:3299};const p=emailPayload(o,'customer');assert.deepEqual(p.to,['test@example.com']);assert.ok(p.html.includes('&lt;script&gt;'));assert.ok(p.html.includes('A&amp;B'));assert.ok(p.html.includes('32,99'));assert.ok(!p.html.includes('<script>'))});
