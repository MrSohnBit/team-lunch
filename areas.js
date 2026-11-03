// Keep map objects separate from serializable search preferences.
export function createAreaController(map, n, onChange) {
  const items=[];
  let active=-1;
  function sync(item){
    if(item.dragStart)return;
    const b=item.bounds,nw=new n.LatLng(b.north,b.west),se=new n.LatLng(b.south,b.east);
    const projection=map.getProjection(),a=projection.fromCoordToOffset(nw),z=projection.fromCoordToOffset(se);
    item.rectangle.setBounds(new n.LatLngBounds(new n.LatLng(b.south,b.west),new n.LatLng(b.north,b.east)));
    item.handles[0].setPosition(new n.LatLng(b.south,b.west));
    item.handles[1].setPosition(new n.LatLng(b.north,b.east));
    item.mover.setPosition(nw);
    const width=Math.max(1,Math.abs(z.x-a.x)),height=Math.max(1,Math.abs(z.y-a.y));
    const number=items.indexOf(item)+1;
    item.mover.setIcon({content:`<div class="area-move-surface" data-area-number="${number}" style="width:${width}px;height:${height}px"><span class="area-number">${number}</span></div>`,anchor:new n.Point(0,0)});
    item.mover.setTitle(`영역 ${number} 이동`);
  }
  function paint(){
    items.forEach((item,i)=>{
      const selected=i===active;
      item.rectangle.setOptions({strokeColor:selected?'#315940':'#7b8c78',strokeWeight:selected?3:1,fillOpacity:selected?.18:.10});
      item.mover.setZIndex(selected?1100:1000+i);
      item.handles.forEach(h=>{h.setMap(selected?map:null);h.setZIndex(1101);});
    });
  }
  function emit(){onChange(items.map(item=>({...item.bounds})),active);}
  function select(index){if(!items[index])return;active=index;paint();emit();}
  function finish(item){
    if(item.mapDraggable!==undefined)map.setOptions('draggable',item.mapDraggable);
    item.mapDraggable=undefined;item.dragStart=null;sync(item);emit();
  }
  function move(item){
    if(!item.dragStart)return;
    const p=item.mover.getPosition(),b=item.dragStart;
    item.bounds={north:p.lat(),west:p.lng(),south:p.lat()-(b.north-b.south),east:p.lng()+(b.east-b.west)};
    const r=item.bounds;
    item.rectangle.setBounds(new n.LatLngBounds(new n.LatLng(r.south,r.west),new n.LatLng(r.north,r.east)));
    item.handles[0].setPosition(new n.LatLng(r.south,r.west));
    item.handles[1].setPosition(new n.LatLng(r.north,r.east));
  }
  function add(bounds){
    if(items.length>=5)return false;
    const c=map.getCenter(),lat=c.lat(),lng=c.lng();
    // Slight offset keeps a newly added area visible at the same map center.
    const offset=bounds?0:items.length*.0006;
    const b=bounds??{south:lat-.0015+offset,north:lat+.0015+offset,west:lng-.002+offset,east:lng+.002+offset};
    const item={bounds:{...b},dragStart:null};
    item.rectangle=new n.Rectangle({map,bounds:new n.LatLngBounds(new n.LatLng(b.south,b.west),new n.LatLng(b.north,b.east)),fillColor:'#9cbb71'});
    item.mover=new n.Marker({map,position:c,draggable:true,cursor:'move'});
    item.handles=[new n.LatLng(b.south,b.west),new n.LatLng(b.north,b.east)].map((position,index)=>{
      const handle=new n.Marker({map,position,draggable:true,zIndex:1101,title:index?'북동쪽 꼭짓점':'남서쪽 꼭짓점',icon:{content:'<span class="area-handle"></span>',anchor:new n.Point(12,12)}});
      n.Event.addListener(handle,'dragend',()=>{
        const a=item.handles[0].getPosition(),z=item.handles[1].getPosition();
        item.bounds={south:Math.min(a.lat(),z.lat()),north:Math.max(a.lat(),z.lat()),west:Math.min(a.lng(),z.lng()),east:Math.max(a.lng(),z.lng())};
        sync(item);emit();
      });
      return handle;
    });
    items.push(item);active=items.length-1;
    n.Event.addListener(item.mover,'click',()=>select(items.indexOf(item)));
    n.Event.addListener(item.mover,'dragstart',()=>{
      select(items.indexOf(item));item.dragStart={...item.bounds};item.mapDraggable=map.getOptions('draggable');map.setOptions('draggable',false);
    });
    n.Event.addListener(item.mover,'drag',()=>move(item));
    n.Event.addListener(item.mover,'dragend',()=>{move(item);finish(item);});
    sync(item);paint();emit();return true;
  }
  function dispose(item){
    if(item.mapDraggable!==undefined)map.setOptions('draggable',item.mapDraggable);
    for(const overlay of [item.rectangle,item.mover,...item.handles]){n.Event.clearInstanceListeners(overlay);overlay.setMap(null);}
  }
  function remove(){
    if(active<0)return;
    dispose(items.splice(active,1)[0]);active=Math.min(active,items.length-1);
    items.forEach(sync);paint();emit();
  }
  function clear(){items.forEach(dispose);items.length=0;active=-1;emit();}
  n.Event.addListener(map,'zoom_changed',()=>items.forEach(sync));
  return {add,select,remove,clear};
}
