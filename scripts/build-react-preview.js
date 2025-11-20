import fs from 'fs';
// Generates simple preview component from current IR
const irPath = 'dist/ui-ir.json';
if(!fs.existsSync('dist')) fs.mkdirSync('dist');
let ir;
try { ir = JSON.parse(fs.readFileSync('sample-ui-ir.json','utf-8')); } catch(e){ ir = { screenId:'sample', widgets:[] }; }
fs.writeFileSync(irPath, JSON.stringify(ir,null,2));
if(!fs.existsSync('preview')) fs.mkdirSync('preview');
fs.writeFileSync('preview/App.jsx', `import React from 'react';\nimport data from '../dist/ui-ir.json';\nexport default function App(){ return <div>Preview: {data.screenId} widgets={data.widgets.length}</div>; }`);