const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.DATA_KEY = 'a'.repeat(64);
process.env.NODE_ENV = 'test';
const { calculateTotals, transitions } = require('../dist/src/commerce/calculations');
const { encrypt, decrypt, digest, matches, token } = require('../dist/src/core/security');
const { normalizeImage } = require('../dist/src/core/image-upload');
const sharp = require('sharp');

test('totals use integer minor units and quantity', () => {
  assert.deepEqual(calculateTotals([{unitPrice:485000,quantity:2}],null,0,'delivery',12000,800000),
    {subtotal:970000,discount:0,tax:0,shipping:0,total:970000});
});
test('percentage coupon applies only to eligible items, then tax', () => {
  assert.deepEqual(calculateTotals([{unitPrice:10000,quantity:2},{unitPrice:5000,quantity:1,eligible:false}],{type:'PERCENT',value:10,minimum:20000},500,'delivery',1200,800000),
    {subtotal:25000,discount:2000,tax:1150,shipping:1200,total:25350});
});
test('fixed discount cannot exceed eligible subtotal; pickup is free', () => {
  assert.equal(calculateTotals([{unitPrice:10000,quantity:1}],{type:'FIXED',value:20000,minimum:0},0,'pickup',1200,800000).total,0);
});
test('invalid cart quantities and prices are rejected', () => {
  for(const quantity of [0,-1,1.5,51,NaN]) assert.throws(()=>calculateTotals([{unitPrice:100,quantity}],null,0,'pickup',0,0));
  for(const unitPrice of [-1,1.5,NaN,Infinity]) assert.throws(()=>calculateTotals([{unitPrice,quantity:1}],null,0,'pickup',0,0));
  assert.throws(()=>calculateTotals([],null,0,'pickup',0,0));
});
test('coupon minimum and eligibility enforced', () => {
  assert.throws(()=>calculateTotals([{unitPrice:100,quantity:1}],{type:'FIXED',value:10,minimum:200},0,'pickup',0,0));
  assert.throws(()=>calculateTotals([{unitPrice:100,quantity:1,eligible:false}],{type:'PERCENT',value:10,minimum:0},0,'pickup',0,0));
});
test('terminal orders cannot reopen or ship twice', () => {
  assert.deepEqual(transitions.CANCELLED,[]);
  assert.deepEqual(transitions.REFUNDED,[]);
  assert.deepEqual(transitions.SHIPPED,['DELIVERED']);
});
test('private data encryption round-trips and rejects tampering', () => {
  const value = JSON.stringify({od:{sph:-1.25},pd:62});
  const encrypted = encrypt(value);
  assert.equal(decrypt(encrypted).toString(),value);
  assert.notEqual(encrypt(value),encrypted);
  const damaged = Buffer.from(encrypted,'base64'); damaged[damaged.length-1] ^= 1;
  assert.throws(()=>decrypt(damaged.toString('base64')));
});
test('token matching rejects invalid hashes without crashing', () => {
  const raw = token(); assert.equal(raw.length,64);
  assert.equal(matches(raw,digest(raw)),true);
  assert.equal(matches(token(),digest(raw)),false);
  assert.equal(matches(raw,'bad-hash'),false);
});
test('image upload decodes and normalizes to WebP', async () => {
  const input = await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer();
  const output = await normalizeImage(input);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format,'webp'); assert.equal(metadata.width,10);
  assert.equal(metadata.exif,undefined);
});
test('image upload rejects forged signatures', async () => {
  await assert.rejects(normalizeImage(Buffer.from([137,80,78,71,13,10,26,10])));
});
