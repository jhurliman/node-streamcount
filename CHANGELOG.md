# Changelog

## 2.0.0 (release candidate)

- Add `increment(key, incrementBy = 1)` for nonnegative uint32 weights, with atomic overflow rejection and collision-correct conservative updates. Supersedes the weighted-increment proposal in #1; credit to Ruslan Dzhumakaliev.

- Count keys such as `__proto__`, `constructor` and `toString` without interacting with Object.prototype.
- Return independent top-k tuples so callers cannot modify internal sketch state.
- Match serialized-size estimates to the actual power-of-two width.
- Repair only the affected heap path on tracked-key increments instead of sorting the entire heap. A local Node 24/macOS arm64 benchmark of 100,000 repeat updates across 1,000 tracked keys measured a seven-run median of 29 ms versus 1,141 ms before this change. This is workload-specific; see `bench/repeated-updates.js`.
- Restore the original test scenarios on Node's built-in runner, add regression coverage, and add current-Node CI and explicit package contents.
- Replace deprecated Buffer construction with zero-initialized buffers.

### Release compatibility

Runtime minimum becomes Node 6 because Buffer.alloc is now used; test development requires modern Node (CI: 22/24/26). Dropping previously advertised Node 0.6 support requires a major release. The package version is prepared as 2.0.0; publication is pending. Top-k tie ordering is unspecified and may change. The follow-up below adds versioned serialization and validates malformed inputs. See SERIALIZATION.md for legacy import/export and the major-release migration.

## Release validation follow-up

- Validate construction probabilities, allocation bounds, keys and exact serialized byte windows; reject malformed data before unbounded allocation.
- Preserve CountMinSketch capacity in CMS2 output, read legacy bytes, and offer explicit legacy capacity/import and legacy export options. See SERIALIZATION.md.
- Reject overflowing counters atomically and validate HLL merges before mutation.
- Fix the signed-minimum hash bucket edge case and retain the existing mapping for all other hashes.
- Add legacy golden fixtures and tests for truncation, malformed metadata, invalid Unicode, capacity preservation and overflow.

- Add complete root/deep-import TypeScript declarations, packed runtime/type consumer tests, a Node 6 runtime-floor check, and remove the obsolete Travis matrix identified in review.
