import test from 'node:test';
import assert from 'node:assert/strict';
import {readExcluded,writeExcluded,withoutExcluded} from '../exclusions.js';
test('exclusions persist minimal data and hide only matching branch IDs',()=>{
  let data;const storage={getItem:()=>data,setItem:(key,value)=>{data=value;}};
  const a={id:'branch-a',name:'식당',address:'서울 A',detailUrl:'https://example.com'};
  const b={id:'branch-b',name:'식당',address:'서울 B'};
  assert.equal(writeExcluded(storage,[a]),true);
  const restored=readExcluded(storage);
  assert.deepEqual(restored,[{id:a.id,name:a.name,address:a.address}]);
  assert.deepEqual(withoutExcluded([a,b],restored),[b]);
  assert.equal(writeExcluded(storage,[]),true);
  assert.deepEqual(withoutExcluded([a,b],readExcluded(storage)),[a,b]);
});
test('corrupt and inaccessible storage is handled without hiding arbitrary results',()=>{
  assert.deepEqual(readExcluded({getItem:()=>'{'}),[]);
  assert.deepEqual(readExcluded({getItem:()=>JSON.stringify([null,{}, {id:'x',name:'X',address:''},{id:'x',name:'X',address:''}])}),[{id:'x',name:'X',address:''}]);
  assert.deepEqual(readExcluded({getItem(){throw Error();}}),[]);
  assert.equal(writeExcluded({setItem(){throw Error();}},[]),false);
});
