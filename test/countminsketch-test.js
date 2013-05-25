var vows = require('vows');
var assert = require('assert');

var CountMinSketch = require('../lib/countMinSketch');

vows.describe('CountMinSketch').addBatch({
  '20 videos, 0.0005 epsilon, 0.0001 delta': {
    topic: new CountMinSketch(20, 0.0005, 0.0001),

    'is initialized empty': function(cms) {
      assert.equal(cms.getTopK().length, 0);
    },
    'can add one': function(cms) {
      cms.increment('4d6e5acebcd1b3fac0000000');

      var top = cms.getTopK();
      assert.equal(top.length, 1);
      assert.equal(top[0][0], 1);
      assert.equal(top[0][1], '4d6e5acebcd1b3fac0000000');
    },
    'can increment': function(cms) {
      cms.increment('4d6e5acebcd1b3fac0000000');
      cms.increment('4d6e5acebcd1b3fac0000000');

      var top = cms.getTopK();
      assert.equal(top.length, 1);
      assert.equal(top[0][0], 3);
      assert.equal(top[0][1], '4d6e5acebcd1b3fac0000000');
    },
    'can add 1000000': function(cms) {
      var i;
      for (i = 1; i < 999999; i++)
        cms.increment('4d6e5acebcd1b3fac' + pad(i, 7));

      var top = cms.getTopK();
      assert.equal(top.length, 20);

      for (i = 0; i < top.length; i++) {
        var diff = Math.abs(top[i][0] - 1);
        assert.ok(diff < 100);
      }
    },
    'can add 1000 1000 times': function(cms) {
      cms = new CountMinSketch(20, 0.0005, 0.0001);

      var i;
      for (var j = 0; j < 1000; j++) {
        for (i = 1; i < 1000; i++)
          cms.increment('4d6e5acebcd1b3fac' + pad(i, 7));
      }

      var top = cms.getTopK();
      assert.equal(top.length, 20);

      for (i = 0; i < top.length; i++)
        assert.equal(top[i][0], 1000);
    },
    'can serialize and deserialize': function(cms) {
      var top = cms.getTopK();

      var packed = cms.serialize();
      assert.equal(packed.length, 218120);

      var cms2 = CountMinSketch.deserialize(packed);
      var top2 = cms2.getTopK();

      assert.equal(top.length, top2.length);
      for (var i = 0; i < top.length; i++) {
        assert.equal(top[i][0], top2[i][0]);
        assert.equal(top[i][1], top2[i][1]);
      }
    },
  },
}).export(module);

function pad(number, length) {
  var str = '' + number;
  while (str.length < length)
    str = '0' + str;
  return str;
}
