import { parse } from '@babel/parser';
import { safeTrim } from '../../core/util/safeTrim.js';

export function parseReactFile(code) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx','typescript'] });
  const widgets = [];
  const parentStack = [];
  visit(ast.program, node => {
    if (node.type === 'JSXElement') {
      const name = jsxName(node.openingElement.name);
      const idAttr = node.openingElement.attributes.find(a => a.type === 'JSXAttribute' && jsxName(a.name) === 'id');
      const text = extractText(node.children);
      const w = {
        id: idAttr?.value?.value || autoId(name, widgets.length),
        type: mapType(name),
        text,
        layout: {},
        style: {},
        events: collectEvents(node.openingElement.attributes),
        source: 'react',
        children: []
      };
      if(parentStack.length){
        const parent = parentStack[parentStack.length-1];
        parent.children.push(w.id);
      }
      widgets.push(w);
      parentStack.push(w);
    }
    // pop when finishing element
    if(node.type === 'JSXClosingElement') {
      parentStack.pop();
    }
  });
  return { raw: widgets, meta: { parser: 'react', count: widgets.length } };
}

function visit(node, fn){
  if(!node) return;
  fn(node);
  for(const k in node){
    const v = node[k];
    if(Array.isArray(v)) v.forEach(c=>c && typeof c==='object' && visit(c,fn));
    else if(v && typeof v==='object') visit(v,fn);
  }
}
function jsxName(n){ return n && n.type==='JSXIdentifier' ? n.name : ''; }
function autoId(name, idx){ return `${(name||'el').toLowerCase()}_${idx}`; }
function mapType(name){
  if(name==='button') return 'Button';
  if(name==='span' || name==='label') return 'Label';
  return 'Container';
}
function collectEvents(attrs){
  return attrs.filter(a=>a.type==='JSXAttribute' && /^on[A-Z]/.test(jsxName(a.name)))
    .map(a=>({ name: jsxName(a.name), source: 'react' }));
}
function extractText(children=[]){
  for(const c of children){
    if(c.type==='JSXText'){
      const v = safeTrim(c.value);
      if(v) return v;
    }
    if(c.type==='JSXExpressionContainer' && c.expression.type==='StringLiteral'){
      const v = safeTrim(c.expression.value);
      if(v) return v;
    }
  }
  return '';
}
