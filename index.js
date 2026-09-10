var HyperLogLog = require('./lib/hyperLogLog');
var valid = require('./lib/validation');
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
  return new HyperLogLog(stdError === undefined ? 0.01 : stdError);
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
  return new CountMinSketch(topEntryCount, errFactor === undefined ? 0.002 : errFactor, failRate === undefined ? 0.0001 : failRate);
}

/**
 * Returns the serialized size of a uniques counter (HyperLogLog) object in
 * bytes given a stdError. NOTE: The memory usage will be higher than this
 * number since we serialize 32-bit integers but JavaScript uses 64-bit
 * numbers.
 */
function getUniquesObjSize(stdError) {
  return 12 + valid.hllLayout(stdError === undefined ? 0.01 : stdError) * 4;
}

/**
 * Returns the serialized size of a views counter (CountMinSketch) object in
 * bytes given an errFactor and failRate. NOTE: This does not include the size
 * of the serialized MinHeap which includes the size of each unique ID (up to a
 * max of topEntryCount) plus 8 bytes overhead per entry. NOTE2: The memory
 * usage will be higher than this number since we serialize 32-bit integers but
 * JavaScript uses 64-bit numbers.
 */
function getViewsObjSize(errFactor, failRate) {
  var layout = valid.cmsLayout(errFactor === undefined ? 0.002 : errFactor,
                              failRate === undefined ? 0.0001 : failRate);
  return 28 + layout.depth * layout.width * 4 + layout.depth * 4;
}
