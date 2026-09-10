# streamcount

[![CI](https://github.com/jhurliman/node-streamcount/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/jhurliman/node-streamcount/actions/workflows/ci.yml)

Approximate distinct counts and frequent-item tracking for streaming data, using **HyperLogLog** and a **Count-Min sketch**. Use them to estimate unique visitors or track popular pages without storing every observation.

## Install

```sh
npm install streamcount
```

CommonJS package with TypeScript declarations and a Node.js 6 runtime floor. The examples below describe the version 2 API in this repository; see [CHANGELOG.md](CHANGELOG.md) for release changes.

## Quick start

```js
const streamcount = require('streamcount');

// Estimate distinct visitors with a target standard error of 1%.
const visitors = streamcount.createUniquesCounter(0.01);
visitors.add('alice');
visitors.add('bob');
visitors.add('alice');
console.log(Math.round(visitors.count())); // 2

// Track up to three frequently viewed pages.
const pages = streamcount.createViewsCounter(3);
pages.increment('/');
pages.increment('/products', 5);
pages.increment('/about', 2);
pages.increment('/');
console.log(pages.getTopK());
// Counts are descending; the order of ties is unspecified.
// [[5, '/products'], [2, '/about'], [2, '/']] (ties may swap)
```

Counts are estimates. Smaller error parameters generally require more space. The configured top-k capacity limits the number of retained keys; it does not limit how many distinct keys you can observe.

## Create a counter

### `createUniquesCounter(stdError = 0.01)`

Returns a HyperLogLog counter for approximate distinct counts. `stdError` is a target relative standard error, not a guaranteed bound on each result. It must be finite and strictly between 0 and 1, within the supported allocation limits.

### `createViewsCounter(topEntryCount, errFactor = 0.002, failRate = 0.0001)`

Returns a Count-Min sketch with a bounded list of frequently observed keys.

| Parameter | Meaning |
| --- | --- |
| `topEntryCount` | Maximum number of retained entries, from 1 to 1,048,576. |
| `errFactor` | Sketch error parameter (epsilon), used to select the bucket width. Smaller values use more space. It is not a percentage-error guarantee for each returned key. |
| `failRate` | Sketch failure-probability parameter (delta), used to select the number of rows. Smaller values use more space. |

Both probability parameters must be finite and strictly between 0 and 1. Values that would exceed the [allocation limits](SERIALIZATION.md) are rejected. Defaults apply only when an option is omitted or `undefined`.

The constructors are also exported. Unlike the factory helpers, they require explicit error parameters:

```js
const { HyperLogLog, CountMinSketch } = require('streamcount');

const visitors = new HyperLogLog(0.01);
const pages = new CountMinSketch(10, 0.002, 0.0001);
```

## HyperLogLog API

| Method | Behavior |
| --- | --- |
| `add(key)` | Observe a string identifier. Repeated identifiers do not increase the distinct count. |
| `count()` | Return the estimated number of distinct identifiers. The result can be fractional. |
| `merge(other)` | Merge another HyperLogLog counter with the same register count into this counter. |
| `serialize()` | Return the counter as a binary `Buffer`. |
| `HyperLogLog.deserialize(buffer, start?, length?)` | Restore a counter from a buffer or an exact byte window within one. |

Use the same `stdError` when creating counters you plan to merge. For example, independent servers can send serialized visitor counters to a central aggregator:

```js
const streamcount = require('streamcount');

const server = streamcount.createUniquesCounter();
server.add('alice');
const aggregate = streamcount.createUniquesCounter();
aggregate.add('bob');
aggregate.merge(streamcount.HyperLogLog.deserialize(server.serialize()));
console.log(Math.round(aggregate.count())); // 2
```

## Count-Min sketch API

### `increment(key, incrementBy = 1)`

Record observations of a string key. The optional weight must be an integer from 0 to 4,294,967,295. Zero is a no-op after key validation. Invalid weights and updates that would overflow a counter throw before changing state.

Weighted updates behave like repeated single increments for that key, including when sketch buckets collide:

```js
const streamcount = require('streamcount');
const pages = streamcount.createViewsCounter(10);

pages.increment('/products', 250);
pages.increment('/products');
console.log(pages.getTopK()); // [[251, '/products']]
```

Weighted observations can aggregate complete per-key counts. Replaying only workers' top-k lists loses omitted keys and is **not a full sketch merge**. This API does not provide a Count-Min sketch merge operation.

### `getTopK()`

Return up to `topEntryCount` entries, sorted by descending estimated count. Each entry is `[count, key]`. An empty counter returns `[]`, and a partially filled counter can return fewer entries than its capacity. Tie order is unspecified. Changing the returned array or its entries does not mutate the counter.

### `serialize(options?)`

Return a binary `Buffer`. The default CMS2 format preserves the configured capacity. Use `{ legacy: true }` only when an older reader needs the previous format; legacy keys are limited to 255 UTF-8 bytes.

### `CountMinSketch.deserialize(buffer, start?, length?, options?)`

Read either CMS2 or legacy data. `start` defaults to 0, and `length` defaults to the remaining buffer length. Supply an exact byte window when the buffer contains other data.

Legacy data does not store its original capacity. Supply `{ maxEntries: originalCapacity }` as the fourth argument to recover it. Without this option, legacy capacity defaults to the number of stored entries, or 1 for an empty sketch. CMS2 already stores capacity, so a conflicting override is rejected.

```js
const { createViewsCounter, CountMinSketch } = require('streamcount');
const pages = createViewsCounter(10);
pages.increment('/products', 25);

const restored = CountMinSketch.deserialize(pages.serialize());
console.log(restored.getTopK()); // [[25, '/products']]

const legacy = pages.serialize({ legacy: true });
const imported = CountMinSketch.deserialize(
  legacy, undefined, undefined, { maxEntries: 10 }
);
```

## Serialization and storage

| Helper | Result |
| --- | --- |
| `getUniquesObjSize(stdError = 0.01)` | Serialized HyperLogLog size in bytes. |
| `getViewsObjSize(errFactor = 0.002, failRate = 0.0001)` | Fixed CMS2 size in bytes, excluding retained entries. Add 8 bytes plus the UTF-8 key length per retained entry. |

These helpers estimate serialized storage, not JavaScript heap usage. For an existing counter, `counter.serialize().length` gives its actual serialized byte length.

See [SERIALIZATION.md](SERIALIZATION.md) for binary layouts, input and allocation limits, and legacy migration details. Version 2 rejects malformed buffers, invalid Unicode keys and invalid options rather than silently selecting defaults. Old serialized data remains readable; older consumers need legacy output.

## TypeScript

Declarations cover the package root and the existing class/helper deep imports. Required Node typings are included as a dependency.

```ts
import { createViewsCounter } from 'streamcount';

const pages = createViewsCounter(10);
pages.increment('/products', 5);
const entries: Array<[number, string]> = pages.getTopK();
```

## Development

Use Node.js 22 or newer for development:

```sh
npm ci
npm test
npm run bench
npm pack
```

[GitHub Actions](https://github.com/jhurliman/node-streamcount/actions/workflows/ci.yml) runs the full suite on Node 22, 24 and 26, plus a Node 6 runtime smoke check. Package tests install the generated archive in an independent consumer and validate CommonJS, ESM and TypeScript usage. `npm publish` runs the tests through `prepublishOnly`.

## Credits and license

Weighted increments were proposed by Ruslan Dzhumakaliev in [PR #1](https://github.com/jhurliman/node-streamcount/pull/1) and implemented with validation and collision handling in [PR #6](https://github.com/jhurliman/node-streamcount/pull/6).

[MIT license](LICENSE.txt).
