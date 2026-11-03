import test from 'node:test';
import assert from 'node:assert/strict';
import {createAreaController} from '../areas.js';

test('freehand gestures create, move, cancel, restore and remove areas without moving map',()=>{
  class Element {
    children=[];listeners={};dataset={};classList={add(){},toggle(){}};
    append(child){this.children.push(child)} replaceChildren(){this.children=[]}
    setAttribute(){} addEventListener(name,fn){this.listeners[name]=fn}
    getBoundingClientRect(){return {left:0,top:0}}
    setPointerCapture(id){this.capture=id} hasPointerCapture(id){return this.capture===id} releasePointerCapture(){this.capture=null}
  }
  const originalDocument=globalThis.document, originalObserver=globalThis.ResizeObserver;
  const host=new Element();
  globalThis.document={getElementById:()=>host,createElementNS:()=>new Element(),createElement:()=>new Element(),addEventListener(){}};
  globalThis.ResizeObserver=class{observe(){}};
  try{
    let draggable=true,last;
    const map={getProjection:()=>({fromCoordToOffset:p=>({x:p.lng(),y:p.lat()}),fromOffsetToCoord:p=>({lat:()=>p.y,lng:()=>p.x})}),getOptions:()=>draggable,setOptions:(key,value)=>{draggable=value}};
    const n={LatLng:class{constructor(lat,lng){this.lat=()=>lat;this.lng=()=>lng}},Point:class{constructor(x,y){this.x=x;this.y=y}},Event:{addListener(){}}};
    const controller=createAreaController(map,n,(areas,active,drawing)=>last={areas,active,drawing});
    const svg=host.children[0];
    const event=(x,y,target={dataset:{}})=>({clientX:x,clientY:y,pointerId:1,button:0,target,preventDefault(){},stopPropagation(){}});
    controller.add();assert.equal(last.drawing,true);
    svg.listeners.pointerdown(event(20,20));assert.equal(draggable,false);
    for(const [x,y] of [[100,20],[100,100],[60,60],[20,100]])svg.listeners.pointermove(event(x,y));
    svg.listeners.pointerup(event(20,100));
    assert.equal(draggable,true);assert.equal(last.areas[0].points.length,5);assert.equal(last.drawing,false);
    const old=structuredClone(last.areas[0]);
    svg.listeners.pointerdown(event(30,30,{dataset:{area:'0'}}));
    svg.listeners.pointermove(event(40,35));svg.listeners.pointerup(event(40,35));
    assert.deepEqual(last.areas[0].points,old.points.map(p=>({lat:p.lat+5,lng:p.lng+10})));
    svg.listeners.pointerdown(event(40,35,{dataset:{area:'0'}}));svg.listeners.pointermove(event(90,90));svg.listeners.pointercancel();
    assert.equal(draggable,true);assert.deepEqual(last.areas[0].points,old.points.map(p=>({lat:p.lat+5,lng:p.lng+10})));
    controller.add();svg.listeners.pointerdown(event(0,0));svg.listeners.pointermove(event(50,50));svg.listeners.pointermove(event(100,100));svg.listeners.pointerup(event(100,100));
    assert.equal(last.areas.length,1);assert.equal(last.drawing,true);controller.cancel();
    controller.add({south:0,north:20,west:0,east:20});assert.equal(last.areas[1].points.length,4);
    controller.remove();assert.equal(last.areas.length,1);controller.clear();assert.equal(last.areas.length,0);
  }finally{globalThis.document=originalDocument;globalThis.ResizeObserver=originalObserver;}
});
