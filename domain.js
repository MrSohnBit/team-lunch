export function distanceMeters(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function normalizedBounds(a, b) {
  return { south: Math.min(a.lat,b.lat), north: Math.max(a.lat,b.lat), west: Math.min(a.lng,b.lng), east: Math.max(a.lng,b.lng) };
}
export function insideBounds(p, b) {
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}
export function filterPlaces(places, state) {
  const query = state.query.trim().toLowerCase();
  return places.map(place => ({ ...place, distance: distanceMeters(state.center, place) }))
    .filter(place => (!query || `${place.name} ${place.menu} ${place.category}`.toLowerCase().includes(query))
      && (state.category === '전체' || state.category === place.category)
      && (state.maxPrice === null || (Number.isFinite(place.price) && place.price <= state.maxPrice))
      && (state.areas?.length ? state.areas.some(b => insideBounds(place,b)) : state.bounds ? insideBounds(place, state.bounds) : place.distance <= state.radius))
    .sort((a,b) => state.sort === 'price' ? (a.price ?? Infinity) - (b.price ?? Infinity) || a.distance - b.distance : a.distance - b.distance);
}
export function pickPlaces(places, count = 3, random = Math.random) {
  const copy = [...places];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i+1)); [copy[i],copy[j]] = [copy[j],copy[i]]; }
  return copy.slice(0,count);
}
export const demoPlaces = [
  {id:'demo-1',name:'초록 식탁',menu:'제육볶음 정식',category:'한식',price:9500,lat:37.5671,lng:126.9791,emoji:'🍚',tone:'sage',note:'따뜻한 한 끼가 생각나는 날'},
  {id:'demo-2',name:'소담 우동',menu:'가케우동 & 유부초밥',category:'일식',price:11000,lat:37.5654,lng:126.9788,emoji:'🍜',tone:'sand',note:'가볍고 든든한 점심 한 그릇'},
  {id:'demo-3',name:'데일리 그린',menu:'치킨 아보카도 볼',category:'샐러드',price:12500,lat:37.5681,lng:126.9769,emoji:'🥗',tone:'green',note:'산뜻하게 채우고 싶은 날'},
  {id:'demo-4',name:'오후의 파스타',menu:'토마토 파스타',category:'양식',price:14000,lat:37.5647,lng:126.9758,emoji:'🍝',tone:'peach',note:'기분 전환이 필요한 점심'},
  {id:'demo-5',name:'동네 반점',menu:'짜장면',category:'중식',price:8000,lat:37.5692,lng:126.9797,emoji:'🥟',tone:'sand',note:'익숙해서 더 좋은 한 끼'},
  {id:'demo-6',name:'한입 분식',menu:'김밥 & 떡볶이',category:'분식',price:7500,lat:37.5631,lng:126.9794,emoji:'🍙',tone:'peach',note:'가볍게 즐기는 점심 조합'},
];
