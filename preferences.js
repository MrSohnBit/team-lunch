export const COOKIE_NAME = 'team_lunch_guest_v1';
const categories = ['전체','한식','일식','중식','양식','샐러드','분식'];
const coordinate = p => p && Number.isFinite(p.lat) && Math.abs(p.lat)<=90 && Number.isFinite(p.lng) && Math.abs(p.lng)<=180;
export function sanitizePreferences(value) {
  if (!value || value.version !== 1) return {};
  const result = {};
  if (Number.isInteger(value.radius) && value.radius>=10 && value.radius<=2000 && value.radius%10===0) result.radius=value.radius;
  if (categories.includes(value.category)) result.category=value.category;
  if ([null,10000,15000,20000].includes(value.maxPrice)) result.maxPrice=value.maxPrice;
  if (['distance','price'].includes(value.sort)) result.sort=value.sort;
  if (typeof value.query==='string') result.query=Array.from(value.query).slice(0,100).join('');
  if (typeof value.demo==='boolean') result.demo=value.demo;
  if (coordinate(value.center)) result.center={lat:value.center.lat,lng:value.center.lng};
  if(Array.isArray(value.polygons)) value={...value,areas:value.polygons.slice(0,5).map(encoded=>({points:typeof encoded==='string'?encoded.split(';').map(pair=>{const [lat,lng]=pair.split('.').map(v=>parseInt(v,36)/1e5);return {lat,lng};}):[]}))};
  const b=value.bounds;
  if (result.center && b && coordinate({lat:b.south,lng:b.west}) && coordinate({lat:b.north,lng:b.east}) && b.south<b.north && b.west<b.east) result.bounds={south:b.south,north:b.north,west:b.west,east:b.east};
  if (result.center && Array.isArray(value.areas)) result.areas=value.areas.slice(0,5).filter(b=>Array.isArray(b?.points)?b.points.length>=3&&b.points.length<=32&&b.points.every(coordinate):b && coordinate({lat:b.south,lng:b.west}) && coordinate({lat:b.north,lng:b.east}) && b.south<b.north && b.west<b.east).map(b=>Array.isArray(b.points)?{points:b.points.map(p=>({lat:Number(p.lat.toFixed(5)),lng:Number(p.lng.toFixed(5))}))}:Object.fromEntries(['south','north','west','east'].map(k=>[k,Number(b[k].toFixed(6))])));
  return result;
}
export function readPreferences(doc) {
  try {
    const item=doc.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE_NAME+'='));
    return item ? sanitizePreferences(JSON.parse(decodeURIComponent(item.slice(COOKIE_NAME.length+1)))) : {};
  } catch { return {}; }
}
export function writePreferences(state, doc, location) {
  try {
    const data={version:1,...sanitizePreferences({...state,version:1})};
    if(data.areas?.some(a=>a.points)){
      data.polygons=data.areas.map(a=>(a.points??[{lat:a.south,lng:a.west},{lat:a.north,lng:a.west},{lat:a.north,lng:a.east},{lat:a.south,lng:a.east}]).map(p=>`${Math.round(p.lat*1e5).toString(36)}.${Math.round(p.lng*1e5).toString(36)}`).join(';'));
      delete data.areas;
    }
    const value=encodeURIComponent(JSON.stringify(data));
    const path=new URL('.',location.href).pathname;
    doc.cookie=`${COOKIE_NAME}=${value}; Path=${path}; Max-Age=2592000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
    return doc.cookie.split(';').some(v=>v.trim()===`${COOKIE_NAME}=${value}`);
  } catch { return false; }
}
