# Serialization and migration

CountMinSketch writes the versioned **CMS2** format by default. Readers automatically accept the old untagged layout. Integers are unsigned 32-bit little-endian, except legacy key lengths (one byte).

CMS2: magic bytes `CMS2`, original `maxEntries`, log2(width), depth, width, `depth * width` row-major counters, hash count (equal to depth), that many odd hash multipliers, entry count, then each entry's count, UTF-8 byte length and key bytes. Each key length is uint32. Legacy omits the first eight bytes and uses uint8 key lengths.

To write bytes for an old reader, use `sketch.serialize({ legacy: true })`. This rejects keys longer than 255 UTF-8 bytes and cannot preserve capacity. New files cannot be read by old package versions.

Old files do not contain capacity. Import them with `CountMinSketch.deserialize(buffer, start, length, { maxEntries: originalCapacity })` if known. If omitted, legacy capacity defaults to the stored entry count, or one for an empty sketch. A supplied capacity must be at least the stored entry count. Versioned files preserve capacity automatically and reject conflicting overrides.

HyperLogLog retains its layout: uint32 `32 - log2(registerCount)`, float64 scale factor, then uint32 registers. Legacy files with 2/4/8 registers remain readable, although new counters allocate at least 16. Saturation at the limit of the 32-bit hash universe reports Infinity rather than NaN.

Readers honor the exact `(start, length)` byte window; omitted length means the rest of the buffer after start. Trailing or truncated bytes, invalid dimensions, invalid UTF-8, duplicate keys, inconsistent entry counts and impossible registers reject synchronously. Buffers from concatenated streams must be passed with their exact length.

## Bounds

- Probabilities/error rates must be finite numbers strictly between zero and one. Factory defaults apply only when an argument is omitted.
- CMS: 1–1,048,576 capacity; 1–64 rows; power-of-two width from 4–1,048,576; no more than 4,194,304 cells in total.
- HLL: newly constructed register arrays contain 16–1,048,576 registers.
- Keys must be valid Unicode strings, at most 1,048,576 UTF-8 bytes. Empty strings are allowed.
- Serialized buffers are limited to 64 MiB. Limits are checked before data-dependent allocation.
- Counts cannot exceed uint32. An increment that would overflow rejects before changing state.

These validation rules and the default CMS2 output are breaking changes and belong in the next major release. The legacy hash mapping is retained, with the signed-minimum bucket calculation corrected so it cannot produce a negative array index.
