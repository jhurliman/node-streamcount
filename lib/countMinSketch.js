var MinHeap = require('./minHeap');
var hashing = require('./hashing');
var PRNG = require('./prng');

module.exports = CountMinSketch;

var INT_SIZE = 32;
var MAX_INT = 0xFFFFFFFF;

/**
 * Count-Min Sketch is an algorithm for estimating frequency counts for large
 * amounts of data. It is useful in real-time web analytics, such as counting
 * the number of times every video on a site has been watched.
 *
 * See <https://sites.google.com/site/countminsketch/> and
 * <http://agkn.files.wordpress.com/2011/09/count-min_sketch7.gif>
 *
 * @param {Number} maxEntries Maximum number of members to track frequency
 *        counts for. Only this many of the most frequently occurring members
 *        will be returned by getTopK().
 * @param {Number} epsilon The maximum error when answering a query will be
 *        within a factor of epsilon.
 * @param {Number} delta The probability of getting the answer for a query
 *        completely wrong. From (0-1).
 * @param {Number} lgWidth Internal use.
 * @param {Array} counts Internal use.
 * @param {Array} hashFunctions Internal use.
 * @param {Array} heap Internal use.
 */
function CountMinSketch(maxEntries, epsilon, delta, lgWidth, counts, hashFunctions, heap) {
  var i;
  var mapLen = 0;
  var map = {};

  if (maxEntries) {
    // Depth of the 2D storage array. Equal to the number of hash functions
    var depth = Math.max(Math.ceil(Math.log(1.0 / delta)), 1);
    // Width of the 2D storage array. Equal to the number of buckets for each
    // hash function
    var width = Math.ceil(Math.E / epsilon);

    // Round width up to a power of 2. This implementation uses the multiply-
    // shift family of hashing functions, requiring the number of hashing
    // buckets to be a power of two and the hash function constants to be
    // positive odd integers
    lgWidth = Math.ceil(log2(width));
    width = Math.pow(2, lgWidth);

    // Initialize the columns of the 2D storage array
    counts = new Array(depth);

    // Initialize the array of random integers that define each hash function
    hashFunctions = new Array(depth);

    // Initialize the backing store for the priority queue. Later it will store
    // tuples of the form [count, key]
    heap = [];

    // Create a random number generator with a constant seed to get
    // reproducible results
    var prng = new PRNG(1);
    for (i = 0; i < depth; i++) {
      // Generate a random odd positive integer defining each hash function
      hashFunctions[i] = randomOddInt(prng);

      // Initialize each row of the 2D storage array, filling it with zeros
      counts[i] = new Array(width);
      for (var j = 0; j < width; j++)
        counts[i][j] = 0;
    }
  } else {
    // Since maxEntries was not specified, assume we are constructing from
    // deserialized data
    mapLen = heap.length;
    for (i = 0; i < heap.length; i++)
      map[heap[i][1]] = heap[i];
  }

  var heapq = new MinHeap(heap, sortAsc);

  /**
   * Record an observation of the given key.
   * @param {String} key Key to increment the observation count for.
   * @param {Number} incrementBy Number to increment counter by
   */
  function increment(key, incrementBy=1) {
    if (incrementBy < 0) {
      throw new Error(`Can't increment by a negative number`);
    } else if (incrementBy === 0) {
      return;
    }

    // Map the key to an integer value
    var ix = hashing.fnv1a(key);
    var est = MAX_INT;
    var i, j;

    // Find the lowest stored value in the corresponding buckets for this key
    for (i = 0; i < hashFunctions.length; i++) {
      j = multiplyShift(lgWidth, hashFunctions[i], ix);
      est = Math.min(est, counts[i][j]);
    }

    // Conservative update. Only update the corresponding buckets with the
    // lowest observed value, with the intuition that buckets containing higher
    // values are due to a collision
    for (i = 0; i < hashFunctions.length; i++) {
      j = multiplyShift(lgWidth, hashFunctions[i], ix);
      if (counts[i][j] === est)
        counts[i][j] = est + incrementBy;
    }

    // Update the priority queue with the updated [count, key] tuple
    updateHeap(key, est + incrementBy);
  }

  function updateHeap(key, est) {
    // If we have already hit maxEntries and this count is lower than the
    // smallest value in the priority queue, do nothing
    if (heap[0] && heap[0][0] >= est && mapLen >= maxEntries)
      return;

    // Attempt to retrieve the existing tuple for this key
    var probe = map[key];
    if (probe === undefined) {
      // Create a new [count, key] tuple
      var entry = [est, key];

      if (mapLen < maxEntries) {
        // Still growing...
        heapq.push(entry);
        if (map[key] === undefined)
          ++mapLen;
        map[key] = entry;
      } else {
        // Push this guy out
        heapq.push(entry);
        var oldEntry = heapq.pop();
        delete map[oldEntry[1]];
        --mapLen;
        if (map[key] === undefined)
          ++mapLen;
        map[key] = entry;
      }
    } else {
      // Update the existing tuple and re-sort the priority queue
      probe[0] = est;
      heapq.heap.sort(sortAsc);
    }
  }

  /**
   * Returns a sorted list of tuples containing the estimated frequency count
   * and key for the maxEntries top observed members.
   * @returns {Array} An array of length maxEntries, containing arrays where
   *          the first value is the estimated frequency count and the second
   *          value is the given key.
   */
  function getTopK() {
    // Create a copy of the heap backing store
    var vals = heapq.heap.slice(0);
    // Sort in descending order since the priority queue is sorted in ascending
    // order and only maintains partial ordering
    vals.sort(sortDesc);
    return vals;
  }

  /**
   * Serializes this data structure to a binary buffer.
   * @returns {Buffer} Binary buffer holding the serialized form of this
   *          structure.
   */
  function serialize() {
    var i;

    var heapLen = 0;
    for (i = 0; i < heapq.heap.length; i++)
      heapLen += 4 + 1 + Buffer.byteLength(heapq.heap[i][1]);

    var depth = counts.length;
    var width = counts[0].length;

    var buffer = new Buffer(
      4 +
      8 + counts.length * width * 4 +
      4 + hashFunctions.length * 4 +
      4 + heapLen);

    // lgWidth
    var pos = 0;
    buffer.writeUInt32LE(lgWidth, pos, true);
    pos += 4;
    // depth and width
    buffer.writeUInt32LE(depth, pos, true);
    pos += 4;
    buffer.writeUInt32LE(width, pos, true);
    pos += 4;
    // counts
    for (i = 0; i < depth; i++) {
      var countsRow = counts[i];
      for (var j = 0; j < width; j++)
        buffer.writeUInt32LE(countsRow[j], pos + j * 4, true);
      pos += width * 4;
    }
    // hashFunctions
    buffer.writeUInt32LE(hashFunctions.length, pos, true);
    pos += 4;
    for (i = 0; i < hashFunctions.length; i++)
      buffer.writeUInt32LE(hashFunctions[i], pos + i * 4, true);
    pos += hashFunctions.length * 4;
    // heap
    buffer.writeUInt32LE(heapq.heap.length, pos, true);
    pos += 4;
    for (i = 0; i < heapq.heap.length; i++) {
      // Estimated count
      buffer.writeUInt32LE(heapq.heap[i][0], pos, true);
      pos += 4;
      // Key
      var keyLen = Buffer.byteLength(heapq.heap[i][1]);
      buffer.writeUInt8(keyLen, pos, true);
      pos++;
      buffer.write(heapq.heap[i][1], pos, keyLen, 'utf8');
      pos += keyLen;
    }

    return buffer;
  }

  return { increment: increment, getTopK: getTopK, serialize: serialize };
}

/**
 * Deserialize a binary buffer into a reconstituted CountMinSketch structure.
 * @param {Buffer} buffer Binary buffer holding the serialized structure.
 * @param {Number} start Starting offset of the structure in the buffer.
 * @param {Number} length Length of the serialized structure in the buffer.
 * @returns {CountMinSketch} A CountMinSketch object.
 */
CountMinSketch.deserialize = function(buffer, start, length) {
  start = start || 0;
  length = length || buffer.length;
  if (start + length > buffer.length)
    throw new Error('start and buffer cannot go past the end of buffer');

  var i;

  // lgWidth
  var pos = start;
  var lgWidth = buffer.readUInt32LE(pos, true);
  pos += 4;
  // depth and width
  var depth = buffer.readUInt32LE(pos, true);
  pos += 4;
  var width = buffer.readUInt32LE(pos, true);
  pos += 4;
  // counts
  var counts = new Array(depth);
  for (i = 0; i < depth; i++) {
    counts[i] = new Array(width);
    for (var j = 0; j < width; j++)
      counts[i][j] = buffer.readUInt32LE(pos + j * 4, true);
    pos += width * 4;
  }
  // hashFunctions
  var hashFunctionsLen = buffer.readUInt32LE(pos, true);
  pos += 4;
  var hashFunctions = new Array(hashFunctionsLen);
  for (i = 0; i < hashFunctionsLen; i++)
    hashFunctions[i] = buffer.readUInt32LE(pos + i * 4, true);
  pos += hashFunctionsLen * 4;
  // heap
  var heapLen = buffer.readUInt32LE(pos, true);
  pos += 4;
  var heap = new Array(heapLen);
  for (i = 0; i < heapLen; i++) {
    // Estimated count
    var est = buffer.readUInt32LE(pos, true);
    pos += 4;
    // Key
    var keyLen = buffer.readUInt8(pos, true);
    pos++;
    var key = buffer.toString('utf8', pos, pos + keyLen, true);
    pos += keyLen;

    heap[i] = [est, key];
  }

  return new CountMinSketch(null, null, null, lgWidth, counts, hashFunctions, heap);
};

function sortAsc(a, b) {
  return a[0] - b[0];
}

function sortDesc(a, b) {
  return b[0] - a[0];
}

function log2(x) {
  return Math.log(x) / Math.LN2;
}

function multiplyShift(m, a, x) {
  return Math.abs((a * x) & MAX_INT) >> (INT_SIZE - m);
}

function randomOddInt(prng) {
  var n = Math.floor(prng.random() * (INT_SIZE - 2));
  return (n << 1) | 1;
}
