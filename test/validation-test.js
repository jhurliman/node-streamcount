const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('..');
const { CountMinSketch: CMS, HyperLogLog: HLL } = api;
const invalid = [0, -1, NaN, Infinity, -Infinity, 1, '0.1', null, undefined];

test('constructors reject invalid probabilities and impractical allocations', () => {
  for (const value of invalid) {
    assert.throws(() => new CMS(10, value, .1), RangeError);
    assert.throws(() => new CMS(10, .1, value), RangeError);
    assert.throws(() => new HLL(value), RangeError);
  }
  for (const value of [0, -1, 1.5, Infinity, NaN, '10', 1048577]) assert.throws(() => new CMS(value, .1, .1), RangeError);
  for (const value of [Number.MIN_VALUE, 1e-100]) {
    assert.throws(() => new CMS(10, value, .1), RangeError);
    assert.throws(() => new CMS(10, .1, value), RangeError);
    assert.throws(() => new HLL(value), RangeError);
  }
});
test('factory defaults apply only to omitted values and size helpers agree', () => {
  for (const value of [0, null, NaN, '0.1']) {
    assert.throws(() => api.createUniquesCounter(value));
    assert.throws(() => api.createViewsCounter(10, value));
    assert.throws(() => api.getUniquesObjSize(value));
    assert.throws(() => api.getViewsObjSize(value));
  }
  assert.equal(api.createUniquesCounter().serialize().length, api.getUniquesObjSize());
  assert.equal(api.createViewsCounter(10).serialize().length, api.getViewsObjSize());
  assert.equal(new HLL(.99).M.length, 16);
});
test('versioned empty and partially full sketches preserve their capacity', () => {
  for (const initial of [[], ['a'], ['a','b']]) {
    const original = new CMS(5, .05, .01);
    initial.forEach(key => original.increment(key));
    const restored = CMS.deserialize(original.serialize());
    for (const key of ['c','d','e','f','g']) restored.increment(key);
    assert.equal(restored.getTopK().length, 5);
  }
});
test('legacy fixtures import, retain bytes on legacy export, and accept explicit capacity', () => {
  const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/legacy-cms.bin'));
  const restored = CMS.deserialize(bytes, 0, bytes.length, {maxEntries: 5});
  assert.deepEqual(restored.serialize({legacy: true}), bytes);
  for (const key of ['c','d','e']) restored.increment(key);
  assert.equal(restored.getTopK().length, 5);
  assert.equal(CMS.deserialize(bytes).getTopK().length, 2);
  const hll = fs.readFileSync(path.join(__dirname, 'fixtures/legacy-hll.bin'));
  assert.deepEqual(HLL.deserialize(hll).serialize(), hll);
});
test('legacy empty sketches can recover capacity when supplied', () => {
  const bytes = new CMS(10, .2, .1).serialize({legacy:true});
  const restored = CMS.deserialize(bytes, undefined, undefined, {maxEntries:10});
  ['a','b','c'].forEach(key => restored.increment(key));
  assert.equal(restored.getTopK().length, 3);
  assert.throws(() => CMS.deserialize(bytes, undefined, undefined, {maxEntries:0}));
  assert.throws(() => CMS.deserialize(new CMS(10,.2,.1).serialize(), undefined, undefined, {maxEntries:5}));
});
test('Unicode and long keys roundtrip without truncation', () => {
  const sketch = new CMS(10,.1,.1);
  const keys = ['', '__proto__', 'é🙂'.repeat(100)];
  keys.forEach(key => sketch.increment(key));
  assert.deepEqual(CMS.deserialize(sketch.serialize()).getTopK(), sketch.getTopK());
  assert.throws(() => sketch.serialize({legacy:true}), /255/);
  for (const key of [null, 123, {}, '\ud800', 'a'.repeat(1048577)]) {
    const before = sketch.serialize();
    assert.throws(() => sketch.increment(key));
    assert.deepEqual(sketch.serialize(), before);
    assert.throws(() => new HLL(.1).add(key));
  }
});
test('every truncated payload fails, and readers honor exact byte windows', () => {
  for (const [Type, bytes] of [[CMS,new CMS(2,.2,.1).serialize()], [CMS,new CMS(2,.2,.1).serialize({legacy:true})], [HLL,new HLL(.2).serialize()]]) {
    for (let size=0;size<bytes.length;size++) assert.throws(() => Type.deserialize(bytes.subarray(0,size)));
    const wrapped=Buffer.concat([Buffer.alloc(7),bytes,Buffer.alloc(3)]);
    assert.deepEqual(Type.deserialize(wrapped,7,bytes.length).serialize(), Type.deserialize(bytes).serialize());
    assert.deepEqual(Type.deserialize(Buffer.concat([Buffer.alloc(7),bytes]),7).serialize(),Type.deserialize(bytes).serialize());
    assert.throws(() => Type.deserialize(wrapped,7));
    for (const value of [-1,.5,NaN,Infinity,'0',null]) {
      assert.throws(() => Type.deserialize(bytes,value));
      assert.throws(() => Type.deserialize(bytes,0,value));
    }
    assert.throws(() => Type.deserialize(bytes,bytes.length+1));
    assert.throws(() => Type.deserialize(bytes,0,0));
    assert.throws(() => Type.deserialize(new Uint8Array(bytes)));
  }
});
test('malformed dimensions, ranks and scale factors fail before allocation', () => {
  const cms=new CMS(2,.2,.1).serialize();
  for(const [offset,value] of [[4,0],[8,32],[12,0],[12,0xffffffff],[16,1]]) {
    const mutated=Buffer.from(cms);mutated.writeUInt32LE(value,offset);assert.throws(()=>CMS.deserialize(mutated));
  }
  const hll=new HLL(.2).serialize();
  for(const [offset,value] of [[0,0],[0,32],[12,100]]) {
    const mutated=Buffer.from(hll);mutated.writeUInt32LE(value,offset);assert.throws(()=>HLL.deserialize(mutated));
  }
  for(const value of [NaN, Infinity, -1, .1]) {
    const mutated=Buffer.from(hll);mutated.writeDoubleLE(value,4);assert.throws(()=>HLL.deserialize(mutated));
  }
});
test('malformed heap keys, duplicate entries, hash counts and UTF-8 reject', () => {
  const s=new CMS(2,.2,.1);s.increment('a');s.increment('b');const bytes=s.serialize();
  const depth=bytes.readUInt32LE(12), width=bytes.readUInt32LE(16);
  const hashes=20+depth*width*4, heap=hashes+4+depth*4, entries=heap+4;
  for(const [offset,value] of [[hashes,0],[hashes+4,2],[heap,3],[entries,0],[entries+4,0xffffffff]]) {
    const b=Buffer.from(bytes);b.writeUInt32LE(value,offset);assert.throws(()=>CMS.deserialize(b));
  }
  const duplicate=Buffer.from(bytes);duplicate[entries+9+8]=duplicate[entries+8];assert.throws(()=>CMS.deserialize(duplicate),/duplicate/);
  const invalidUtf8=Buffer.from(bytes);invalidUtf8[entries+8]=0xff;assert.throws(()=>CMS.deserialize(invalidUtf8),/UTF-8/);
});
test('overflowing counters reject atomically', () => {
  const bytes=new CMS(2,.2,.1).serialize();
  const depth=bytes.readUInt32LE(12),width=bytes.readUInt32LE(16);
  for(let offset=20;offset<20+depth*width*4;offset+=4)bytes.writeUInt32LE(0xffffffff,offset);
  const sketch=CMS.deserialize(bytes);const before=sketch.serialize();
  assert.throws(()=>sketch.increment('a'),/overflow/);assert.deepEqual(sketch.serialize(),before);
});
test('invalid merge sources reject before modifying the destination', () => {
  const target=new HLL(.2);target.add('a');const before=target.serialize();
  const source=new HLL(.2);source.M[0]=2;source.M[source.M.length-1]=100;
  assert.throws(()=>target.merge(source));assert.deepEqual(target.serialize(),before);
});

test('signed-minimum hashes address valid buckets', () => {
  const hashing = require('../lib/hashing');
  const original = hashing.fnv1a;
  try {
    hashing.fnv1a = () => -2147483648;
    const sketch = new CMS(2,.2,.1);
    sketch.increment('edge'); sketch.increment('edge');
    assert.deepEqual(sketch.getTopK(), [[2,'edge']]);
    assert.deepEqual(CMS.deserialize(sketch.serialize()).getTopK(), [[2,'edge']]);
  } finally { hashing.fnv1a = original; }
});
