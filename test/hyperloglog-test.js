var vows = require('vows');
var assert = require('assert');

var HyperLogLog = require('../lib/hyperLogLog');

vows.describe('HyperLogLog').addBatch({
  '1% error rate': {
    topic: new HyperLogLog(0.01),

    'has a length of 16384': function(hll) {
      assert.equal(hll.M.length, 16384);
    },
    'is initialized to zero': function(hll) {
      for (var i = 0; i < hll.M.length; i++)
        assert.equal(hll.M[i], 0);
    },
    'has a length of 16384': function(hll) {
      assert.equal(hll.M.length, 16384);
    },
    'has one non-zero value after one increment': function(hll) {
      hll.add('4d6e5acebcd1b3fac0000000');

      var nonZero = 0;
      for (var i = 0; i < hll.M.length; i++) {
        if (hll.M[i] !== 0)
          ++nonZero;
      }
      assert.equal(nonZero, 1);
    },
    'has two non-zero values after two increments': function(hll) {
      hll.add('4d6e5acebcd1b3fac0000001');

      var nonZero = 0;
      for (var i = 0; i < hll.M.length; i++) {
        if (hll.M[i] !== 0)
          ++nonZero;
      }
      assert.equal(nonZero, 2);
    },
    'has two non-zero values after duplicates': function(hll) {
      hll.add('4d6e5acebcd1b3fac0000000');
      hll.add('4d6e5acebcd1b3fac0000001');

      var nonZero = 0;
      for (var i = 0; i < hll.M.length; i++) {
        if (hll.M[i] !== 0)
          ++nonZero;
      }
      assert.equal(nonZero, 2);
    },
    'has a count of 2 (within 1%)': function(hll) {
      var count = hll.count();
      var diff = Math.abs(2.0 - count);

      assert.ok(diff <= 2.0 * 0.01);
    },
    'has a count of 1000000 (within 1%)': function(hll) {
      for (var i = 2; i < 999998; i++)
        hll.add('4d6e5acebcd1b3fac' + pad(i, 7));

      var count = hll.count();
      var diff = Math.abs(1000000.0 - count);

      assert.ok(diff <= 1000000.0 * 0.01);
    },
    'still has a count of 1000000 (within 1%)': function(hll) {
      for (var i = 2; i < 999998; i++)
        hll.add('4d6e5acebcd1b3fac' + pad(i, 7));

      var count = hll.count();
      var diff = Math.abs(1000000.0 - count);

      assert.ok(diff <= 1000000.0 * 0.01);
    },
    'has the same count after identical merge': function(hll) {
      var startCount = hll.count();

      var hll2 = new HyperLogLog(0.01);
      for (var i = 0; i < 1000000; i++)
        hll2.add('4d6e5acebcd1b3fac' + pad(i, 7));

      hll.merge(hll2);
      var endCount = hll.count();

      assert.equal(startCount, endCount);
    },
    'has a count of 2000000 (within 1%) after unique merge': function(hll) {
      var hll2 = new HyperLogLog(0.01);
      for (var i = 1000000; i < 2000000; i++)
        hll2.add('4d6e5acebcd1b3fac' + pad(i, 7));

      hll.merge(hll2);
      var count = hll.count();
      var diff = Math.abs(2000000.0 - count);

      assert.ok(diff <= 2000000.0 * 0.01);
    },
    'can serialize and deserialize': function(hll) {
      var packed = hll.serialize();
      assert.equal(packed.length, 65548);

      var hll2 = HyperLogLog.deserialize(packed);
      assert.equal(hll.M.length, hll2.M.length);
      for (var i = 0; i < hll.M.length; i++)
        assert.equal(hll.M[i], hll2.M[i]);

      assert.equal(hll.count(), hll2.count());
    },
  },
}).export(module);

function pad(number, length) {
  var str = '' + number;
  while (str.length < length)
    str = '0' + str;
  return str;
}
