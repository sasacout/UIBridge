import fs from 'fs';
import { parseReactFile } from '../src/parsers/react/index.js';
import { parseLvglFile } from '../src/parsers/lvgl/index.js';
import { buildIR } from '../src/core/ui-ir/normalize.js';
import { validateIR } from '../src/core/ui-ir/validate.js';

function run() {
  const reactPath = 'src/sample/sample.jsx';
  const lvglPath = 'src/sample/sample.c';
  if (!fs.existsSync(reactPath) || !fs.existsSync(lvglPath)) {
    console.error('Sample files missing');
    process.exit(2);
  }
  const reactCode = fs.readFileSync(reactPath, 'utf-8');
  const lvglCode = fs.readFileSync(lvglPath, 'utf-8');
  const reactParsed = parseReactFile(reactCode);
  const lvglParsed = parseLvglFile(lvglCode);
  const ir = buildIR({ react: reactParsed, lvgl: lvglParsed, screenId: 'screen_test' });
  const v = validateIR(ir);
  if (!v.ok) {
    console.error('TEST FAIL: IR invalid', v.errors);
    process.exit(1);
  }
  console.log('TEST PASS: widgets=' + ir.widgets.length);
}
run();
