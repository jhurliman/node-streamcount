var HyperLogLog = require('./lib/hyperLogLog');
var CountMinSketch = require('./lib/countMinSketch');

exports.createUniquesCounter = createUniquesCounter;
exports.createViewsCounter = createViewsCounter;
exports.getUniquesObjSize = getUniquesObjSize;
exports.getViewsObjSize = getViewsObjSize;
exports.HyperLogLog = HyperLogLog;
exports.CountMinSketch = CountMinSketch;
exports.MinHeap = require('./lib/minHeap');
exports.PRNG = require('./lib/prng');

/**
 * Creates an object for tracking the approximate total number of unique IDs
 * observed. A common example is estimating the number of unique visitors to
 * a website.
 *
 * @param {Number} stdError (Optional) a value from (0-1) indicating the
 *        acceptable error rate. This controls the accuracy / memory usage
 *        tradeoff. 0.01 is the default.
 */
function createUniquesCounter(stdError) {
  return new HyperLogLog(stdError || 0.01);
}

/**
 * Creates an object for tracking estimated top view counts for many unique
 * IDs. A common example is tracking the most viewed products on a website.
 *
 * @param {Number} topEntryCount Maximum number of top entries to return
 *                 view counts for. This is the maximum size of the array
 *                 returned by getTopK().
 * @param {Number} errFactor (Optional) The estimated view counts returned by
 *                 getTopK() can be off by up to this percentage (0-1). This,
 *                 combined with failRate, controls the accuracy / memory usage
 *                 tradeoff. 0.002 is the default.
 * @param {Number} failRate (Optional) The probability of getting the answer
 *                 for a query completely wrong. From (0-1). This, combined
 *                 with errFactor, controls the accuracy / memory usage
 *                 tradeoff. 0.0001 is the default.
 */
function createViewsCounter(topEntryCount, errFactor, failRate) {
  return new CountMinSketch(topEntryCount, errFactor || 0.002, failRate || 0.0001);
}

/**
 * Returns the serialized size of a uniques counter (HyperLogLog) object in
 * bytes given a stdError. NOTE: The memory usage will be higher than this
 * number since we serialize 32-bit integers but JavaScript uses 64-bit
 * numbers.
 */
function getUniquesObjSize(stdError) {
  var acc = 1.04 / stdError;
  var k = Math.ceil(Math.log(acc * acc) / Math.LN2);
  return 12 + Math.pow(2, k) * 4;
}

/**
 * Returns the serialized size of a views counter (CountMinSketch) object in
 * bytes given an errFactor and failRate. NOTE: This does not include the size
 * of the serialized MinHeap which includes the size of each unique ID (up to a
 * max of topEntryCount) plus 5 bytes overhead per entry. NOTE2: The memory
 * usage will be higher than this number since we serialize 32-bit integers but
 * JavaScript uses 64-bit numbers.
 */
function getViewsObjSize(errFactor, failRate) {
  var depth = Math.max(Math.ceil(Math.log(1.0 / failRate)), 1);
  var width = Math.ceil(Math.E / errFactor);
  return 4 + 8 + depth * width * 4 + 4 + depth * 4 + 4;
}
