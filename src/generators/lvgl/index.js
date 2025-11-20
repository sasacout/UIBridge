// Phase 4 placeholder: LVGL generator
export function generateLvgl(ir) {
  const lines = [];
  lines.push(`// Auto-generated LVGL C source`);
  lines.push(`#include "lvgl.h"`);
  lines.push(`void build_${ir.screenId}(lv_obj_t *root) {`);
  ir.widgets.forEach(w => {
    if (w.type === 'Button') {
      lines.push(`  lv_obj_t *${w.id} = lv_btn_create(root);`);
      if (w.text) {
  lines.push(`  lv_obj_t *${w.id}_label = lv_label_create(${w.id});`);
  lines.push(`  lv_label_set_text(${w.id}_label, "${cEscape(w.text)}");`);
      }
    } else if (w.type === 'Label') {
      lines.push(`  lv_obj_t *${w.id} = lv_label_create(root);`);
  if (w.text) lines.push(`  lv_label_set_text(${w.id}, "${cEscape(w.text)}");`);
    } else if (w.type === 'Image') {
      lines.push(`  lv_obj_t *${w.id} = lv_img_create(root);`);
    }
  });
  lines.push(`}`);
  return lines.join('\n');
}
function cEscape(str){ return str.replace(/"/g,'\\"'); }
