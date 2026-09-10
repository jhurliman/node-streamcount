var assert = require('assert');
var api = require('..');
var sketch = api.createViewsCounter(10);
sketch.increment('__proto__');
var restored = api.CountMinSketch.deserialize(sketch.serialize());
restored.increment('another');
assert.strictEqual(restored.getTopK().length, 2);
var hll = api.createUniquesCounter(); hll.add('key');
assert.ok(api.HyperLogLog.deserialize(hll.serialize()).count() > 0);
assert.throws(function() { api.createViewsCounter(0); });

var weighted = require('..').createViewsCounter(3);
weighted.increment('weighted', 7);
if (weighted.getTopK()[0][0] !== 7) throw new Error('weighted increment');
