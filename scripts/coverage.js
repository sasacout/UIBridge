import fs from 'fs';
import { parseReactFile } from '../src/parsers/react/index.js';
import { parseLvglFile } from '../src/parsers/lvgl/index.js';
import { parseSketchFile } from '../src/parsers/sketch/index.js';
import { buildIR } from '../src/core/ui-ir/normalize.js';

function metric(){
  const paths = {
    react:'src/sample/sample.jsx',
    lvgl:'src/sample/sample.c',
    sketch:'src/sample/sketch-document.json'
  };
  const reactParsed = parseReactFile(fs.readFileSync(paths.react,'utf-8'));
  const lvglParsed = parseLvglFile(fs.readFileSync(paths.lvgl,'utf-8'));
  const sketchParsed = parseSketchFile(paths.sketch);
  const ir = buildIR({ react:reactParsed, lvgl:lvglParsed, sketch:sketchParsed, screenId:'coverage' });
  const widgetCount = ir.widgets.length;
  const withChildren = ir.widgets.filter(w=>w.children && w.children.length>0).length;
  const parentRatio = widgetCount===0?0:(withChildren/widgetCount*100);
  return {
    sources: ir.meta.sources,
    widgetCount,
    parentChildLinked: withChildren,
    parentChildCoverage: Number(parentRatio.toFixed(2))
  };
}
console.log(JSON.stringify(metric(),null,2));