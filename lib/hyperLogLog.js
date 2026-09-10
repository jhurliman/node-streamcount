'use strict';
var hashing = require('./hashing');
var valid = require('./validation');
var POW_2_32 = 0x100000000;
module.exports = HyperLogLog;

function HyperLogLog(stdError) {
  var m = valid.hllLayout(stdError);
  return create(new Array(m).fill(0), 32 - Math.round(Math.log(m) / Math.LN2), valid.alpha(m));
}

function checkRegisters(M, k_comp) {
  if (!Array.isArray(M) || M.length !== Math.pow(2, 32 - k_comp))
    throw new RangeError('invalid register array length');
  for (var i = 0; i < M.length; i++) valid.integer(M[i], 0, k_comp + 1, 'register rank');
}

function create(M, k_comp, alpha_m) {
  var m = M.length;
  return {
    M: M,
    add: function(key) {
      valid.key(key);
      var hash = hashing.fnv1a(key), j = hash >>> k_comp;
      this.M[j] = Math.max(this.M[j], rank(hash, k_comp));
    },
    count: function() {
      var sum = 0, empty = 0;
      for (var i = 0; i < m; i++) {
        sum += 1 / Math.pow(2, this.M[i]);
        if (this.M[i] === 0) empty++;
      }
      var estimate = alpha_m * m * m / sum;
      if (estimate <= 2.5 * m && empty > 0) return m * Math.log(m / empty);
      if (estimate > POW_2_32 / 30)
        return estimate >= POW_2_32 ? Infinity : -POW_2_32 * Math.log(1 - estimate / POW_2_32);
      return estimate;
    },
    serialize: function() {
      checkRegisters(this.M, k_comp);
      var buffer = Buffer.alloc(12 + m * 4);
      buffer.writeUInt32LE(k_comp, 0); buffer.writeDoubleLE(alpha_m, 4);
      for (var i = 0; i < m; i++) buffer.writeUInt32LE(this.M[i], 12 + i * 4);
      return buffer;
    },
    merge: function(other) {
      if (!other || !Array.isArray(other.M) || other.M.length !== m)
        throw new RangeError('cannot merge HyperLogLog structures of different size');
      // Validate the complete source before mutating the destination.
      checkRegisters(other.M, k_comp);
      for (var i = 0; i < m; i++) this.M[i] = Math.max(this.M[i], other.M[i]);
    }
  };
}

HyperLogLog.deserialize = function(buffer, start, length) {
  var r = valid.reader(buffer, start, length);
  var k_comp = r.u32();
  // Legacy files may contain fewer than 16 registers; keep them readable.
  valid.integer(k_comp, 12, 31, 'register index bits');
  var m = Math.pow(2, 32 - k_comp), alpha = r.f64();
  if (!Number.isFinite(alpha) || Math.abs(alpha - valid.alpha(m)) > 1e-15)
    throw new RangeError('invalid HyperLogLog scale factor');
  if (r.length !== 12 + m * 4) throw new RangeError('inconsistent register byte length');
  var M = new Array(m);
  for (var i = 0; i < m; i++) M[i] = valid.integer(r.u32(), 0, k_comp + 1, 'register rank');
  r.end();
  return create(M, k_comp, alpha);
};

function rank(hash, max) {
  var r = 1;
  while ((hash & 1) === 0 && r <= max) { ++r; hash >>>= 1; }
  return r;
}
