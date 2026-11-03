import test from 'node:test';
import assert from 'node:assert/strict';
import {COOKIE_NAME, readPreferences, writePreferences, sanitizePreferences} from '../preferences.js';
test('cookie roundtrip retains Unicode filters and rectangle, excludes unrelated state',()=>{
  let raw='';const doc={get cookie(){return raw.split(';')[0]},set cookie(v){raw=v}};
  const state={radius:780,category:'한식',query:'김치 & 밥',maxPrice:10000,sort:'price',center:{lat:37.5,lng:127},bounds:{south:37.4,north:37.6,west:126.9,east:127.1},view:'saved',secret:'excluded'};
  assert.equal(writePreferences(state,doc,new URL('https://mrsohnbit.github.io/team-lunch/?v=1')),true);
  const {view,secret,...expected}=state;assert.deepEqual(readPreferences(doc),expected);
  assert.match(raw,/Path=\/team-lunch\/; Max-Age=2592000; SameSite=Lax; Secure$/);
});
test('invalid or inaccessible cookies cannot break browsing',()=>{
  for(const cookie of ['',`${COOKIE_NAME}=%xx`,`${COOKIE_NAME}=null`,`${COOKIE_NAME}=${encodeURIComponent('{"version":2}')}`])assert.deepEqual(readPreferences({cookie}),{});
  const blocked={get cookie(){throw Error('blocked')},set cookie(v){throw Error('blocked')}};
  assert.deepEqual(readPreferences(blocked),{});assert.equal(writePreferences({},blocked,new URL('https://example.com/')),false);
  assert.equal(writePreferences({},{get cookie(){return ''},set cookie(v){}},new URL('https://example.com/')),false);
});
test('tampered values are bounded and invalid geography ignored',()=>{
  assert.deepEqual(sanitizePreferences({version:1,radius:-1,category:'<x>',maxPrice:'10000',sort:'bad',center:{lat:999,lng:0},bounds:{south:2,north:1,west:0,east:1}}),{});
  assert.equal(Array.from(sanitizePreferences({version:1,query:'🍚'.repeat(500)}).query).length,100);
});

test('multiple areas survive cookies within size limit and invalid areas are dropped',()=>{
  let raw='';const doc={get cookie(){return raw.split(';')[0]},set cookie(v){raw=v}};
  const b={south:37.123456789,north:37.124567891,west:126.123456789,east:126.124567891};
  const state={center:{lat:37.5,lng:127},radius:2000,category:'샐러드',maxPrice:20000,sort:'distance',query:'🍚'.repeat(100),areas:Array.from({length:6},()=>({...b})),demo:true};
  assert.equal(writePreferences(state,doc,new URL('https://mrsohnbit.github.io/team-lunch/')),true);
  assert.equal(readPreferences(doc).areas.length,5);
  assert.equal(readPreferences(doc).areas[0].south,37.123457);
  assert.ok(raw.length<4096);
  assert.deepEqual(sanitizePreferences({version:1,center:state.center,areas:[null,{...b,south:99}]}).areas,[]);
});

test('five 32-vertex freehand areas and longest query fit cookie and restore',()=>{
  let raw='';const doc={get cookie(){return raw.split(';')[0]},set cookie(v){raw=v}};
  const points=Array.from({length:32},(_,i)=>({lat:37.5+.01*Math.sin(i*Math.PI/16),lng:127+.01*Math.cos(i*Math.PI/16)}));
  const state={center:{lat:37.5,lng:127},radius:2000,category:'샐러드',maxPrice:20000,sort:'distance',query:'🍚'.repeat(100),demo:true,areas:Array.from({length:5},()=>({points}))};
  assert.ok(writePreferences(state,doc,new URL('https://mrsohnbit.github.io/team-lunch/')));
  assert.ok(raw.length<4096,`cookie: ${raw.length}`);
  assert.deepEqual(readPreferences(doc).areas,sanitizePreferences({...state,version:1}).areas);
});
