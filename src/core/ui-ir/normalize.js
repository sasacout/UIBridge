import { safeTrim } from '../util/safeTrim.js';
import fs from 'fs';
import path from 'path';

let mappingCache;
function loadMapping(){
  if(!mappingCache){
    const p = path.resolve('src/core/mapping/mapping-rules.json');
    try {
      const raw = fs.readFileSync(p,'utf-8');
      mappingCache = JSON.parse(raw);
    }
    catch(e){
      // 안전한 기본 구조
      mappingCache = { widgetMap:{}, styleMap:{}, eventMap:{} };
    }
  }
  return mappingCache;
}

export function buildIR(parts) {
  const collected = [];
  // parts 키가 lvgl/react/sketch에 한정되어 있지 않을 수도 있으므로
  // 우선 선언된 순서로 돌되, 존재하는 것만 처리
  for (const key of ['lvgl','react','sketch']) {
    const seg = parts[key];
    if (seg?.raw && Array.isArray(seg.raw)) {
      seg.raw.forEach(w => {
        // source 정보가 없으면 해당 파트 키를 source로 지정
        if (!w.source) w.source = key;
        collected.push(applyMapping(w));
      });
    }
  }

  const merged = mergeById(collected);
  return {
    version:'1.0',
    screenId: parts.screenId || 'screen_auto',
    widgets: merged,
    assets: {},
    meta: { sources: Object.keys(parts).filter(k=>parts[k]?.raw), mappingApplied: true }
  };
}

function mergeById(list){
  const map=new Map();
  for(const w of list){
    if(!map.has(w.id)) {
      // 방어적 복사
      map.set(w.id, { ...w, style: { ...w.style }, events: [...(w.events||[])], children: [...(w.children||[])] });
    } else {
      const prev = map.get(w.id);
      // style: 기존 스타일을 우선하고 새 스타일을 덮어쓴다
      const mergedStyle = { ...(prev.style||{}), ...(w.style||{}) };
      // events: 중복 제거 고려 (간단히 name+payload 기준)
      const mergedEvents = [...(prev.events||[])];
      for(const ev of (w.events||[])){
        // 단순 중복 검사: 같은 name+handler가 없으면 push
        if(!mergedEvents.some(e => e.name === ev.name && JSON.stringify(e) === JSON.stringify(ev))){
          mergedEvents.push(ev);
        }
      }
      // children: 순서를 보존하면서 중복 제거
      const mergedChildren = [...prev.children];
      for(const c of (w.children||[])){
        if(!mergedChildren.includes(c)) mergedChildren.push(c);
      }
      const merged = {
        ...prev,
        ...w,
        style: mergedStyle,
        events: mergedEvents,
        children: mergedChildren
      };
      map.set(w.id, merged);
    }
  }
  return [...map.values()];
}

function applyMapping(w){
  const mapping = loadMapping();

  // 방어적 기본값 보장
  const source = w.source || 'unknown';
  let type = w.type || 'Container';

  // widget type 매핑 (양방향 고려)
  const widgetRule = mapping.widgetMap && mapping.widgetMap[type];
  if(widgetRule){
    if(source === 'lvgl' && widgetRule.react) {
      type = widgetRule.react;
    } else if (source === 'react' && widgetRule.lvgl) {
      // react -> lvgl 매핑이 필요하면 여기서 변경(현재는 보존하는 편)
      type = widgetRule.lvgl || type;
    }
  }

  // 스타일 매핑: styleMap에서 tailwind나 변환 규칙을 적용
  const tailwindClasses = [];
  const computedStyle = { ...(w.style || {}) };

  if (w.style && typeof w.style === 'object') {
    for(const key of Object.keys(w.style)){
      const styleRule = mapping.styleMap && mapping.styleMap[key];
      if(!styleRule) continue;
      // styleRule.tailwind은 string 또는 array 또는 함수일 수 있으므로 안전 처리
      const t = styleRule.tailwind;
      if(typeof t === 'string' && t.trim()) tailwindClasses.push(t.trim());
      else if(Array.isArray(t)) tailwindClasses.push(...t.map(s=>String(s).trim()).filter(Boolean));
      else if(typeof t === 'function'){
        try {
          const result = t(w.style[key], w); // pass value and widget for custom rules
          if(typeof result === 'string') tailwindClasses.push(result.trim());
          else if(Array.isArray(result)) tailwindClasses.push(...result.map(s=>String(s).trim()).filter(Boolean));
        } catch(e){
          // ignore custom function failure
        }
      }
      // 가능하면 styleRule 가 추가 지시를 제공하면 computedStyle에 병합
      if(styleRule.extraStyle && typeof styleRule.extraStyle === 'object'){
        Object.assign(computedStyle, styleRule.extraStyle);
      }
    }
  }

  // layout 보강: 빈 layout이면 {}로 설정, 기존 값 보존
  const layout = { ...(w.layout || {}) };

  // 이벤트 매핑: 이벤트 객체가 이벤트 소스 정보를 가지지 않을 수 있으니
  // 우선 위젯의 source를 사용하고, 이벤트 자체에 source가 있으면 그걸 우선
  const eventsIn = Array.isArray(w.events) ? w.events : [];
  const eventsOut = eventsIn.map(ev => {
    const evSource = ev.source || source || 'unknown';
    const evRule = mapping.eventMap && mapping.eventMap[ev.name];
    let newName = ev.name;
    if(evRule){
      if(evSource === 'lvgl' && evRule.react) newName = evRule.react;
      else if(evSource === 'react' && evRule.lvgl) newName = evRule.lvgl;
    }
    return { ...ev, name: newName, source: evSource };
  });

  // children 보장 (배열)
  const children = Array.isArray(w.children) ? [...w.children] : [];

  // flags/hidden 체크(일부 파서에서 flag가 style에 들어갈 수 있음)
  const flags = w.flags || w.style?.flags || {};

  return {
    id: w.id,
    source,
    type,
    text: safeTrim(w.text || ''),
    src: w.src || '',
    layout,
    style: computedStyle,
    tailwind: tailwindClasses.join(' ').trim(),
    events: eventsOut,
    assets: w.assets || [],
    children
  };
}
