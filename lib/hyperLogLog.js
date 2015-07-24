var hashing = require('./hashing');

module.exports = HyperLogLog;

var POW_2_32 = 0xFFFFFFFF + 1;

/**
 * HyperLogLog is an algorithm for estimating the cardinality of a set. It is
 * useful for real-time web analytics, such as counting the number of unique
 * visitors.
 *
 * See <http://highscalability.com/blog/2012/4/5/big-data-counting-how-to-count-a-billion-distinct-objects-us.html>
 *
 * @param {Number} stdError A value from (0-1) indicating the acceptable error
 *        rate. This controls the accuracy / memory usage tradeoff. 0.065 is a
 *        reasonable starting point.
 * @param {Array} M Internal use.
 * @param {Number} k_comp Internal use.
 * @param {Number} alpha_m Internal use.
 */
function HyperLogLog(stdError, M, k_comp, alpha_m) {
  var m;

  if (!M) {
    // Compute the number of bits to use for register indexing
    // From the original paper, stdError = 1.04/sqrt(m).
    var acc = 1.04 / stdError;
    var k = Math.ceil(log2(acc * acc));

    // 32 minus register indexing bits leaves the number of bits used to count
    // consecutive zeros in
    k_comp = 32 - k;
    // Compute the size of the register array as 2^register_indexing_bits
    m = Math.pow(2, k);

    // Determine the value of the scale factor alpha_m by using hardcoded
    // values from the paper for m in [16...64], otherwise a formula
    alpha_m = (m == 16) ? 0.673
      : m == 32 ? 0.697
      : m == 64 ? 0.709
      : 0.7213 / (1 + 1.079 / m);

    // Initialize the register array to all zeros
    this.M = new Array(m);
    for (var i = 0; i < m; ++i)
      this.M[i] = 0;
  } else {
    // Since M was not specified, assume we are constructing from deserialized
    // data
    m = M.length;
    this.M = M;
  }

  /**
   * Add a member to the set.
   * @param {String} key Key to add to the set.
   */
  function add(key) {
    // Map the key to an integer value
    var hash = hashing.fnv1a(key);
    // Use the k left-most bits as a register index `j`
    var j = hash >>> k_comp;
    // Compare the rank (position of the right-most 1-bit in the hash) with the
    // existing register value, keeping the larger of the two
    this.M[j] = Math.max(this.M[j], rank(hash, k_comp));
  }

  /**
   * Count the number of unique members in the set.
   * @returns {Number} Estimated cardinality of the set.
   */
  function count() {
    // Initial estimate based on the harmonic mean of all register values
    // multiplied by scale factor alpha_m
    // E = alpha_m * m^2 * sum(2^-M[j])^-1
    var i, c = 0.0;
    for (i = 0; i < m; ++i)
      c += 1 / Math.pow(2, this.M[i]);
    var E = alpha_m * m * m / c;

    // Make corrections
    if (E <= 5 / 2 * m) {
      // Small range correction. E = m * log(m / empty_register_count)
      var V = 0;
      for (i = 0; i < m; ++i) {
        if (this.M[i] === 0)
          ++V;
      }
      if (V > 0)
        E = m * Math.log(m / V);
    } else if (E > 1 / 30 * POW_2_32) {
      // Large range correction, uses the alternative formula below
      E = -POW_2_32 * Math.log(1 - E / POW_2_32);
    }

    return E;
  }

  /**
   * Serializes this data structure to a binary buffer.
   * @returns {Buffer} Binary buffer holding the serialized form of this
   *          structure.
   */
  function serialize() {
    var buffer = new Buffer(12 + this.M.length * 4);
    buffer.writeUInt32LE(k_comp, 0, true);
    buffer.writeDoubleLE(alpha_m, 4, true);
    for (var i = 0; i < this.M.length; i++)
      buffer.writeUInt32LE(this.M[i], 12 + i * 4, true);
    return buffer;
  }

  /**
   * Merge another HyperLogLog structure of the same size into this one.
   * @param {HyperLogLog} hyperLogLog The structure to merge in.
   */
  function merge(hyperLogLog) {
    if (hyperLogLog.M.length != this.M.length)
      throw new Error('cannot merge HyperLogLog structures of different size');

    for (var i = 0; i < hyperLogLog.M.length; i++) {
      if (hyperLogLog.M[i] > this.M[i])
        this.M[i] = hyperLogLog.M[i];
    }
  }

  return { add: add, count: count, serialize: serialize, merge: merge, M: this.M };
}

/**
 * Deserialize a binary buffer into a reconstituted HyperLogLog structure.
 * @param {Buffer} buffer Binary buffer holding the serialized structure.
 * @param {Number} start Starting offset of the structure in the buffer.
 * @param {Number} length Length of the serialized structure in the buffer.
 * @returns {HyperLogLog} A HyperLogLog object.
 */
HyperLogLog.deserialize = function(buffer, start, length) {
  start = start || 0;
  length = length || buffer.length;
  if (start + length > buffer.length)
    throw new Error('start and buffer cannot go past the end of buffer');
  if (length * 0.25 !== Math.floor(length * 0.25))
    throw new Error('length must be a multiple of 4');

  var k_comp = buffer.readUInt32LE(start + 0, true);
  var alpha_m = buffer.readDoubleLE(start + 4, true);
  var m = (length - 12) * 0.25;

  var M = new Array(m);
  for (var i = 0; i < m; i++)
    M[i] = buffer.readUInt32LE(start + 12 + i * 4, true);

  return new HyperLogLog(null, M, k_comp, alpha_m);
};

function log2(x) {
  return Math.log(x) / Math.LN2;
}

function rank(hash, max) {
  // Returns the position of the right-most 1-bit of the binary string of hash,
  // considering up to `max` bits
  var r = 1;
  while ((hash & 1) === 0 && r <= max) {
    ++r;
    hash >>>= 1; // Zero-fill right shift by one
  }
  return r;
}
