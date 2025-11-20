import { generateReact } from './generators/react/index.js';
import { generateLvgl } from './generators/lvgl/index.js';
import fs from 'fs';
import { parseReactFile } from './parsers/react/index.js';
import { parseLvglFile } from './parsers/lvgl/index.js';
import { parseSketchFile } from './parsers/sketch/index.js';
import { buildIR } from './core/ui-ir/normalize.js';

const cmd = process.argv[2];
const argPath = process.argv[3];

switch(cmd){
	case 'react': {
		const ir = JSON.parse(fs.readFileSync('sample-ui-ir.json','utf-8'));
		console.log(generateReact(ir));
		break;
	}
	case 'lvgl': {
		const ir = JSON.parse(fs.readFileSync('sample-ui-ir.json','utf-8'));
		console.log(generateLvgl(ir));
		break;
	}
	case 'parse-react': {
		const code = fs.readFileSync(argPath,'utf-8');
		console.log(JSON.stringify(parseReactFile(code),null,2));
		break;
	}
	case 'parse-lvgl': {
		const code = fs.readFileSync(argPath,'utf-8');
		console.log(JSON.stringify(parseLvglFile(code),null,2));
		break;
	}
	case 'parse-sketch': {
		console.log(JSON.stringify(parseSketchFile(argPath),null,2));
		break;
	}
	case 'build-ir': {
		const parts = {
			react: fs.existsSync('src/sample/sample.jsx') ? parseReactFile(fs.readFileSync('src/sample/sample.jsx','utf-8')) : undefined,
			lvgl: fs.existsSync('src/sample/sample.c') ? parseLvglFile(fs.readFileSync('src/sample/sample.c','utf-8')) : undefined,
			sketch: fs.existsSync('src/sample/sketch-document.json') ? parseSketchFile('src/sample/sketch-document.json') : undefined,
			screenId: 'screen_phase3'
		};
		const ir = buildIR(parts);
		console.log(JSON.stringify(ir,null,2));
		break;
	}
	default: {
		console.log('Unknown command');
	}
}
