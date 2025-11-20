// Simple in-memory cache placeholder
const store = new Map();
export function setCache(key, value) { store.set(key, value); }
export function getCache(key) { return store.get(key); }
export function hasCache(key) { return store.has(key); }
export function clearCache() { store.clear(); }
