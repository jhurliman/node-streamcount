'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const CMS=require('../lib/countMinSketch');
function sketch(capacity=10){return new CMS(capacity,.5,.2);}
function counters(buffer){const depth=buffer.readUInt32LE(12),width=buffer.readUInt32LE(16);return buffer.subarray(20,20+depth*width*4);}
function seededRows(first,second){
  const bytes=sketch().serialize(),width=bytes.readUInt32LE(16);
  for(let row=0;row<2;row++)for(let col=0;col<width;col++)bytes.writeUInt32LE(row?second:first,20+(row*width+col)*4);
  return CMS.deserialize(bytes);
}
test('weighted updates default to one and zero leaves all state unchanged',()=>{
 const cms=sketch();const empty=cms.serialize();cms.increment('absent',0);assert.deepEqual(cms.serialize(),empty);
 cms.increment('a');cms.increment('a',undefined);cms.increment('a',5);
 assert.deepEqual(cms.getTopK(),[[7,'a']]);const before=cms.serialize();cms.increment('a',0);assert.deepEqual(cms.serialize(),before);
});
test('weights must be nonnegative uint32 integers and invalid updates are atomic',()=>{
 const cms=sketch();cms.increment('a',3);const before=cms.serialize();
 for(const weight of [-1,.5,NaN,Infinity,-Infinity,4294967296,Number.MAX_SAFE_INTEGER,null,'2',true,{},[]]){
  assert.throws(()=>cms.increment('a',weight),RangeError);assert.deepEqual(cms.serialize(),before);
 }
 assert.throws(()=>cms.increment(123,0),TypeError);
});
test('weighted conservative updates raise intermediate collision buckets',()=>{
 const cms=seededRows(5,7);cms.increment('a',10);
 assert.deepEqual(cms.getTopK(),[[15,'a']]);
 assert.deepEqual(CMS.deserialize(cms.serialize()).getTopK(),[[15,'a']]);
 const unit=seededRows(5,7);for(let i=0;i<10;i++)unit.increment('a');
 assert.deepEqual(cms.serialize(),unit.serialize());
});
test('weighted updates preserve collision counters above the target',()=>{
 const cms=seededRows(5,100);cms.increment('a',10);
 const width=cms.serialize().readUInt32LE(16),row=counters(cms.serialize()).subarray(width*4);
 for(let i=0;i<width;i++)assert.equal(row.readUInt32LE(i*4),100);
 assert.deepEqual(cms.getTopK(),[[15,'a']]);
});
test('uint32 limit and overflow reject without changing counters or top-k',()=>{
 const cms=sketch();cms.increment('max',4294967295);const before=cms.serialize();
 cms.increment('max',0);assert.deepEqual(cms.serialize(),before);
 assert.throws(()=>cms.increment('max'),RangeError);assert.deepEqual(cms.serialize(),before);
 const near=seededRows(4294967290,4294967292),snapshot=near.serialize();
 assert.throws(()=>near.increment('a',6),RangeError);assert.deepEqual(near.serialize(),snapshot);
 near.increment('a',5);assert.deepEqual(CMS.deserialize(near.serialize()).getTopK(),[[4294967295,'a']]);
});
test('collision-heavy weighted streams match repeated unit updates',()=>{
 const bulk=sketch(3),units=sketch(3);
 let seed=123;
 for(let i=0;i<400;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const key=['__proto__','constructor','λ','a','b','c','d'][seed%7],weight=(seed>>>8)%19;
  bulk.increment(key,weight);for(let j=0;j<weight;j++)units.increment(key);
  assert.deepEqual(counters(bulk.serialize()),counters(units.serialize()));
  const order=(a,b)=>a[1].localeCompare(b[1]);assert.deepEqual(bulk.getTopK().sort(order),units.getTopK().sort(order));
 }
});
test('weighted counts survive legacy and CMS2 serialization and further updates',()=>{
 const cms=sketch();cms.increment('weighted',20);
 for(const options of [{},{legacy:true}]){
  const restored=CMS.deserialize(cms.serialize(options),undefined,undefined,options.legacy?{maxEntries:10}:undefined);
  restored.increment('weighted',5);assert.deepEqual(restored.getTopK(),[[25,'weighted']]);
 }
});
