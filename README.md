# node-streamcount

[![Build Status](https://travis-ci.org/jhurliman/node-streamcount.png)](https://travis-ci.org/jhurliman/node-streamcount)

Provides implementations of "sketch" algorithms for real-time counting of
stream data.

For an overview of the type of problems these algorithms solve, read
[The Britney Spears Problem](http://www.americanscientist.org/issues/pub/the-britney-spears-problem)
and Wikipedia's article on [Streaming algorithm](http://en.wikipedia.org/wiki/Streaming_algorithm).

The currently implemented algorithms include:

* HyperLogLog
* Count-Min sketch

## Download

The source is available for download from
[GitHub](http://github.com/jhurliman/node-streamcount).
Alternatively, you can install using Node Package Manager (npm):

    npm install streamcount

## Quick Example

```js
var streamcount = require('streamcount');

// Create a stream counter to track unique visitors with a 1% margin of error.
var uniques = streamcount.createUniquesCounter(0.01);

// Add some observations
uniques.add('user1');
uniques.add('user2');
uniques.add('user3');
uniques.add('user2');

// Prints 3.000274691735112
console.log(uniques.count());


// Create a stream counter to track the top 3 pages viewed on our site.
var pageCounts = streamcount.createViewsCounter(3);

// Add some observations
pageCounts.increment('/');
pageCounts.increment('/');
pageCounts.increment('/product1');
pageCounts.increment('/contact');
pageCounts.increment('/product3');
pageCounts.increment('/');
pageCounts.increment('/about');
pageCounts.increment('/about');
pageCounts.increment('/product2');
pageCounts.increment('/product1');
pageCounts.increment('/');
pageCounts.increment('/product1');

// Prints [ [ 4, '/' ], [ 3, '/product1' ], [ 2, '/about' ] ]
console.dir(pageCounts.getTopK());
```

## streamcount Documentation

<a name="createUniquesCounter" />
### createUniquesCounter

Creates an object for tracking the approximate total number of unique IDs
observed. A common example is estimating the number of unique visitors to
a website. Returns a [HyperLogLog](#HyperLogLog) object.

__Arguments__

* stdError - (Optional) A value from (0-1) indicating the acceptable error
  rate. This controls the accuracy / memory usage tradeoff. 0.01 is the
  default.

<a name="createViewsCounter" />
### createViewsCounter

Creates an object for tracking estimated top view counts for many unique
IDs. A common example is tracking the most viewed products on a website.
Returns a [CountMinSketch](#CountMinSketch) object.

__Arguments__

* topEntryCount - Maximum number of top entries to return view counts for. This
  is the maximum size of the array returned by getTopK().
* errFactor - (Optional) The estimated view counts returned by getTopK() can be
  off by up to this percentage (0-1). This, combined with failRate, controls
  the accuracy / memory usage tradeoff. 0.002 is the default.
* failRate - (Optional) The probability of getting the answer for a query
  completely wrong. From (0-1). This, combined with errFactor, controls the
  accuracy / memory usage tradeoff. 0.0001 is the default.

<a name="getUniquesObjSize" />
### getUniquesObjSize

Returns the serialized size of a uniques counter (HyperLogLog) object in
bytes given a stdError. __NOTE:__ The memory usage will be higher than this
number since we serialize 32-bit integers but JavaScript uses 64-bit numbers.

__Arguments__

* stdError - Parameter to createUniquesCounter() to estimate storage
  requirements for.

<a name="getViewsObjSize" />
### getViewsObjSize

Returns the serialized size of a views counter (CountMinSketch) object in
bytes given an errFactor and failRate. __NOTE:__ This does not include the size
of the serialized MinHeap which includes the size of each unique ID (up to a
max of topEntryCount) plus 5 bytes overhead per entry. __NOTE2:__ The memory
usage will be higher than this number since we serialize 32-bit integers but
JavaScript uses 64-bit numbers.

__Arguments__

* errFactor - Parameter to createViewsCounter() to estimate storage
  requirements for.
* failRate - Parameter to createViewsCounter() to estimate storage requirements
  for.

## HyperLogLog Documentation

<a name="HyperLogLog" />
### HyperLogLog

Initializes a HyperLogLog object. Takes the same parameters as
[createUniquesCounter](#createUniquesCounter).

__Example__

```js
var HyperLogLog = require('streamcount').HyperLogLog;
var uniques = new HyperLogLog();
```

### add

Add a member to the set.

__Arguments__

* key - String identifier to add to the set.

### count

Count the number of unique members in the set. Returns the estimated
cardinality of the set.

### serialize

Serializes this data structure to a binary buffer. Returns a binary Buffer
holding the serialized form of this structure.

### HyperLogLog.deserialize

Static method to deserialize a binary buffer into a reconstituted HyperLogLog
structure.

__Arguments__

* buffer - Binary buffer holding the serialized structure.
* start - Starting offset of the structure in the buffer.
* length - Length of the serialized structure in the buffer.

__Example__

```js
var uniques = HyperLogLog.deserialize(bufferData);
```

### merge

Merge another HyperLogLog structure of the same size into this one. This makes
it possible to keep a local HyperLogLog object in memory on each webserver, and
periodically serialize->send->deserialize->merge the results into a single
count.

__Arguments__

* hyperLogLog - The other HyperLogLog object to merge in.

## CountMinSketch Documentation

<a name="CountMinSketch" />
### CountMinSketch

Initializes a CountMinSketch object. Takes the same parameters as
[createViewsCounter](#createViewsCounter).

__Example__

```js
var CountMinSketch = require('streamcount').CountMinSketch;
var topten = new CountMinSketch(10);
```

### increment

Record an observation of the given key.

__Arguments__

* key - String identifier to increment the observation count for.

### getTopK

Returns a sorted list of tuples containing the estimated frequency count
and key for the maxEntries top observed members. Returns an array of length
topEntryCount, containing arrays of length 2 where the first value is the
estimated frequency count and the second value is the given key.

### serialize

Serializes this data structure to a binary buffer. Returns a binary Buffer
holding the serialized form of this structure.

### CountMinSketch.deserialize

Static method to deserialize a binary buffer into a reconstituted
CountMinSketch structure.

__Arguments__

* buffer - Binary buffer holding the serialized structure.
* start - Starting offset of the structure in the buffer.
* length - Length of the serialized structure in the buffer.

__Example__

```js
var pageCounts = CountMinSketch.deserialize(bufferData);
```
