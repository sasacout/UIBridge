import fs from 'fs';
import { safeTrim } from '../../core/util/safeTrim.js';

export function parseSketchFile(path) {
  if(!fs.existsSync(path)) return { raw: [], meta:{ parser:'sketch', error:'file_not_found' } };
  let json;
  try { json = JSON.parse(fs.readFileSync(path,'utf-8')); } catch(e){ return { raw: [], meta:{ parser:'sketch', error:'json_parse_fail' } }; }
  const widgets = [];
  const layers = json.layers || [];
  layers.forEach((l,i)=> {
    if(l.type==='text') widgets.push({ id:`sk_label_${i}`, type:'Label', text: safeTrim(l.name || l.text || ''), layout:{}, style:{}, events:[], source:'sketch' });
    else if(l.type==='button') widgets.push({ id:`sk_button_${i}`, type:'Button', text: safeTrim(l.text || l.name || ''), layout:{}, style:{}, events:[], source:'sketch' });
  });
  return { raw: widgets, meta:{ parser:'sketch', count: widgets.length } };
}
