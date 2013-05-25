
exports.fnv1a = fnv1a;

/**
 * An implementation of the Fowler–Noll–Vo 1a 32-bit hash function.
 *
 * See <http://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash>
 *
 * @param {String} text Input string to calculate the hash for.
 * @returns {Number} 32-bit hash value.
 */
function fnv1a(text) {
  if (typeof text !== 'string')
    text = text.toString();

  var hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return hash >>> 0;
}
