const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('distributed package resolves CommonJS, ESM, public and deep-import types', () => {
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamcount-package-'));
  function run(command, args) { return execFileSync(command, args, {cwd: dir, encoding:'utf8', stdio:'pipe'}); }
  try {
    const pack = JSON.parse(execFileSync('npm', ['pack','--json','--pack-destination',dir],{cwd:root,encoding:'utf8'}))[0];
    assert.ok(pack.files.some(f => f.path === 'SERIALIZATION.md'));
    assert.ok(pack.files.every(f => !f.path.startsWith('test/') && !f.path.startsWith('node_modules/')));
    run('npm',['install','--ignore-scripts','--no-audit','--no-fund',path.join(dir,pack.filename)]);
    const smoke = "const c=api.createViewsCounter(3);c.increment('a');const d=api.CountMinSketch.deserialize(c.serialize());d.increment('b');if(d.getTopK().length!==2)throw Error('capacity');";
    run(process.execPath,['-e',"const api=require('streamcount');"+smoke]);
    run(process.execPath,['--input-type=module','-e',"import api from 'streamcount';"+smoke]);
    const types = `import * as api from 'streamcount';
import CMS = require('streamcount/lib/countMinSketch');
import HLL = require('streamcount/lib/hyperLogLog');
import Heap = require('streamcount/lib/minHeap');
import Random = require('streamcount/lib/prng');
const views: api.CountMinSketch = new CMS(10, .1, .1);
views.increment('key');
const rows: Array<[number,string]> = views.getTopK();
const restored = CMS.deserialize(views.serialize({legacy:true}), undefined, undefined, {maxEntries:10});
const uniques: api.HyperLogLog = new HLL(.1); uniques.merge(api.createUniquesCounter());
const count: number = uniques.count();
const heap = new Heap<string>([],(a,b)=>a.localeCompare(b)); heap.push('a');
const item: string | undefined = heap.pop();
const rng = new Random(42); const number: number = rng.random() + Random('seed')();
api.getViewsObjSize(); api.getUniquesObjSize(); api.createViewsCounter(5);
// @ts-expect-error keys must be strings
views.increment(123);
// @ts-expect-error heap types propagate
heap.push(42);
// @ts-expect-error serialization requires a Buffer
CMS.deserialize('bytes');
`;
    fs.writeFileSync(path.join(dir,'consumer.cts'),types);
    fs.writeFileSync(path.join(dir,'consumer.mts'),types);
    const tsc = path.join(root,'node_modules/typescript/bin/tsc');
    const common = [tsc,'--strict','--noEmit','--target','es2022','--typeRoots',path.join(root,'node_modules/@types'),'--types','node'];
    run(process.execPath,common.concat(['--module','nodenext','--moduleResolution','nodenext','consumer.cts','consumer.mts']));
    // Also exercise Node16 module resolution.
    fs.writeFileSync(path.join(dir,'consumer.ts'),types);
    run(process.execPath,common.concat(['--module','node16','--moduleResolution','node16','consumer.ts']));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
