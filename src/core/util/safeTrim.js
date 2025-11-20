export function safeTrim(v){ if(v==null) return ''; return typeof v==='string'? v.trim(): String(v).trim(); }
