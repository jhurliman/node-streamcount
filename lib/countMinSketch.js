'use strict';
var MinHeap = require('./minHeap');
var hashing = require('./hashing');
var PRNG = require('./prng');
var valid = require('./validation');
var MAX_INT = 0xFFFFFFFF;
var MAGIC = 0x32534D43; // ASCII CMS2, never a valid legacy width exponent.
module.exports = CountMinSketch;

function CountMinSketch(maxEntries, epsilon, delta) {
  valid.integer(maxEntries, 1, valid.MAX_ENTRIES, 'maxEntries');
  var layout = valid.cmsLayout(epsilon, delta);
  var counts = [], hashes = [], prng = new PRNG(1);
  for (var i = 0; i < layout.depth; i++) {
    hashes.push((Math.floor(prng.random() * 30) << 1) | 1);
    counts.push(new Array(layout.width).fill(0));
  }
  return create(maxEntries, layout.lgWidth, counts, hashes, []);
}

function create(maxEntries, lgWidth, counts, hashes, heap) {
  var map = Object.create(null);
  heap.forEach(function(entry) { map[entry[1]] = entry; });
  var heapq = new MinHeap(heap, function(a, b) { return a[0] - b[0]; });

  function increment(key, incrementBy) {
    valid.key(key);
    incrementBy = incrementBy === undefined ? 1 : incrementBy;
    valid.integer(incrementBy, 0, MAX_INT, 'incrementBy');
    if (incrementBy === 0) return;
    var ix = hashing.fnv1a(key), est = MAX_INT;
    var i, j;
    for (i = 0; i < hashes.length; i++) {
      j = bucket(lgWidth, hashes[i], ix);
      est = Math.min(est, counts[i][j]);
    }
    if (incrementBy > MAX_INT - est) throw new RangeError('counter would overflow uint32');
    var target = est + incrementBy;
    for (i = 0; i < hashes.length; i++) {
      j = bucket(lgWidth, hashes[i], ix);
      // Equivalent to repeated unit conservative updates: raise every
      // selected counter below the new minimum, preserving higher collisions.
      if (counts[i][j] < target) counts[i][j] = target;
    }
    est = target;
    var probe = map[key];
    if (probe !== undefined) {
      probe[0] = est;
      heapq.heapify(heap.indexOf(probe));
    } else if (heap.length < maxEntries || heap[0][0] < est) {
      var entry = [est, key];
      heapq.push(entry);
      map[key] = entry;
      if (heap.length > maxEntries) delete map[heapq.pop()[1]];
    }
  }

  function serialize(options) {
    options = options || {};
    if (typeof options !== 'object') throw new TypeError('options must be an object');
    var legacy = options.legacy === true;
    var bytes = (legacy ? 0 : 8) + 20 + counts.length * counts[0].length * 4 + hashes.length * 4;
    heap.forEach(function(entry) {
      var length = Buffer.byteLength(entry[1]);
      if (legacy && length > 255) throw new RangeError('legacy keys cannot exceed 255 UTF-8 bytes');
      bytes += (legacy ? 5 : 8) + length;
    });
    valid.integer(bytes, 0, valid.MAX_BYTES, 'serialized byte length');
    var buffer = Buffer.alloc(bytes), pos = 0;
    function u32(x) { buffer.writeUInt32LE(x, pos); pos += 4; }
    if (!legacy) { u32(MAGIC); u32(maxEntries); }
    u32(lgWidth); u32(counts.length); u32(counts[0].length);
    counts.forEach(function(row) { row.forEach(u32); });
    u32(hashes.length); hashes.forEach(u32); u32(heap.length);
    heap.forEach(function(entry) {
      u32(entry[0]);
      var length = Buffer.byteLength(entry[1]);
      if (legacy) buffer[pos++] = length; else u32(length);
      buffer.write(entry[1], pos, length, 'utf8'); pos += length;
    });
    return buffer;
  }
  return {
    increment: increment,
    getTopK: function() {
      return heap.map(function(entry) { return entry.slice(); }).sort(function(a, b) { return b[0] - a[0]; });
    },
    serialize: serialize
  };
}

CountMinSketch.deserialize = function(buffer, start, length, options) {
  options = options || {};
  if (typeof options !== 'object') throw new TypeError('options must be an object');
  var r = valid.reader(buffer, start, length);
  var first = r.u32(), version2 = first === MAGIC;
  var capacity = version2 ? r.u32() : undefined;
  var lgWidth = version2 ? r.u32() : first;
  valid.integer(lgWidth, 2, 20, 'width exponent');
  var depth = r.u32(), width = r.u32();
  valid.integer(depth, 1, 64, 'depth');
  if (width !== Math.pow(2, lgWidth)) throw new RangeError('inconsistent sketch width');
  valid.integer(depth * width, 1, valid.MAX_CELLS, 'cell count');
  // Validate all fixed-width data availability before allocating any row.
  r.need(depth * width * 4 + 4 + depth * 4 + 4);
  var counts = [], hashes = [], heap = [], i, j;
  for (i = 0; i < depth; i++) {
    var row = new Array(width);
    for (j = 0; j < width; j++) row[j] = r.u32();
    counts.push(row);
  }
  if (r.u32() !== depth) throw new RangeError('hash count must equal depth');
  for (i = 0; i < depth; i++) {
    var hash = r.u32();
    if (!(hash & 1)) throw new RangeError('hash multipliers must be odd');
    hashes.push(hash);
  }
  var entries = r.u32();
  valid.integer(entries, 0, valid.MAX_ENTRIES, 'entry count');
  r.need(entries * (version2 ? 8 : 5));
  if (!version2) capacity = options.maxEntries === undefined ? Math.max(1, entries) : options.maxEntries;
  valid.integer(capacity, Math.max(1, entries), valid.MAX_ENTRIES, 'maxEntries');
  if (version2 && options.maxEntries !== undefined && options.maxEntries !== capacity)
    throw new RangeError('maxEntries cannot override a versioned sketch capacity');
  var keys = Object.create(null);
  for (i = 0; i < entries; i++) {
    var count = r.u32();
    valid.integer(count, 1, MAX_INT, 'entry count');
    var key = r.string(version2 ? r.u32() : r.u8());
    if (keys[key]) throw new RangeError('duplicate sketch key');
    keys[key] = true;
    var ix = hashing.fnv1a(key);
    for (j = 0; j < depth; j++) {
      if (counts[j][bucket(lgWidth, hashes[j], ix)] < count)
        throw new RangeError('entry exceeds its sketch counters');
    }
    heap.push([count, key]);
  }
  r.end();
  return create(capacity, lgWidth, counts, hashes, heap);
};

function bucket(m, a, x) {
  // Preserve the legacy hash mapping so existing serialized counters remain usable.
  return Math.abs((a * x) & MAX_INT) >>> (32 - m);
}
