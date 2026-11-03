import test from 'node:test';
import assert from 'node:assert/strict';
import {toPlace,searchCenters,findPlaces} from '../search-client.js';
test('real result validates destination and keeps prices unknown',()=>{
 const item={id:'id',name:'가게',lat:37.5,lng:127,category:'음식점>한식',address:'주소',detailUrl:'https://map.naver.com/p/search/test',price:100};
 assert.equal(toPlace(item).category,'한식');assert.equal(toPlace(item).price,null);
 assert.equal(toPlace({...item,detailUrl:'javascript:alert(1)'}),null);
 assert.equal(toPlace({...item,detailUrl:'https://map.naver.com.evil.test/'}),null);
});
test('all selected areas supply search centers',()=>{
 assert.deepEqual(searchCenters({areas:[],center:{lat:1,lng:2}}),[{lat:1,lng:2}]);
 assert.deepEqual(searchCenters({areas:[{points:[{lat:1,lng:1},{lat:2,lng:2},{lat:3,lng:3}]}]}),[{lat:2,lng:2}]);
});
test('queries deduplicate regions, merge places, surface partial failures',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;if(calls===2)return Response.json({error:'failed'},{status:502});return Response.json({places:[{id:'id',name:'식당',lat:37,lng:127,category:'한식',detailUrl:'https://map.naver.com/p/search/test'}]});};
 try{const result=await findPlaces(['서울','서울'],{query:'',category:'전체'},new AbortController().signal);assert.equal(calls,6);assert.equal(result.places.length,1);assert.equal(result.partial,true);}finally{globalThis.fetch=original;}
});
