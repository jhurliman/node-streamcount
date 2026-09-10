'use strict';

exports.MAX_CELLS = 4194304;
exports.MAX_ENTRIES = 1048576;
exports.MAX_BYTES = 67108864;
exports.MAX_KEY_BYTES = 1048576;

function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new RangeError(name + ' must be an integer in [' + min + ', ' + max + ']');
  return value;
}
exports.integer = integer;

function probability(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 1)
    throw new RangeError(name + ' must be finite and strictly between 0 and 1');
}

exports.cmsLayout = function(epsilon, delta) {
  probability(epsilon, 'epsilon');
  probability(delta, 'delta');
  var depth = Math.ceil(-Math.log(delta));
  var lgWidth = Math.ceil(Math.log(Math.ceil(Math.E / epsilon)) / Math.LN2);
  integer(depth, 1, 64, 'depth');
  integer(lgWidth, 2, 20, 'width exponent');
  var width = Math.pow(2, lgWidth);
  integer(depth * width, 1, exports.MAX_CELLS, 'cell count');
  return { depth: depth, width: width, lgWidth: lgWidth };
};

exports.hllLayout = function(stdError) {
  probability(stdError, 'stdError');
  var k = Math.max(4, Math.ceil(2 * Math.log(1.04 / stdError) / Math.LN2));
  integer(k, 4, 20, 'register exponent');
  return Math.pow(2, k);
};

exports.alpha = function(m) {
  return m === 16 ? 0.673 : m === 32 ? 0.697 : m === 64 ? 0.709 : 0.7213 / (1 + 1.079 / m);
};

exports.key = function(key) {
  if (typeof key !== 'string') throw new TypeError('key must be a string');
  // ASCII is the usual hot path. UTF-8 roundtrips reject unpaired surrogates.
  if (key.length > exports.MAX_KEY_BYTES) throw new RangeError('key is too long');
  if (/[^\x00-\x7f]/.test(key)) {
    var encoded = Buffer.from(key, 'utf8');
    if (encoded.length > exports.MAX_KEY_BYTES) throw new RangeError('key is too long');
    if (encoded.toString('utf8') !== key) throw new TypeError('key must be valid Unicode');
  }
};

exports.reader = function(buffer, start, length) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer');
  start = start === undefined ? 0 : start;
  integer(start, 0, buffer.length, 'start');
  length = length === undefined ? buffer.length - start : length;
  integer(length, 0, Math.min(buffer.length - start, exports.MAX_BYTES), 'length');
  var data = buffer.slice(start, start + length);
  var pos = 0;
  function need(bytes) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > data.length - pos)
      throw new RangeError('truncated serialized sketch');
  }
  return {
    need: need,
    u32: function() { need(4); var x = data.readUInt32LE(pos); pos += 4; return x; },
    f64: function() { need(8); var x = data.readDoubleLE(pos); pos += 8; return x; },
    u8: function() { need(1); return data[pos++]; },
    string: function(size) {
      integer(size, 0, exports.MAX_KEY_BYTES, 'key byte length'); need(size);
      var raw = data.slice(pos, pos + size); pos += size;
      var str = raw.toString('utf8');
      if (!Buffer.from(str, 'utf8').equals(raw)) throw new TypeError('invalid UTF-8 key');
      return str;
    },
    end: function() { if (pos !== data.length) throw new RangeError('trailing serialized data'); },
    length: data.length
  };
};
