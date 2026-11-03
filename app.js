import { readPreferences, writePreferences } from './preferences.js?v=20261103-cookie1';
import { config } from './config.js?v=20261103-map1';
import { demoPlaces, filterPlaces, pickPlaces, normalizedBounds } from './domain.js';
const $ = id => document.getElementById(id);
const paths = {
  user:'M20 21v-2a7 7 0 0 0-14 0v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  chevron:'m9 5 7 7-7 7',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  sliders:'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6',
  locate:'M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  shuffle:'m16 3 4 4-4 4M4 17l4-1 8-8 4-1M4 7l4 1 3 3m3 3 2 2 4 1m-4-4 4 4-4 4',
  users:'M16 21v-2a6 6 0 0 0-12 0v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9 1a5 5 0 0 1 3 5v3M18 3a4 4 0 0 1 0 8',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  compass:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0m-6-4-3 5-5 3 3-5 5-3Z',
  close:'m6 6 12 12M6 18 18 6',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z',
  lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10m7 4v3',bowl:'M3 10h18a9 9 0 0 1-18 0Zm5 10h8M9 2v4m6-4v4',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.bowl}"/></svg>`;
function icons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
icons();
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => `${n.toLocaleString('ko-KR')}원`;
const distance = n => n < 1000 ? `${Math.round(n)}m` : `${(n/1000).toFixed(1)}km`;
let saved = [];
try { const data = JSON.parse(localStorage.getItem('team-lunch.saved.v1') || '[]'); if (Array.isArray(data)) saved = data.filter(id => demoPlaces.some(p => p.id === id)); } catch { /* Storage may be disabled. */ }
const restoredPreferences = readPreferences(document);
const state = { center: {...config.initialCenter},radius:500,category:'전체',maxPrice:null,query:'',sort:'distance',bounds:null,demo:true,view:'explore', ...restoredPreferences };
let lastPreferences = '';
function persistPreferences(){
  const value=JSON.stringify(state);
  if(value===lastPreferences)return;
  lastPreferences=value;
  const ok=writePreferences(state,document,window.location);
  $('guest-storage-status').textContent=ok?'게스트 설정은 이 브라우저의 쿠키에 30일간 저장돼요. 선택 지역도 함께 기억해요.':'쿠키 저장이 제한되어 설정을 이번 방문에만 기억해요.';
}
$('query').value=state.query;
$('sort').value=state.sort;
$('demo-toggle').checked=state.demo;
let map, circle, centerMarker, rectangle, handles = [], markers = [], mapFailed = false, mapTimer, toastTimer;
let areaMode = false;
let locationGeneration = 0;
$('location-label').textContent = restoredPreferences.center ? '지난번 선택한 위치' : config.initialLocationLabel;
const categories = [['전체','✦'],['한식','🍚'],['일식','🍜'],['중식','🥟'],['양식','🍝'],['샐러드','🥗'],['분식','🍙']];
$('categories').innerHTML = categories.map(([name,emoji]) => `<button type="button" data-category="${name}" class="${name === '전체' ? 'active' : ''}" aria-pressed="${name === '전체'}"><span class="food" aria-hidden="true">${emoji}</span>${name}</button>`).join('');
function toast(message) { clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false; toastTimer=setTimeout(() => $('toast').hidden=true,4500); }
function currentPlaces() { return filterPlaces(state.demo ? demoPlaces : [], state).filter(p => state.view !== 'saved' || saved.includes(p.id)); }
function renderCards(places) {
  $('cards').innerHTML = places.map(p => `<article class="food-card"><button class="card-main" data-detail="${p.id}" aria-label="${escape(p.name)} ${escape(p.menu)} ${money(p.price)} 상세"><span class="food-art ${p.tone}" aria-hidden="true">${p.emoji}</span><span class="card-copy"><span class="card-meta">${p.category}<span class="demo-badge">예시</span></span><h3>${escape(p.name)}</h3><p class="menu-name">${escape(p.menu)}</p><span class="price">${money(p.price)}</span><span class="distance">직선 ${distance(p.distance)}</span></span></button><button class="save-button ${saved.includes(p.id) ? 'saved' : ''}" data-save="${p.id}" aria-label="${escape(p.name)} 저장" aria-pressed="${saved.includes(p.id)}">${icon('heart')}</button></article>`).join('');
  $('result-count').textContent = places.length;
  $('empty-state').hidden = places.length !== 0;
  $('recommend').disabled = places.length === 0;
}
function render() {
  persistPreferences();
  const places = currentPlaces();
  $('list-title').innerHTML = `${state.view === 'saved' ? '저장한 메뉴' : '이 근처 점심'} <span id="result-count">${places.length}</span>`;
  $('list-eyebrow').textContent=state.view==='saved'?'SAVED ON THIS DEVICE':'LUNCH PICKS';
  $('active-filters').textContent = `${state.bounds ? '선택 영역' : '반경 '+distance(state.radius)} · ${state.category} · ${state.maxPrice === null ? '예산 전체' : money(state.maxPrice)+' 이하'}${state.view === 'saved' ? ' · 이 기기에만 저장' : ''}`;
  $('scope-label').textContent = state.bounds ? '선택한 영역' : `반경 ${distance(state.radius)}`;
  $('filter-dot').hidden = state.maxPrice === null && state.radius === 500;
  document.querySelectorAll('[data-category]').forEach(el => {const active=el.dataset.category===state.category;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  document.querySelectorAll('[data-radius]').forEach(el => {const active=Number(el.dataset.radius)===state.radius;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  $('empty-title').textContent = !state.demo ? '아직 등록된 식당이 없어요' : state.view === 'saved' ? '이 조건에 저장한 메뉴가 없어요' : '조건에 맞는 메뉴가 없어요';
  $('empty-copy').textContent = !state.demo ? '실제 식당 데이터는 준비 중이에요. 예시 메뉴를 켜서 먼저 둘러보세요.' : state.view === 'saved' ? '하트를 눌러 메뉴를 저장하거나 검색 조건을 바꿔보세요.' : '반경·예산·음식 종류를 바꿔보세요. 예시 메뉴는 서울시청 주변에만 있어요.';
  renderCards(places); renderMap(places);
}
function renderMap(places) {
  if (!map || mapFailed) return;
  markers.forEach(m => {naver.maps.Event.clearInstanceListeners(m);m.setMap(null);}); markers=[];
  for (const place of places) {
    const marker=new naver.maps.Marker({map,position:new naver.maps.LatLng(place.lat,place.lng),title:`예시: ${place.name}`,icon:{content:`<span class="map-pin">${escape(place.menu)} · ${money(place.price)}</span>`,anchor:new naver.maps.Point(55,18)}});
    naver.maps.Event.addListener(marker,'click',() => openDetail(place.id)); markers.push(marker);
  }
  circle.setMap(state.bounds ? null : map); circle.setCenter(new naver.maps.LatLng(state.center.lat,state.center.lng)); circle.setRadius(state.radius);
  centerMarker.setPosition(new naver.maps.LatLng(state.center.lat,state.center.lng));centerMarker.setMap(state.bounds?null:map);
}
function openDetail(id) {
  const place = filterPlaces(demoPlaces,{...state,radius:Infinity,bounds:null,query:'',category:'전체',maxPrice:null}).find(p => p.id===id);
  if (!place) return;
  $('detail-content').innerHTML=`<div class="detail-art ${place.tone}" aria-hidden="true">${place.emoji}</div><p class="eyebrow">${place.category} · 가상 식당 예시</p><h2 id="detail-title">${escape(place.name)}</h2><p class="detail-note">${escape(place.note)}</p><div class="detail-meta"><span>${escape(place.menu)}</span><span class="detail-price">${money(place.price)}</span></div><p class="muted">검색 기준점에서 직선 ${distance(place.distance)}</p><p class="detail-caveat">화면을 체험하기 위한 가상 식당과 예시 가격입니다. 실제 방문 정보가 아니에요.</p><button class="primary-button full-width" id="detail-save">${saved.includes(id)?'저장 해제':'이 기기에 메뉴 저장'}</button><button class="secondary-button full-width" id="detail-review">부서 리뷰 · 준비 중</button>`;
  $('detail-save').onclick=() => { toggleSaved(id); $('detail-save').textContent=saved.includes(id)?'저장 해제':'이 기기에 메뉴 저장'; };
  $('detail-review').onclick=() => { $('detail-dialog').close(); $('info-dialog').showModal(); };
  $('detail-dialog').showModal();
}
function toggleSaved(id) {
  saved=saved.includes(id)?saved.filter(v=>v!==id):[...saved,id];
  try {localStorage.setItem('team-lunch.saved.v1',JSON.stringify(saved));toast(saved.includes(id)?'이 기기에 메뉴를 저장했어요.':'저장을 해제했어요.');} catch {toast('브라우저 저장이 제한되어 이번 방문에만 기억해요.');}
  render();
}
$('cards').onclick=event => { const detail=event.target.closest('[data-detail]'),save=event.target.closest('[data-save]'); if(detail)openDetail(detail.dataset.detail);if(save)toggleSaved(save.dataset.save); };
$('categories').onclick=event => {const btn=event.target.closest('[data-category]');if(btn){state.category=btn.dataset.category;render();}};
$('query').oninput=event => {state.query=event.target.value;render();};
$('sort').onchange=event => {state.sort=event.target.value;render();};
$('demo-toggle').onchange=event => {state.demo=event.target.checked;render();};
function openFilters(){document.querySelectorAll('[name=budget]').forEach(input=>input.checked=input.value===String(state.maxPrice??''));$('radius-slider').value=state.radius;$('radius-output').textContent=distance(state.radius);$('radius-field').hidden=!!state.bounds;$('filter-dialog').showModal();}
$('open-filters').onclick=openFilters;$('fine-radius').onclick=openFilters;
$('radius-slider').oninput=event=>$('radius-output').textContent=distance(Number(event.target.value));
$('clear-draft').onclick=()=>{document.querySelector('[name=budget][value=""]').checked=true;$('radius-slider').value=500;$('radius-output').textContent='500m';};
$('filter-form').onsubmit=()=>{const value=new FormData($('filter-form')).get('budget');state.maxPrice=value?Number(value):null;state.radius=Number($('radius-slider').value);render();};
$('radius-presets').onclick=event=>{const btn=event.target.closest('[data-radius]');if(btn){state.radius=Number(btn.dataset.radius);render();}};
function resetFilters(){state.radius=500;state.category='전체';state.maxPrice=null;state.query='';$('query').value='';clearArea();render();}
$('reset-filters').onclick=resetFilters;
$('reset-guest-settings').onclick=()=>{
  locationGeneration++;clearArea();
  Object.assign(state,{center:{...config.initialCenter},radius:500,category:'전체',maxPrice:null,query:'',sort:'distance',demo:true});
  $('query').value='';$('sort').value='distance';$('demo-toggle').checked=true;
  $('location-label').textContent=config.initialLocationLabel;
  if(map&&!mapFailed){map.setCenter(new naver.maps.LatLng(state.center.lat,state.center.lng));map.setZoom(15);}
  render();toast('저장된 게스트 설정을 기본값으로 초기화했어요.');
};
for(const id of ['login','review-info','nav-reviews'])$(id).onclick=()=>$('info-dialog').showModal();
for(const btn of document.querySelectorAll('[data-close]'))btn.onclick=()=>btn.closest('dialog').close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
function setView(view){state.view=view;for(const key of ['explore','saved']){const el=$('nav-'+key),active=view===key;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}render();if(view==='saved')$('results').scrollIntoView({behavior:'smooth',block:'start'});else window.scrollTo({top:0,behavior:'smooth'});}
$('nav-explore').onclick=()=>setView('explore');$('nav-saved').onclick=()=>setView('saved');
$('recommend').onclick=()=>{const chosen=pickPlaces(currentPlaces());if(!chosen.length)return;renderCards(chosen);$('list-title').innerHTML=`오늘의 추천 <span id="result-count">${chosen.length}</span>`;$('active-filters').textContent+=' · 조건 안에서 무작위 추천';renderMap(chosen);$('results').scrollIntoView({behavior:'smooth',block:'start'});toast(`${chosen.length}개의 예시 메뉴를 골랐어요. 필터를 바꾸면 전체 목록으로 돌아가요.`);};
function clearArea(){areaMode=false;state.bounds=null;if(rectangle){rectangle.setMap(null);rectangle=null;}handles.forEach(h=>{naver.maps.Event.clearInstanceListeners(h);h.setMap(null);});handles=[];$('radius-mode').classList.add('active');$('radius-mode').setAttribute('aria-pressed','true');$('area-mode').classList.remove('active');$('area-mode').setAttribute('aria-pressed','false');$('area-help').hidden=true;$('radius-presets').hidden=false;}
$('radius-mode').onclick=()=>{clearArea();render();};
$('area-mode').onclick=()=>selectArea();
function selectArea(restoredBounds=null){
  if(!map||mapFailed){toast('지도 연결 후 영역을 선택할 수 있어요.');return;}
  if(areaMode)return;
  clearArea();areaMode=true;
  const c=map.getCenter(),lat=c.lat(),lng=c.lng();state.center={lat,lng};locationGeneration++;$('location-label').textContent='지도에서 선택한 위치';
  const n=naver.maps;rectangle=new n.Rectangle({map,bounds:new n.LatLngBounds(new n.LatLng(restoredBounds?.south??lat-.0015,restoredBounds?.west??lng-.002),new n.LatLng(restoredBounds?.north??lat+.0015,restoredBounds?.east??lng+.002)),strokeColor:'#315940',strokeWeight:2,fillColor:'#9cbb71',fillOpacity:.18});
  const positions=[new n.LatLng(restoredBounds?.south??lat-.0015,restoredBounds?.west??lng-.002),new n.LatLng(restoredBounds?.north??lat+.0015,restoredBounds?.east??lng+.002)];
  handles=positions.map((position,index)=>{const handle=new n.Marker({map,position,draggable:true,title:index?'북동쪽 꼭짓점':'남서쪽 꼭짓점',icon:{content:'<span class="area-handle"></span>',anchor:new n.Point(12,12)}});n.Event.addListener(handle,'dragend',updateArea);return handle;});
  $('radius-mode').classList.remove('active');$('radius-mode').setAttribute('aria-pressed','false');$('area-mode').classList.add('active');$('area-mode').setAttribute('aria-pressed','true');$('area-help').hidden=false;$('radius-presets').hidden=true;updateArea();
};
function updateArea(){if(handles.length!==2)return;const [a,b]=handles.map(h=>({lat:h.getPosition().lat(),lng:h.getPosition().lng()}));state.bounds=normalizedBounds(a,b);const r=state.bounds;rectangle.setBounds(new naver.maps.LatLngBounds(new naver.maps.LatLng(r.south,r.west),new naver.maps.LatLng(r.north,r.east)));render();}
$('search-here').onclick=()=>{if(!map||mapFailed)return;locationGeneration++;clearArea();const c=map.getCenter();state.center={lat:c.lat(),lng:c.lng()};$('location-label').textContent='지도에서 선택한 위치';render();toast('이 위치를 기준으로 메뉴를 찾았어요.');};
$('location').onclick=()=>{locationGeneration++;clearArea();state.center={...config.initialCenter};$('location-label').textContent=config.initialLocationLabel;if(map&&!mapFailed){map.setCenter(new naver.maps.LatLng(state.center.lat,state.center.lng));map.setZoom(15);}render();toast('기본 위치인 서울시청으로 돌아왔어요.');};
$('my-location').onclick=()=>{
  if(!navigator.geolocation){toast('이 브라우저에서는 위치를 가져올 수 없어요.');return;}
  const generation=++locationGeneration;$('my-location').disabled=true;
  navigator.geolocation.getCurrentPosition(position=>{ $('my-location').disabled=false;if(generation!==locationGeneration)return;clearArea();state.center={lat:position.coords.latitude,lng:position.coords.longitude};$('location-label').textContent='내 현재 위치';if(map&&!mapFailed){map.setCenter(new naver.maps.LatLng(state.center.lat,state.center.lng));map.setZoom(15);}render();toast(`현재 위치로 이동했어요. 위치 정확도 약 ${Math.round(position.coords.accuracy)}m`);},error=>{$('my-location').disabled=false;if(generation!==locationGeneration)return;toast(error.code===1?'위치 권한이 꺼져 있어요. 지도에서 위치를 선택해 주세요.':'위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.');},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
};
function mapError(title,copy){clearTimeout(mapTimer);mapFailed=true;$('map-placeholder').hidden=false;$('map-status-title').textContent=title;$('map-status-copy').textContent=copy;$('map-controls').hidden=true;$('retry-map').hidden=!config.naverClientId;}
$('retry-map').onclick=()=>window.location.reload();
window.navermap_authFailure=()=>mapError('지도 연결을 확인하고 있어요','네이버 지도 인증 설정을 확인해야 해요. 메뉴 미리보기는 계속 이용할 수 있어요.');
// SDK 3.10.5 can invoke callback before window.naver is exported.
// Defer initialization until the current SDK script has completed.
window.initNaverMap=()=>queueMicrotask(initializeNaverMap);
function initializeNaverMap(){
  if(mapFailed || map)return;
  try{
    const n=window.naver.maps;
    map=new n.Map('map',{center:new n.LatLng(state.center.lat,state.center.lng),zoom:15,minZoom:7,maxZoom:20,zoomControl:true,zoomControlOptions:{position:n.Position.RIGHT_TOP},scaleControl:true,mapDataControl:true,logoControl:true});
    circle=new n.Circle({map,center:new n.LatLng(state.center.lat,state.center.lng),radius:state.radius,fillColor:'#9cbb71',fillOpacity:.12,strokeColor:'#7b9e58',strokeWeight:1,strokeOpacity:.6});
    centerMarker=new n.Marker({map,position:new n.LatLng(state.center.lat,state.center.lng),title:'검색 기준점',icon:{content:'<span class="center-pin"></span>',anchor:new n.Point(9,9)}});
    clearTimeout(mapTimer);$('map-placeholder').hidden=true;$('map-controls').hidden=false;
    new ResizeObserver(()=>{const el=$('map');map.setSize(new n.Size(el.clientWidth,el.clientHeight));}).observe($('map'));
    if(state.bounds)selectArea({...state.bounds});else render();
  }catch(error){console.error('Naver map initialization failed', error);mapError('지도를 불러오지 못했어요','잠시 후 다시 시도해 주세요. 메뉴 미리보기는 계속 이용할 수 있어요.');}
};
function loadMap(){
  if(!config.naverClientId){mapError('네이버 지도를 연결하고 있어요','지도 연결 전에도 아래 예시 메뉴와 필터를 먼저 둘러볼 수 있어요.');return;}
  const script=document.createElement('script');script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(config.naverClientId)}&callback=initNaverMap`;script.async=true;script.onerror=()=>mapError('지도를 불러오지 못했어요','네트워크 연결을 확인하고 다시 시도해 주세요.');mapTimer=setTimeout(()=>mapError('지도 연결이 지연되고 있어요','네트워크 연결을 확인한 뒤 다시 연결해 주세요.'),15000);document.head.append(script);
}
render();loadMap();
