import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { parseLvglFile } from './src/parsers/lvgl/index.js';
import { parseReactFile } from './src/parsers/react/index.js';
import { parseSketchFile } from './src/parsers/sketch/index.js';
import { buildIR } from './src/core/ui-ir/normalize.js';
import { validateIR } from './src/core/ui-ir/validate.js';

const app = express();

app.use(cors());
app.use(express.json());
// 이미지 폴더 static 서빙
app.use('/images', express.static('D:/source/LUPA/2026/CommonUI_24inch_v1.0/ui/images'));

function listFiles(dir, pattern) {
  const out = [];
  if (!dir || !fs.existsSync(dir)) return out;
  const walk = d => {
    const ents = fs.readdirSync(d, { withFileTypes: true });
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full); else if (pattern.test(e.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}
function scanLvgl(root) {
  if (!root) return [];
  const genDir = path.join(root, 'gui', 'generated');
  if (!fs.existsSync(genDir)) {
    console.log('[scanLvgl] 경로 없음:', genDir);
    return [];
  }
  // screen_*.c 또는 *.c 모두 허용
  const files = fs.readdirSync(genDir).filter(f => f.endsWith('.c'));
  if (files.length === 0) {
    console.log('[scanLvgl] C 파일 없음:', genDir);
  }
  // screen_*.c 우선, 없으면 *.c 전체 반환
  const screenFiles = files.filter(f => /^screen_.*\.c$/i.test(f));
  const result = (screenFiles.length > 0 ? screenFiles : files).map(f => path.join(genDir, f));
  console.log('[scanLvgl] 반환:', result);
  return result;
}
function scanReact(root) {
  if (!root) return [];
  const screens = [];
  const walk = dir => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(name => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/screen_.*\.(jsx|tsx)$/i.test(name)) screens.push(full);
    });
  };
  walk(root);
  return screens;
}
// 정답지 스크린샷 static 서빙 제거 (보안)

// New unified convert endpoint: requires all paths; no auto conversion before user supplies them.
app.post('/api/convert', (req, res) => {
  console.time('api_convert_total');
  const { lvglRoot, reactRoot, sketchPath, screenshotPath } = req.body;
  if (!lvglRoot || !reactRoot || !sketchPath || !screenshotPath) {
    return res.status(400).json({ error: 'missing_paths', required: ['lvglRoot','reactRoot','sketchPath','screenshotPath'] });
  }
  console.time('scanLvgl');
  const lvglScreens = scanLvgl(lvglRoot);
  console.timeEnd('scanLvgl');
  console.time('scanReact');
  const reactScreens = scanReact(reactRoot);
  console.timeEnd('scanReact');
  console.time('scanScreenshots');
  const screenshots = scanScreenshots(screenshotPath);
  console.timeEnd('scanScreenshots');
  console.time('parseSketchFile');
  const sketch = parseSketchFile(sketchPath);
  console.timeEnd('parseSketchFile');
  if (lvglScreens.length === 0 && reactScreens.length === 0) {
    return res.status(404).json({ error: 'no_source_files' });
  }
  const chosenLvgl = lvglScreens[0];
  const chosenReact = reactScreens[0];
  const parts = { screenId: path.basename(chosenLvgl || chosenReact || 'screen_auto', path.extname(chosenLvgl || chosenReact || '')) };
  if (chosenLvgl && fs.existsSync(chosenLvgl)) {
    console.time('parseLvglFile');
    parts.lvgl = parseLvglFile(fs.readFileSync(chosenLvgl,'utf-8'));
    console.timeEnd('parseLvglFile');
  }
  if (chosenReact && fs.existsSync(chosenReact)) {
    console.time('parseReactFile');
    parts.react = parseReactFile(fs.readFileSync(chosenReact,'utf-8'));
    console.timeEnd('parseReactFile');
  }
  if (sketch.raw?.length) parts.sketch = sketch;
  console.time('buildIR');
  const ir = buildIR(parts);
  console.timeEnd('buildIR');
  console.time('validateIR');
  const v = validateIR(ir);
  console.timeEnd('validateIR');
  if (!v.ok) return res.status(400).json({ error: 'invalid_ir', detail: v.errors });
  console.timeEnd('api_convert_total');
  res.json({ status: 'ok', ir, screenId: ir.screenId, sources: { lvglScreens, reactScreens, sketchParsed: sketch.raw?.length || 0, screenshots } });
});

// Restore granular endpoints used by preview App
app.get('/api/screens', (req, res) => {
  const { lvglRoot, reactRoot } = req.query;
  const lvglScreens = scanLvgl(lvglRoot);
  const reactScreens = scanReact(reactRoot);
  res.json({ lvglScreens, reactScreens });
});

app.post('/api/build-ir', (req, res) => {
  const { lvglRoot, reactRoot, sketchFile, screen } = req.body;
  const parts = { screenId: screen || 'screen_auto' };
  if (reactRoot && fs.existsSync(reactRoot)) {
    const reactFiles = scanReact(reactRoot);
    const chosen = screen ? reactFiles.find(f=>f.includes(screen)) : reactFiles[0];
    if (chosen) parts.react = parseReactFile(fs.readFileSync(chosen,'utf-8'));
  }
  if (lvglRoot && fs.existsSync(lvglRoot)) {
    const lvglFiles = scanLvgl(lvglRoot);
    let chosen;
    if (screen) {
      // Try exact match with .c extension first
      chosen = lvglFiles.find(f => f.endsWith(`${screen}.c`));
      // Fallback: substring match
      if (!chosen) chosen = lvglFiles.find(f => f.includes(screen));
    } else {
      chosen = lvglFiles[0];
    }
    if (chosen) {
      const lvglRaw = parseLvglFile(fs.readFileSync(chosen,'utf-8'));
      parts.lvgl = lvglRaw;
      console.log('[build-ir] LVGL parsed:', Array.isArray(lvglRaw.raw) ? lvglRaw.raw.length : typeof lvglRaw);
    } else {
      console.log('[build-ir] No LVGL file chosen');
    }
  }
  if (sketchFile && fs.existsSync(sketchFile)) {
    parts.sketch = parseSketchFile(sketchFile);
  }
  console.time('api_build_ir_total');
  console.time('buildIR');
  const ir = buildIR(parts);
  console.timeEnd('buildIR');
  console.log('[build-ir] IR widgets:', ir.widgets ? ir.widgets.length : 'none');
  console.time('validateIR');
  const v = validateIR(ir);
  console.timeEnd('validateIR');
  if (!v.ok) {
    console.error('[build-ir] validateIR failed:', JSON.stringify(v.errors, null, 2));
    console.timeEnd('api_build_ir_total');
    return res.status(400).json({ error: 'invalid_ir', detail: v.errors });
  }
  console.timeEnd('api_build_ir_total');
  res.json(ir);
});

app.get('/api/coverage', (req, res) => {
  const { lvglRoot, reactRoot, sketchFile } = req.query;
  let reactCount=0, lvglCount=0, sketchCount=0;
  try {
    if (reactRoot && fs.existsSync(reactRoot)) {
      scanReact(reactRoot).forEach(f=>{
        try {
          const parsed = parseReactFile(fs.readFileSync(f,'utf-8'));
          reactCount += Array.isArray(parsed.raw) ? parsed.raw.length : 0;
        } catch (e) {
          console.error('[coverage] React parse error:', f, e);
        }
      });
    }
    if (lvglRoot && fs.existsSync(path.join(lvglRoot,'gui','generated'))) {
      scanLvgl(lvglRoot).forEach(f=>{
        try {
          const parsed = parseLvglFile(fs.readFileSync(f,'utf-8'));
          lvglCount += Array.isArray(parsed.raw) ? parsed.raw.length : (Array.isArray(parsed) ? parsed.length : 0);
        } catch (e) {
          console.error('[coverage] LVGL parse error:', f, e);
        }
      });
    }
    if (sketchFile && fs.existsSync(sketchFile)) {
      try {
        const parsed = parseSketchFile(sketchFile);
        sketchCount = Array.isArray(parsed.raw) ? parsed.raw.length : 0;
      } catch (e) {
        console.error('[coverage] Sketch parse error:', sketchFile, e);
      }
    }
    res.json({ reactCount, lvglCount, sketchCount, total: reactCount+lvglCount+sketchCount });
  } catch (err) {
    console.error('[coverage] Internal error:', err);
    res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`[API] listening on ${PORT}`);
});