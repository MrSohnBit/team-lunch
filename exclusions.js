const KEY = 'team-lunch.excluded.v1';
export function readExcluded(storage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) || '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.filter(p => p && typeof p.id === 'string' && p.id && typeof p.name === 'string' && typeof p.address === 'string' && !seen.has(p.id) && seen.add(p.id));
  } catch { return []; }
}
export function writeExcluded(storage, places) {
  try { storage.setItem(KEY, JSON.stringify(places.map(({id,name,address}) => ({id,name,address})))); return true; }
  catch { return false; }
}
export function withoutExcluded(places, excluded) {
  const ids = new Set(excluded.map(p => p.id));
  return places.filter(p => !ids.has(p.id));
}
