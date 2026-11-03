import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, normalizedBounds, insideBounds, filterPlaces, pickPlaces } from '../domain.js';
const base={center:{lat:0,lng:0},radius:1000,category:'전체',maxPrice:null,query:'',sort:'distance',bounds:null};
const places=[{id:'a',name:'한식당',menu:'비빔밥',category:'한식',price:9000,lat:0,lng:.001},{id:'b',name:'다른집',menu:'우동',category:'일식',price:11000,lat:0,lng:.004},{id:'c',name:'먼집',menu:'비빔밥',category:'한식',price:8000,lat:0,lng:.02},{id:'d',name:'미등록',menu:'정식',category:'한식',price:null,lat:0,lng:.002}];
test('geodesic distance uses meters, includes zero and is symmetric',()=>{assert.equal(distanceMeters(base.center,base.center),0);const p={lat:0,lng:1};assert.ok(Math.abs(distanceMeters(base.center,p)-111195)<1);assert.equal(distanceMeters(base.center,p),distanceMeters(p,base.center));});
test('radius, category, menu search and inclusive budget intersect',()=>{assert.deepEqual(filterPlaces(places,{...base,category:'한식',query:'비빔',maxPrice:9000}).map(p=>p.id),['a']);assert.equal(filterPlaces(places,{...base,radius:100}).length,0);assert.deepEqual(filterPlaces(places,{...base,maxPrice:10000}).map(p=>p.id),['a']);});
test('dragging either corner across the other preserves inclusive boundaries',()=>{const b=normalizedBounds({lat:1,lng:2},{lat:-1,lng:-2});assert.equal(insideBounds({lat:-1,lng:2},b),true);assert.equal(insideBounds({lat:1.01,lng:0},b),false);assert.deepEqual(filterPlaces(places,{...base,radius:1,bounds:normalizedBounds({lat:-.01,lng:.001},{lat:.01,lng:.004})}).map(p=>p.id),['a','d','b']);});
test('price sort leaves unknown prices at the end',()=>assert.deepEqual(filterPlaces(places,{...base,sort:'price'}).map(p=>p.id),['a','b','d']));
test('recommendations are unique, bounded by available candidates and do not mutate input',()=>{const original=structuredClone(places);assert.equal(new Set(pickPlaces(places,3,()=>.5).map(p=>p.id)).size,3);assert.equal(pickPlaces(places.slice(0,1)).length,1);assert.deepEqual(pickPlaces([]),[]);assert.deepEqual(places,original);});

test('multiple areas use union without duplicating overlapping restaurants',()=>{
  const places=[{id:'a',name:'A',menu:'밥',category:'한식',price:9000,lat:37.5,lng:127},{id:'b',name:'B',menu:'밥',category:'한식',price:11000,lat:37.6,lng:127},{id:'c',name:'C',menu:'밥',category:'한식',price:9000,lat:37.8,lng:127}];
  const state={center:{lat:37.5,lng:127},radius:10,query:'',category:'전체',maxPrice:null,sort:'distance',areas:[{south:37.49,north:37.51,west:126.9,east:127.1},{south:37.5,north:37.61,west:126.9,east:127.1}]};
  assert.deepEqual(filterPlaces(places,state).map(p=>p.id),['a','b']);
  assert.deepEqual(filterPlaces(places,{...state,maxPrice:10000}).map(p=>p.id),['a']);
  assert.deepEqual(filterPlaces(places,{...state,areas:[state.areas[0]]}).map(p=>p.id),['a']);
});

test('freehand concave polygon excludes its cutout and includes boundary',()=>{
  const area={points:[{lat:0,lng:0},{lat:0,lng:3},{lat:1,lng:3},{lat:1,lng:1},{lat:3,lng:1},{lat:3,lng:0}]};
  const state={center:{lat:0,lng:0},radius:1,areas:[area],category:'전체',maxPrice:null,query:'',sort:'distance'};
  const points=[{id:'inside',lat:.5,lng:2},{id:'cutout',lat:2,lng:2},{id:'edge',lat:1,lng:2}];
  assert.deepEqual(new Set(filterPlaces(points,state).map(p=>p.id)),new Set(['inside','edge']));
});
