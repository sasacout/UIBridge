// Phase 4 placeholder: React generator
export function generateReact(ir) {
  const lines = [];
  lines.push(`// Auto-generated React component`);
  lines.push(`import React from 'react';`);
  lines.push(`export function ${camel(ir.screenId)}() {`);
  lines.push(`  return (<div className="w-full h-full">`);
  ir.widgets.forEach(w => {
    const cls = (w.tailwind || '').trim();
    if (w.type === 'Button') {
  lines.push(`    <button id="${w.id}" className="${cls}">${escapeHtml(w.text || '')}</button>`);
    } else if (w.type === 'Label') {
  lines.push(`    <span id="${w.id}" className="${cls}">${escapeHtml(w.text || '')}</span>`);
    } else {
  lines.push(`    <div id="${w.id}" className="${cls}"></div>`);
    }
  });
  lines.push(`  </div>);`);
  lines.push(`}`);
  return lines.join('\n');
}
function camel(name){ return name.replace(/(^|_)([a-z])/g,(_,__,c)=>c.toUpperCase()); }
function escapeHtml(str){ return str.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
