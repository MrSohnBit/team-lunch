import {readExcluded,writeExcluded,withoutExcluded} from './exclusions.js?v=20261103-exclude1';
import {findPlaces,regionAt,searchCenters,toPlace} from './search-client.js?v=20261103-detail1';
import { createAreaController } from './areas.js?v=20261103-area-save1';
import { readPreferences, writePreferences } from './preferences.js?v=20261103-area-save1';
import { config } from './config.js?v=20261103-map1';
import { filterPlaces, pickPlaces } from './domain.js?v=20261103-random1';
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
const money = n => Number.isFinite(n)?`${n.toLocaleString('ko-KR')}원`:'가격 정보 없음';
const distance = n => n < 1000 ? `${Math.round(n)}m` : `${(n/1000).toFixed(1)}km`;
let excludedPlaces=[];
try{excludedPlaces=readExcluded(localStorage);}catch{}
let savedPlaces=[];
try{const data=JSON.parse(localStorage.getItem('team-lunch.saved.real.v1')||'[]');if(Array.isArray(data))savedPlaces=data.map(toPlace).filter(Boolean);}catch{}
savedPlaces=pickPlaces(savedPlaces,savedPlaces.length);
let saved=savedPlaces.map(p=>p.id),realPlaces=[],searchStatus='',searchError='',searchKey='',searchTimer,searchAbort,searchGeneration=0;
const restoredPreferences = readPreferences(document);
const state = { center: {...config.initialCenter},radius:500,category:'전체',maxPrice:null,query:'',sort:'distance',bounds:null,demo:true,view:'explore', ...restoredPreferences };
state.areas=restoredPreferences.areas??(restoredPreferences.bounds?[restoredPreferences.bounds]:[]);
state.bounds=null;state.demo=false;state.maxPrice=null;state.sort='random';
let savedAreas=structuredClone(state.areas);
let lastPreferences = '';
function persistPreferences(){
  const preferences={...state,areas:savedAreas};
  const value=JSON.stringify(preferences);
  if(value===lastPreferences)return true;
  lastPreferences=value;
  const ok=writePreferences(preferences,document,window.location);
  if(!ok)lastPreferences='';
  $('guest-storage-status').textContent=ok?'게스트 설정은 이 브라우저의 쿠키에 30일간 저장돼요. 선택 지역도 함께 기억해요.':'쿠키 저장이 제한되어 설정을 이번 방문에만 기억해요.';
  return ok;
}
$('query').value=state.query;


let map, circle, centerMarker, markers = [], mapFailed = false, mapTimer;
let areaController;
let locationGeneration = 0;
$('location-label').textContent = restoredPreferences.center ? '지난번 선택한 위치' : config.initialLocationLabel;
const categories = [['전체','✦'],['한식','🍚'],['일식','🍜'],['중식','🥟'],['양식','🍝'],['샐러드','🥗'],['분식','🍙']];
$('categories').innerHTML = categories.map(([name,emoji]) => `<button type="button" data-category="${name}" class="${name === '전체' ? 'active' : ''}" aria-pressed="${name === '전체'}"><span class="food" aria-hidden="true">${emoji}</span>${name}</button>`).join('');
function showStatus(message) { $('action-status').textContent=message; $('action-status').hidden=false; }
function currentPlaces(){return filterPlaces(withoutExcluded(state.view==='saved'?savedPlaces:realPlaces,excludedPlaces),{...state,query:'',maxPrice:null});}
function renderCards(places) {
  $('cards').innerHTML=places.map(p=>`<article class="food-card"><button class="card-main" data-detail="${escape(p.id)}" aria-label="${escape(p.name)} 상세 정보"><span class="food-art ${p.tone}" aria-hidden="true">${p.emoji}</span><span class="card-copy"><span class="card-meta">${escape(p.category)}<span class="demo-badge">네이버</span></span><h3>${escape(p.name)}</h3><p class="menu-name">${escape(p.address)}</p><span class="price">가게 정보 보기</span><span class="distance">직선 ${distance(p.distance)}</span></span></button><button class="save-button ${saved.includes(p.id)?'saved':''}" data-save="${escape(p.id)}" aria-label="${escape(p.name)} 저장" aria-pressed="${saved.includes(p.id)}">${icon('heart')}</button></article>`).join('');
  $('result-count').textContent=places.length;$('empty-state').hidden=places.length!==0;$('recommend').disabled=places.length===0;
}
function scheduleSearch(force=false){
  if(!map||mapFailed)return;
  const key=JSON.stringify([state.center,state.areas,state.category,state.query,$('search-region').value.trim()]);
  if(!force&&key===searchKey)return;
  searchKey=key;clearTimeout(searchTimer);searchAbort?.abort();const generation=++searchGeneration;
  realPlaces=[];searchError='';searchStatus='네이버에서 식당을 찾고 있어요…';
  searchTimer=setTimeout(async()=>{
    searchAbort=new AbortController();const signal=searchAbort.signal;
    try{
      const manual=$('search-region').value.trim();
      const regions=manual?[manual]:[...new Set(await Promise.all(searchCenters(state).map(c=>regionAt(naver.maps,c))))];
      if(generation!==searchGeneration)return;
      const result=await findPlaces(regions,state,signal);
      if(generation!==searchGeneration)return;
      realPlaces=pickPlaces(result.places,result.places.length);searchStatus=`${regions.join(' · ')} · 네이버 검색 결과 일부${result.partial?' (일부 검색 실패)':''}`;
    }catch(error){if(generation!==searchGeneration||error.name==='AbortError')return;searchError=error.message;searchStatus='검색을 완료하지 못했어요.';}
    render();
  },600);
}
function render() {
  scheduleSearch();
  $('open-excluded').textContent=`제외한 가게 ${excludedPlaces.length}`;
  persistPreferences();
  const places = currentPlaces();
  $('list-title').innerHTML = `${state.view === 'saved' ? '저장한 식당' : '이 근처 점심'} <span id="result-count">${places.length}</span>`;
  $('list-eyebrow').textContent=state.view==='saved'?'SAVED ON THIS DEVICE':'LUNCH PICKS';
  $('active-filters').textContent = `${state.areas.length ? `선택 영역 ${state.areas.length}개` : '반경 '+distance(state.radius)} · ${state.category}${state.query?' · '+state.query:''}${state.view === 'saved' ? ' · 이 기기에만 저장' : ''}`;
  $('scope-label').textContent = state.areas.length ? `영역 ${state.areas.length}개` : `반경 ${distance(state.radius)}`;
  $('filter-dot').hidden=state.radius===500&&state.category==='전체'&&!state.query&&!state.areas.length;
  document.querySelectorAll('[data-category]').forEach(el => {const active=el.dataset.category===state.category;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  document.querySelectorAll('[data-radius]').forEach(el => {const active=Number(el.dataset.radius)===state.radius;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  $('empty-title').textContent=searchError?'검색 연결을 확인해 주세요':searchStatus.includes('찾고')?'식당을 찾고 있어요':'선택 범위에 검색된 식당이 없어요';
  $('empty-copy').textContent=searchError||'반경을 넓히거나 음식 종류·검색어를 바꿔보세요. 네이버가 반환한 일부 결과 중 선택 범위 안의 가게만 표시해요.';
  $('search-status').textContent=searchStatus;$('retry-search').hidden=!searchError;
  renderCards(places); renderMap(places);
}
function renderMap(places) {
  if (!map || mapFailed) return;
  markers.forEach(m => {naver.maps.Event.clearInstanceListeners(m);m.setMap(null);}); markers=[];
  for (const place of places) {
    const marker=new naver.maps.Marker({map,position:new naver.maps.LatLng(place.lat,place.lng),title:place.name,icon:{content:`<span class="map-pin">${escape(place.name)}</span>`,anchor:new naver.maps.Point(55,18)}});
    naver.maps.Event.addListener(marker,'click',() => openDetail(place.id)); markers.push(marker);
  }
  circle.setMap(state.areas.length ? null : map); circle.setCenter(new naver.maps.LatLng(state.center.lat,state.center.lng)); circle.setRadius(state.radius);
  centerMarker.setPosition(new naver.maps.LatLng(state.center.lat,state.center.lng));centerMarker.setMap(state.areas.length?null:map);
}
function openDetail(id){
  const place=filterPlaces([...realPlaces,...savedPlaces],{...state,radius:Infinity,areas:[],bounds:null,category:'전체',query:'',maxPrice:null}).find(p=>p.id===id);
  if(!place)return;
  const website=place.websiteUrl&&!['map.naver.com','m.place.naver.com','pcmap.place.naver.com'].includes(new URL(place.websiteUrl).hostname)?place.websiteUrl:null;
  $('detail-content').innerHTML=`<div class="detail-art ${place.tone}" aria-hidden="true">${place.emoji}</div><p class="eyebrow">네이버 지역 검색</p><h2 id="detail-title">${escape(place.name)}</h2><p class="detail-note">${escape(place.fullCategory||place.category)}</p><dl class="place-facts"><dt>주소</dt><dd>${escape(place.address||'제공되지 않음')}</dd>${place.jibunAddress&&place.jibunAddress!==place.address?`<dt>지번 주소</dt><dd>${escape(place.jibunAddress)}</dd>`:''}<dt>거리</dt><dd>검색 기준점에서 직선 ${distance(place.distance)}</dd>${place.description?`<dt>소개</dt><dd>${escape(place.description)}</dd>`:''}</dl><p class="detail-caveat">영업시간·메뉴·가격·전화번호·별점은 검색 API에서 제공하지 않아요. 최신 정보는 네이버에서 확인해 주세요.</p><a class="primary-button full-width detail-link" href="${escape(place.detailUrl)}" target="_blank" rel="noopener noreferrer">네이버에서 보기 ↗</a>${website?`<a class="secondary-button full-width detail-link" href="${escape(website)}" target="_blank" rel="noopener noreferrer">가게 홈페이지 열기 ↗</a>`:''}<button class="secondary-button full-width" id="detail-save">${saved.includes(id)?'저장 해제':'이 기기에 가게 저장'}</button><button class="exclude-button full-width" id="detail-exclude">검색에서 제외</button><p id="exclude-error" class="muted" role="status" hidden></p>`;
  $('detail-save').onclick=()=>{toggleSaved(id);$('detail-save').textContent=saved.includes(id)?'저장 해제':'이 기기에 가게 저장';};
  $('detail-exclude').onclick=()=>{
    const next=[...excludedPlaces.filter(p=>p.id!==id),{id:place.id,name:place.name,address:place.address||''}];
    if(!saveExclusions(next)){ $('exclude-error').hidden=false;$('exclude-error').textContent='저장할 수 없어 제외하지 않았어요. 브라우저 저장 설정을 확인해 주세요.';return; }
    $('detail-dialog').close();render();
  };
  $('detail-dialog').showModal();
}
function saveExclusions(next){
  try{if(!writeExcluded(localStorage,next))return false;}catch{return false;}
  excludedPlaces=next;return true;
}
function renderExcluded(){
  $('excluded-list').innerHTML=excludedPlaces.length?excludedPlaces.map(p=>`<li class="excluded-item"><div><strong>${escape(p.name)}</strong><p>${escape(p.address)}</p></div><button class="small-button" data-restore="${escape(p.id)}" aria-label="${escape(p.name)} 검색에 다시 표시">복원</button></li>`).join(''):'<li class="muted">제외한 가게가 없어요.</li>';
}
$('open-excluded').onclick=()=>{renderExcluded();$('excluded-error').hidden=true;$('excluded-dialog').showModal();};
$('excluded-list').onclick=event=>{
  const button=event.target.closest('[data-restore]');if(!button)return;
  if(!saveExclusions(excludedPlaces.filter(p=>p.id!==button.dataset.restore))){$('excluded-error').hidden=false;return;}
  $('excluded-error').hidden=true;renderExcluded();render();
};
function toggleSaved(id){
  if(saved.includes(id))savedPlaces=savedPlaces.filter(p=>p.id!==id);
  else{const p=realPlaces.find(p=>p.id===id);if(p)savedPlaces.push(p);}
  saved=savedPlaces.map(p=>p.id);
  try{localStorage.setItem('team-lunch.saved.real.v1',JSON.stringify(savedPlaces));}catch{showStatus('이 브라우저에서는 저장할 수 없어요.');}render();
}
$('search-region').onchange=()=>{scheduleSearch(true);render();};
$('search-all').onclick=()=>{state.view='explore';$('nav-explore').classList.add('active');$('nav-saved').classList.remove('active');$('nav-explore').setAttribute('aria-current','page');$('nav-saved').removeAttribute('aria-current');$('action-status').hidden=true;scheduleSearch(true);render();};
$('retry-search').onclick=()=>{scheduleSearch(true);render();};
$('cards').onclick=event => { const detail=event.target.closest('[data-detail]'),save=event.target.closest('[data-save]'); if(detail)openDetail(detail.dataset.detail);if(save)toggleSaved(save.dataset.save); };
$('categories').onclick=event => {const btn=event.target.closest('[data-category]');if(btn){state.category=btn.dataset.category;render();}};
$('query').oninput=event => {state.query=event.target.value;render();};


function openFilters(){
  $('filter-category').value=state.category;$('filter-query').value=state.query;
  $('radius-slider').value=state.radius;$('radius-output').textContent=distance(state.radius);
  $('radius-field').hidden=!!state.areas.length;$('filter-area-note').hidden=!state.areas.length;
  $('filter-area-note').textContent=`지도에서 선택한 자유형 영역 ${state.areas.length}개 안에서 검색해요. 범위는 지도에서 수정할 수 있어요.`;
  $('filter-dialog').showModal();
}
$('open-filters').onclick=openFilters;$('fine-radius').onclick=openFilters;
$('radius-slider').oninput=event=>$('radius-output').textContent=distance(Number(event.target.value));
$('clear-draft').onclick=()=>{$('filter-category').value='전체';$('filter-query').value='';$('radius-slider').value=500;$('radius-output').textContent='500m';};
$('filter-form').onsubmit=()=>{
  state.category=$('filter-category').value;state.query=$('filter-query').value.trim();$('query').value=state.query;
  if(!state.areas.length)state.radius=Number($('radius-slider').value);
  render();
};
$('radius-presets').onclick=event=>{const btn=event.target.closest('[data-radius]');if(btn){state.radius=Number(btn.dataset.radius);render();}};
function resetFilters(){state.radius=500;state.category='전체';state.maxPrice=null;state.query='';$('query').value='';clearArea();render();}
$('reset-filters').onclick=resetFilters;
$('reset-guest-settings').onclick=()=>{
  locationGeneration++;clearArea();
  Object.assign(state,{center:{...config.initialCenter},radius:500,category:'전체',maxPrice:null,query:'',sort:'distance',demo:false});
  $('query').value='';
  $('location-label').textContent=config.initialLocationLabel;
  if(map&&!mapFailed){map.setCenter(new naver.maps.LatLng(state.center.lat,state.center.lng));map.setZoom(15);}
  render();
};
for(const id of ['login','review-info','nav-reviews'])$(id).onclick=()=>$('info-dialog').showModal();
for(const btn of document.querySelectorAll('[data-close]'))btn.onclick=()=>btn.closest('dialog').close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
function setView(view){state.view=view;for(const key of ['explore','saved']){const el=$('nav-'+key),active=view===key;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}render();if(view==='saved')$('results').scrollIntoView({behavior:'smooth',block:'start'});else window.scrollTo({top:0,behavior:'smooth'});}
$('nav-explore').onclick=()=>setView('explore');$('nav-saved').onclick=()=>setView('saved');
$('recommend').onclick=()=>{const chosen=pickPlaces(currentPlaces());if(!chosen.length)return;renderCards(chosen);$('list-title').innerHTML=`오늘의 추천 <span id="result-count">${chosen.length}</span>`;$('active-filters').textContent+=' · 조건 안에서 무작위 추천';renderMap(chosen);$('results').scrollIntoView({behavior:'smooth',block:'start'});};
function showAreaControls(active=-1,drawing=false){
  const dirty=JSON.stringify(state.areas)!==JSON.stringify(savedAreas);
  const enabled=state.areas.length>0||drawing||dirty;
  $('save-areas').disabled=!dirty||drawing;
  $('cancel-areas').hidden=!dirty&&!drawing;
  $('area-save-status').textContent=drawing?'경계를 그리는 중':dirty?'저장하지 않은 변경사항':'저장된 영역';
  $('radius-mode').classList.toggle('active',!enabled);$('radius-mode').setAttribute('aria-pressed',!enabled);
  $('area-mode').classList.toggle('active',enabled);$('area-mode').setAttribute('aria-pressed',enabled);
  $('area-help').hidden=!enabled;$('area-help').textContent=drawing?'지도 위에서 손가락이나 마우스로 경계를 그린 뒤 놓으세요. 작은 영역은 다시 그릴 수 있어요.':'영역 안쪽을 끌어 위치를 조정한 뒤 저장하기를 눌러 주세요.';$('area-tools').hidden=!enabled;$('radius-presets').hidden=enabled;
  $('area-list').innerHTML=state.areas.map((_,i)=>`<button class="small-button ${i===active?'active':''}" data-area-index="${i}" aria-pressed="${i===active}">영역 ${i+1}</button>`).join('');
  $('add-area').disabled=state.areas.length>=5;
  $('remove-area').disabled=active<0;
}
function clearArea(){savedAreas=[];if(areaController)areaController.clear();else{state.areas=[];showAreaControls();}}
$('radius-mode').onclick=()=>{clearArea();render();};
function addArea(){
  if(!map||mapFailed||!areaController){showStatus('지도 연결 후 영역을 선택할 수 있어요.');return;}
  if(!state.areas.length){const c=map.getCenter();state.center={lat:c.lat(),lng:c.lng()};locationGeneration++;$('location-label').textContent='지도에서 선택한 위치';}
  if(!areaController.add())showStatus('영역은 최대 5개까지 선택할 수 있어요.');
}
$('area-mode').onclick=()=>{if(!state.areas.length)addArea();};
$('add-area').onclick=addArea;
$('remove-area').onclick=()=>areaController?.remove();
$('save-areas').onclick=()=>{
  const previous=savedAreas;savedAreas=structuredClone(state.areas);lastPreferences='';
  if(!persistPreferences()){savedAreas=previous;showStatus('쿠키 저장이 제한되어 저장하지 못했어요. 브라우저 설정을 확인해 주세요.');return;}
  areaController?.select(Math.max(0,state.areas.length-1));
  showAreaControls(state.areas.length-1);render();
};
$('cancel-areas').onclick=()=>{areaController?.replace(savedAreas);};
$('area-list').onclick=event=>{const button=event.target.closest('[data-area-index]');if(button)areaController?.select(Number(button.dataset.areaIndex));};
$('search-here').onclick=()=>{if(!map||mapFailed)return;locationGeneration++;clearArea();const c=map.getCenter();state.center={lat:c.lat(),lng:c.lng()};$('location-label').textContent='지도에서 선택한 위치';scheduleSearch(true);render();};
$('location').onclick=()=>{locationGeneration++;clearArea();state.center={...config.initialCenter};$('location-label').textContent=config.initialLocationLabel;if(map&&!mapFailed){map.setCenter(new naver.maps.LatLng(state.center.lat,state.center.lng));map.setZoom(15);}render();};
function setLocationBusy(busy){
  for(const id of ['my-location','map-my-location']){const button=$(id);button.disabled=busy;button.setAttribute('aria-busy',String(busy));}
}
$('map-my-location').onclick=()=>$('my-location').click();
$('my-location').onclick=()=>{
  if(!navigator.geolocation){showStatus('이 브라우저에서는 위치를 가져올 수 없어요.');return;}
  const generation=++locationGeneration;setLocationBusy(true);
  navigator.geolocation.getCurrentPosition(position=>{ setLocationBusy(false);if(generation!==locationGeneration)return;clearArea();state.center={lat:position.coords.latitude,lng:position.coords.longitude};$('location-label').textContent='내 현재 위치';if(map&&!mapFailed){map.setCenter(new naver.maps.LatLng(state.center.lat,state.center.lng));map.setZoom(15);}render();},error=>{setLocationBusy(false);if(generation!==locationGeneration)return;showStatus(error.code===1?'위치 권한이 꺼져 있어요. 지도에서 위치를 선택해 주세요.':'위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.');},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
};
function mapError(title,copy){clearTimeout(mapTimer);mapFailed=true;$('map-placeholder').hidden=false;$('map-status-title').textContent=title;$('map-status-copy').textContent=copy;$('map-controls').hidden=true;$('map-my-location').hidden=true;$('retry-map').hidden=!config.naverClientId;}
$('retry-map').onclick=()=>window.location.reload();
window.navermap_authFailure=()=>mapError('지도 연결을 확인하고 있어요','네이버 지도 인증 설정을 확인해야 해요. 연결 후 식당을 검색할 수 있어요.');
// SDK 3.10.5 can invoke callback before window.naver is exported.
// Defer initialization until the current SDK script has completed.
window.initNaverMap=()=>queueMicrotask(initializeNaverMap);
function initializeNaverMap(){
  if(mapFailed || map)return;
  try{
    const n=window.naver.maps;
    map=new n.Map('map',{center:new n.LatLng(state.center.lat,state.center.lng),zoom:15,minZoom:7,maxZoom:20,zoomControl:false,scaleControl:true,mapDataControl:true,logoControl:true});
    circle=new n.Circle({map,center:new n.LatLng(state.center.lat,state.center.lng),radius:state.radius,fillColor:'#9cbb71',fillOpacity:.12,strokeColor:'#7b9e58',strokeWeight:1,strokeOpacity:.6});
    centerMarker=new n.Marker({map,position:new n.LatLng(state.center.lat,state.center.lng),title:'검색 기준점',icon:{content:'<span class="center-pin"></span>',anchor:new n.Point(9,9)}});
    clearTimeout(mapTimer);$('map-placeholder').hidden=true;$('map-controls').hidden=false;$('map-my-location').hidden=false;
    new ResizeObserver(()=>{const el=$('map');map.setSize(new n.Size(el.clientWidth,el.clientHeight));}).observe($('map'));
    const restoredAreas=state.areas.map(b=>({...b}));
    areaController=createAreaController(map,n,(areas,active,drawing)=>{state.areas=areas;showAreaControls(active,drawing);render();});
    areaController.replace(restoredAreas);
    savedAreas=structuredClone(state.areas);showAreaControls(state.areas.length-1);render();
  }catch(error){console.error('Naver map initialization failed', error);mapError('지도를 불러오지 못했어요','잠시 후 다시 시도해 주세요. 연결 후 식당을 검색할 수 있어요.');}
};
function loadMap(){
  if(!config.naverClientId){mapError('네이버 지도를 연결하고 있어요','지도 연결 설정을 확인해 주세요.');return;}
  const script=document.createElement('script');script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(config.naverClientId)}&submodules=geocoder&callback=initNaverMap`;script.async=true;script.onerror=()=>mapError('지도를 불러오지 못했어요','네트워크 연결을 확인하고 다시 시도해 주세요.');mapTimer=setTimeout(()=>mapError('지도 연결이 지연되고 있어요','네트워크 연결을 확인한 뒤 다시 연결해 주세요.'),15000);document.head.append(script);
}
render();loadMap();
