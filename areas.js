// A screen-space SVG preserves freehand hit-testing, including concave outlines.
export function createAreaController(map, n, onChange) {
  const items=[];
  let active=-1,drawing=false,gesture=null;
  const host=document.getElementById('map');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('freehand-layer');host.append(svg);
  const hint=document.createElement('button');hint.className='freehand-cancel';hint.textContent='그리기 취소';hint.hidden=true;host.append(hint);
  const emit=()=>onChange(items.map(points=>({points:points.map(p=>({...p}))})),active,drawing);
  const offset=p=>map.getProjection().fromCoordToOffset(new n.LatLng(p.lat,p.lng));
  const coord=p=>{const c=map.getProjection().fromOffsetToCoord(new n.Point(p.x,p.y));return {lat:c.lat(),lng:c.lng()};};
  function point(event){const r=svg.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
  function path(points){return points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')+' Z';}
  function draw(){
    svg.replaceChildren();
    const order=items.map((_,i)=>i).filter(i=>i!==active);if(active>=0)order.push(active);
    for(const i of order){
      const pixels=items[i].map(offset),shape=document.createElementNS(svg.namespaceURI,'path');
      shape.setAttribute('d',path(pixels));shape.setAttribute('fill-rule','evenodd');shape.dataset.area=String(i);
      shape.setAttribute('class',i===active?'selected':'');svg.append(shape);
      const label=document.createElementNS(svg.namespaceURI,'text');
      label.setAttribute('x',pixels[0].x);label.setAttribute('y',pixels[0].y-7);label.textContent=String(i+1);svg.append(label);
    }
    if(gesture?.type==='draw'){
      const preview=document.createElementNS(svg.namespaceURI,'path');preview.setAttribute('d',path(gesture.pixels));preview.classList.add('draft');svg.append(preview);
    }
    svg.classList.toggle('drawing',drawing);hint.hidden=!drawing;
  }
  function cancel(){
    if(gesture?.type==='move')items[gesture.index]=gesture.original;
    if(gesture){map.setOptions('draggable',gesture.draggable);if(svg.hasPointerCapture(gesture.id))svg.releasePointerCapture(gesture.id);}
    gesture=null;drawing=false;draw();emit();
  }
  hint.onclick=cancel;
  svg.addEventListener('pointerdown',event=>{
    if(gesture||event.button!==0)return;
    const index=Number(event.target.dataset.area);
    if(!drawing&&!Number.isInteger(index))return;
    event.preventDefault();event.stopPropagation();
    const start=point(event),draggable=map.getOptions('draggable');map.setOptions('draggable',false);
    gesture=drawing?{type:'draw',pixels:[start],id:event.pointerId,draggable}:{type:'move',index,start,original:items[index].map(p=>({...p})),pixels:items[index].map(offset),id:event.pointerId,draggable};
    if(!drawing)active=index;
    svg.setPointerCapture(event.pointerId);draw();
  });
  svg.addEventListener('pointermove',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();const p=point(event);
    if(gesture.type==='draw'){
      const last=gesture.pixels.at(-1);if(Math.hypot(last.x-p.x,last.y-p.y)>=4)gesture.pixels.push(p);
      // Keep the input buffer bounded during a long drawing gesture.
      if(gesture.pixels.length>1024)gesture.pixels=gesture.pixels.filter((_,i)=>i%2===0);
    }else items[gesture.index]=gesture.pixels.map(a=>coord({x:a.x+p.x-gesture.start.x,y:a.y+p.y-gesture.start.y}));
    draw();
  });
  svg.addEventListener('pointerup',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    const g=gesture;map.setOptions('draggable',g.draggable);gesture=null;
    if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
    if(g.type==='draw'){
      const xs=g.pixels.map(p=>p.x),ys=g.pixels.map(p=>p.y);
      const twiceArea=Math.abs(g.pixels.reduce((sum,p,i)=>{const q=g.pixels[(i+1)%g.pixels.length];return sum+p.x*q.y-q.x*p.y;},0));
      if(twiceArea>=120&&g.pixels.length>=3&&Math.max(...xs)-Math.min(...xs)>=15&&Math.max(...ys)-Math.min(...ys)>=15){
        // At most 32 vertices per area keeps five areas within the cookie budget.
        const count=Math.min(32,g.pixels.length);
        items.push(Array.from({length:count},(_,i)=>coord(g.pixels[Math.floor(i*g.pixels.length/count)])));active=items.length-1;drawing=false;
      }
    }
    draw();emit();
  });
  svg.addEventListener('pointercancel',cancel);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(drawing||gesture))cancel();});
  for(const event of ['bounds_changed','idle','zoom_changed'])n.Event.addListener(map,event,draw);
  new ResizeObserver(draw).observe(host);
  function add(area){
    if(items.length>=5)return false;
    if(area){
      const points=area.points??[{lat:area.south,lng:area.west},{lat:area.north,lng:area.west},{lat:area.north,lng:area.east},{lat:area.south,lng:area.east}];
      items.push(points.map(p=>({...p})));active=items.length-1;
    }else drawing=true;
    draw();emit();return true;
  }
  function select(index){if(!items[index])return;cancel();active=index;draw();emit();}
  function remove(){cancel();if(active<0)return;items.splice(active,1);active=Math.min(active,items.length-1);draw();emit();}
  function clear(){cancel();items.length=0;active=-1;draw();emit();}
  return {add,select,remove,clear,cancel};
}
