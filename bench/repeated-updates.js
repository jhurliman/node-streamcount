const path = require('node:path');
const { performance } = require('node:perf_hooks');
const CountMinSketch = require(path.resolve(process.argv[2] || path.join(__dirname, '../lib/countMinSketch.js')));
const times = [];
for (let trial = 0; trial < 7; trial++) {
  const sketch = new CountMinSketch(1000, 0.0005, 0.0001);
  const keys = Array.from({length: 1000}, (_, i) => 'item-' + i);
  keys.forEach(key => sketch.increment(key));
  const start = performance.now();
  for (let i = 0; i < 100000; i++) sketch.increment(keys[(i * 337) % 1000]);
  times.push(performance.now() - start);
}
console.log(JSON.stringify({times, median: times.sort((a,b) => a-b)[3]}));
