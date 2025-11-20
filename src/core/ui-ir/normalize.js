import { safeTrim } from '../util/safeTrim.js';
import fs from 'fs';

let mappingCache;
function loadMapping(){
  if(!mappingCache){
    try { mappingCache = JSON.parse(fs.readFileSync('src/core/mapping/mapping-rules.json','utf-8')); }
    catch(e){ mappingCache = { widgetMap:{}, styleMap:{}, eventMap:{} }; }
  }
  return mappingCache;
}
export function buildIR(parts) {
  const collected = [];
  for (const key of ['lvgl','react','sketch']) {
    const seg = parts[key];
    if (seg?.raw) {
    seg.raw.forEach(w => collected.push(applyMapping(w)));
    }
  }
  const merged = mergeById(collected);
  return { version:'1.0', screenId: parts.screenId || 'screen_auto', widgets: merged, assets:{}, meta:{ sources: Object.keys(parts).filter(k=>parts[k]?.raw), mappingApplied: true } };
}
function mergeById(list){
  const map=new Map();
  for(const w of list){
    if(!map.has(w.id)) map.set(w.id,w); else {
      const prev=map.get(w.id);
      map.set(w.id,{...prev,...w, style:{...prev.style,...w.style}, events:[...prev.events,...w.events]});
    }
  }
  return [...map.values()];
}

function applyMapping(w){
  const mapping = loadMapping();
  let type = w.type;
  const widgetRule = mapping.widgetMap[type];
  if(widgetRule?.react && w.source === 'lvgl') type = widgetRule.react;
  if(widgetRule?.lvgl && w.source === 'react') type = widgetRule.lvgl === type ? type : type; // keep original for now
  const tailwind = [];
  for(const key in w.style){
    const styleRule = mapping.styleMap[key];
    if(styleRule?.tailwind) tailwind.push(styleRule.tailwind);
  }
  const events = (w.events||[]).map(ev => {
    const evRule = mapping.eventMap[ev.name];
    if(ev.source === 'lvgl' && evRule?.react) return { ...ev, name: evRule.react };
    if(ev.source === 'react' && evRule?.lvgl) return { ...ev, name: evRule.lvgl };
    return ev;
  });
  return {
    id: w.id,
    type,
    text: safeTrim(w.text || ''),
    src: w.src || '', // 이미지 src 포함
    layout: w.layout || {},
    style: w.style || {},
    tailwind: tailwind.join(' '),
    events,
    assets: w.assets || [],
    children: w.children || []
  };
}
