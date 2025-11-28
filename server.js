import express from 'express';
import JSON5 from 'json5';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;
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

// LVGL/React 스크린 목록을 반환하는 API (프론트엔드 fetchScreens에서 사용)
function scanLvgl(dir) {
	if (!dir || !fs.existsSync(dir)) return [];
	const out = [];
	const walk = d => {
		const ents = fs.readdirSync(d, { withFileTypes: true });
		for (const e of ents) {
			const full = path.join(d, e.name);
			if (e.isDirectory()) walk(full);
			else if (full.endsWith('.c') && path.basename(full).startsWith('screen_')) out.push(full);
		}
	};
	walk(dir);
	return out;
}
function scanReact(dir) {
	if (!dir || !fs.existsSync(dir)) return [];
	const out = [];
	const walk = d => {
		const ents = fs.readdirSync(d, { withFileTypes: true });
		for (const e of ents) {
			const full = path.join(d, e.name);
			if (e.isDirectory()) walk(full);
			else if (full.endsWith('.jsx') && path.basename(full).startsWith('screen_')) out.push(full);
		}
	};
	walk(dir);
	return out;
}

app.get('/api/screens', (req, res) => {
	const { lvglRoot, reactRoot } = req.query;
	const lvglScreens = scanLvgl(lvglRoot);
	const reactScreens = scanReact(reactRoot);
	res.json({ lvglScreens, reactScreens });
});

// Sketch DOM에서 특정 id의 섹션을 IR로 변환하는 간단한 API
// links 폴더 내에서 sketchId와 일치하는 번호가 포함된 HTML 파일을 찾아 해당 파일 전체를 IR로 변환
app.get('/api/sketch-dom-ir', async (req, res) => {
		let { sketchFile, sketchId } = req.query;
		if (!sketchFile || !sketchId) return res.status(400).json({ error: 'missing_params' });
		try {
			sketchFile = decodeURIComponent(sketchFile);
		} catch (e) {
			return res.status(400).json({ error: 'sketchFile_decode_error', detail: e.message });
		}
		// sketchFile은 index.html 파일 경로여야 함
		if (!fs.existsSync(sketchFile) || !fs.statSync(sketchFile).isFile()) {
			return res.status(404).json({ error: 'sketch_file_not_found', path: sketchFile });
		}
		let html;
		try {
			html = fs.readFileSync(sketchFile, 'utf-8');
		} catch (e) {
			return res.status(404).json({ error: 'sketchFile_read_error', detail: e.message, path: sketchFile });
		}
		// <script> 태그에서 data 변수의 JSON 추출 (let/var/const 모두 지원)
		const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
		let match, scriptContent = '';
		while ((match = scriptRegex.exec(html)) !== null) {
			if (match[1].match(/(let|var|const)\s+data\s*=/)) {
				scriptContent = match[1];
				break;
			}
		}
		if (!scriptContent) {
			return res.status(404).json({ error: 'data_script_not_found' });
		}
		// data 변수 추출 (let/var/const 모두 지원, 중괄호 짝 맞추기)
		const dataDeclMatch = scriptContent.match(/(let|var|const)\s+data\s*=\s*([\[{])/);
		if (!dataDeclMatch) {
			return res.status(404).json({ error: 'data_var_not_found' });
		}
		const startIdx = scriptContent.indexOf(dataDeclMatch[0]);
		const openChar = dataDeclMatch[2];
		const closeChar = openChar === '{' ? '}' : ']';
		let braceCount = 0;
		let inString = false;
		let stringChar = '';
		let endIdx = -1;
		for (let i = scriptContent.indexOf(openChar, startIdx); i < scriptContent.length; i++) {
			const c = scriptContent[i];
			if (inString) {
				if (c === stringChar && scriptContent[i-1] !== '\\') {
					inString = false;
				}
				continue;
			}
			if (c === '"' || c === "'") {
				inString = true;
				stringChar = c;
				continue;
			}
			if (c === openChar) braceCount++;
			if (c === closeChar) braceCount--;
			if (braceCount === 0) {
				endIdx = i + 1;
				break;
			}
		}
		if (endIdx === -1) {
			return res.status(500).json({ error: 'data_object_not_closed' });
		}
		const dataStr = scriptContent.slice(scriptContent.indexOf(openChar, startIdx), endIdx);
		let dataObj;
		try {
			dataObj = JSON5.parse(dataStr);
		} catch (e) {
			return res.status(500).json({ error: 'data_json_parse_error', detail: e.message });
		}
		// artboards 배열에서 slug에 sketchId가 포함된 artboard 찾기
		let artboard = null;
		if (dataObj && Array.isArray(dataObj.artboards)) {
			const sketchNum = sketchId.replace(/^s/i, '');
			artboard = dataObj.artboards.find(a => {
				if (typeof a.slug !== 'string') return false;
				return a.slug.includes(sketchId) || a.slug.includes(sketchNum);
			});
		}
		if (!artboard) {
			return res.status(404).json({ error: 'sketch_id_not_found', sketchId });
		}
		// artboard를 임시 파일로 저장 후 parseSketchFile로 IR 변환
		const tmpPath = './__tmp_sketch_artboard.json';
		fs.writeFileSync(tmpPath, JSON.stringify({
		  layers: artboard.layers || [],
		  width: artboard.width,
		  height: artboard.height
		}, null, 2));
		let ir = { widgets: [], meta: { parser: 'sketch', error: 'parse_fail' } };
		try {
			ir = parseSketchFile(tmpPath, sketchId);
		} catch (e) {
			ir = { widgets: [], meta: { parser: 'sketch', error: e.message } };
		}
		fs.unlinkSync(tmpPath);
		res.json({
			version: '1.0',
			screenId: sketchId,
			data: artboard, // 원본
			ir // 변환된 IR
		});
});

// IR 빌드 API
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

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
	console.log(`[API] listening on ${PORT}`);
});
