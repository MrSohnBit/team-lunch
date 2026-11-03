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
  const b=value.bounds;
  if (result.center && b && coordinate({lat:b.south,lng:b.west}) && coordinate({lat:b.north,lng:b.east}) && b.south<b.north && b.west<b.east) result.bounds={south:b.south,north:b.north,west:b.west,east:b.east};
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
    const value=encodeURIComponent(JSON.stringify(data));
    const path=new URL('.',location.href).pathname;
    doc.cookie=`${COOKIE_NAME}=${value}; Path=${path}; Max-Age=2592000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
    return doc.cookie.split(';').some(v=>v.trim()===`${COOKIE_NAME}=${value}`);
  } catch { return false; }
}
