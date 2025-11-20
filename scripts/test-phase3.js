import fs from 'fs';
import { parseReactFile } from '../src/parsers/react/index.js';
import { parseLvglFile } from '../src/parsers/lvgl/index.js';
import { parseSketchFile } from '../src/parsers/sketch/index.js';
import { buildIR } from '../src/core/ui-ir/normalize.js';
import { validateIR } from '../src/core/ui-ir/validate.js';

function run(){
  const reactPath='src/sample/sample.jsx';
  const lvglPath='src/sample/sample.c';
  const sketchPath='src/sample/sketch-document.json';
  if(![reactPath,lvglPath,sketchPath].every(p=>fs.existsSync(p))){
    console.error('Phase3 samples missing');
    process.exit(2);
  }
  const reactParsed = parseReactFile(fs.readFileSync(reactPath,'utf-8'));
  const lvglParsed = parseLvglFile(fs.readFileSync(lvglPath,'utf-8'));
  const sketchParsed = parseSketchFile(sketchPath);
  const ir = buildIR({ react:reactParsed, lvgl:lvglParsed, sketch:sketchParsed, screenId:'screen_phase3_test' });
  const v = validateIR(ir);
  if(!v.ok){
    console.error('TEST PHASE3 FAIL: IR invalid', v.errors);
    process.exit(1);
  }
  console.log('TEST PHASE3 PASS: widgets=' + ir.widgets.length + ' sources=' + ir.meta.sources.join(','));
}
run();