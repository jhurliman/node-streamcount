# Changelog

## Unreleased

- Count keys such as `__proto__`, `constructor` and `toString` without interacting with Object.prototype.
- Return independent top-k tuples so callers cannot modify internal sketch state.
- Match serialized-size estimates to the actual power-of-two width.
- Repair only the affected heap path on tracked-key increments instead of sorting the entire heap. A local Node 24/macOS arm64 benchmark of 100,000 repeat updates across 1,000 tracked keys measured a seven-run median of 29 ms versus 1,141 ms before this change. This is workload-specific; see `bench/repeated-updates.js`.
- Restore the original test scenarios on Node's built-in runner, add regression coverage, and add current-Node CI and explicit package contents.
- Replace deprecated Buffer construction with zero-initialized buffers.

### Release compatibility

Runtime minimum becomes Node 6 because Buffer.alloc is now used; test development requires modern Node (CI: 22/24/26). Dropping previously advertised Node 0.6 support requires a major release. No version has been bumped yet. Top-k tie ordering is unspecified and may change. The existing binary format is retained; it does not record the original top-k capacity when a sketch is serialized before filling, so that capacity cannot be fully recovered. Malformed-input/deserialization validation remains a follow-up before a release is considered complete.
