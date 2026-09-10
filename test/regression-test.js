const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CountMinSketch, getViewsObjSize } = require('..');

test('counts keys which match Object prototype properties', () => {
  const sketch = new CountMinSketch(10, 0.001, 0.001);
  sketch.increment('toString');
  assert.deepEqual(sketch.getTopK(), [[1, 'toString']]);
});
test('top-k results cannot mutate internal count or key tuples', () => {
  const sketch = new CountMinSketch(10, 0.001, 0.001);
  sketch.increment('a');
  const result = sketch.getTopK();
  result[0][0] = 100;
  result[0][1] = 'changed';
  assert.deepEqual(sketch.getTopK(), [[1, 'a']]);
});
test('size estimate uses the actual power-of-two sketch width', () => {
  const sketch = new CountMinSketch(10, 0.002, 0.0001);
  assert.equal(getViewsObjSize(0.002, 0.0001), sketch.serialize().length);
});

test('reserved keys survive serialization and later increments', () => {
  const sketch = new CountMinSketch(10, 0.001, 0.001);
  const keys = ['__proto__', 'constructor', 'toString'];
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, '0');
  for (const key of keys) sketch.increment(key);
  const restored = CountMinSketch.deserialize(sketch.serialize());
  for (const key of keys) restored.increment(key);
  assert.deepEqual(restored.getTopK().sort((a,b) => a[1].localeCompare(b[1])), keys.map(key => [2,key]).sort((a,b) => a[1].localeCompare(b[1])));
  assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype, '0'), previous);
});
test('heap repairs retain every tracked key and its count', () => {
  const sketch = new CountMinSketch(1000, 0.0005, 0.0001);
  const keys = Array.from({ length: 1000 }, (_, i) => 'item-' + i);
  keys.forEach(key => sketch.increment(key));
  for (let i = 0; i < 100000; i++) sketch.increment(keys[(i * 337) % 1000]);
  const result = sketch.getTopK();
  assert.equal(result.length, 1000);
  assert.equal(new Set(result.map(entry => entry[1])).size, 1000);
  assert.ok(result.every(entry => entry[0] === 101));
});
