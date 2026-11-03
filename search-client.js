const endpoint='https://team-lunch-search-mrsohnbit.mmrsohn.chatgpt.site/api/search';
const cuisines=['한식','일식','중식','양식','샐러드','분식'];
export function categoryFor(value){return cuisines.find(c=>String(value).includes(c))||'기타';}
export function toPlace(p){
  if(!p||typeof p.name!=='string'||typeof p.id!=='string'||!Number.isFinite(p.lat)||!Number.isFinite(p.lng))return null;
  let url;try{url=new URL(p.detailUrl);}catch{return null;}
  if(url.protocol!=='https:'||!['map.naver.com','m.place.naver.com','pcmap.place.naver.com'].includes(url.hostname))return null;
  if(!p.directDetail)url=new URL('https://map.naver.com/p/search/'+encodeURIComponent(`${(p.address||'').split(/\s+/).slice(0,2).join(' ')} ${p.name}`.trim()));
  const fullCategory=p.fullCategory||p.category;
  const category=categoryFor(fullCategory);
  let websiteUrl=null;try{const site=new URL(p.websiteUrl);if(['http:','https:'].includes(site.protocol)&&!site.username&&!site.password)websiteUrl=site.href;}catch{}
  return {...p,websiteUrl,fullCategory,detailUrl:url.href,category,menu:p.address||'',price:null,emoji:({한식:'🍚',일식:'🍜',중식:'🥟',양식:'🍝',샐러드:'🥗',분식:'🍙'})[category]||'🍽️',tone:'sage'};
}
export function searchCenters(state){
  if(!state.areas.length)return [state.center];
  return state.areas.map(a=>a.points?{lat:a.points.reduce((s,p)=>s+p.lat,0)/a.points.length,lng:a.points.reduce((s,p)=>s+p.lng,0)/a.points.length}:{lat:(a.north+a.south)/2,lng:(a.west+a.east)/2});
}
export function regionAt(n,point){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('지역 주소를 확인하지 못했어요. 검색 지역을 직접 입력해 주세요.')),9000);
    n.Service.reverseGeocode({coords:new n.LatLng(point.lat,point.lng),orders:'addr'},(status,response)=>{
      clearTimeout(timer);const region=response?.v2?.results?.[0]?.region;
      if(status!==n.Service.Status.OK||!region){reject(Error('지역 주소를 확인하지 못했어요. 검색 지역을 직접 입력해 주세요.'));return;}
      resolve([region.area1?.name,region.area2?.name,region.area3?.name].filter(Boolean).join(' '));
    });
  });
}
export async function findPlaces(regions,state,signal){
  const terms=state.query.trim()?[state.query.trim()]:state.category==='전체'?cuisines:[state.category];
  const queries=[...new Set(regions.flatMap(region=>terms.map(term=>`${region} ${term}`)))];
  const results=await Promise.allSettled(queries.map(async query=>{
    const response=await fetch(`${endpoint}?${new URLSearchParams({query})}`,{signal});
    const data=await response.json();if(!response.ok)throw Error(data.error||'검색에 실패했어요.');
    return data.places.map(toPlace).filter(Boolean);
  }));
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const success=results.filter(r=>r.status==='fulfilled');
  if(!success.length)throw results[0]?.reason||Error('검색에 실패했어요.');
  return {places:[...new Map(success.flatMap(r=>r.value).map(p=>[p.id,p])).values()],partial:success.length<results.length};
}
